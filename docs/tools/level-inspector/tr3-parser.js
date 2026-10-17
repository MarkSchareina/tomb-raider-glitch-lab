import {LevelParser} from './level-parser.js';
import {SceneBuilder,multiplyQuaternion,levelToWorld} from './scene-builder.js';

// TR3 PC retail layouts: tomb3/specific/file.cpp and trlevel/Level_tr3_pc.ixx.
// This adapter knows the disk layout; SceneBuilder and the renderer do not.
class TR3Reader {
  constructor(bytes){this.bytes=bytes;this.view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);this.pos=0;}
  need(n){if(!Number.isSafeInteger(n)||n<0||this.pos+n>this.bytes.length)throw Error(`Truncated TR3 data at byte ${this.pos}.`);}
  skip(n){this.need(n);this.pos+=n;}
  take(n){this.need(n);const out=this.bytes.subarray(this.pos,this.pos+n);this.pos+=n;return out;}
  n(type='u16'){const [fn,size]={u8:['getUint8',1],i8:['getInt8',1],u16:['getUint16',2],i16:['getInt16',2],u32:['getUint32',4],i32:['getInt32',4]}[type];this.need(size);const v=this.view[fn](this.pos,true);this.pos+=size;return v;}
  v(n,type='i16'){this.need(n*({u8:1,i8:1,u16:2,i16:2,u32:4,i32:4}[type]));return Array.from({length:n},()=>this.n(type));}
  count(stride,type='u32'){const n=this.n(type);if(n>2000000)throw Error('TR3 count exceeds import limits.');this.need(n*stride);return n;}
  list(stride,fn,type='u32'){return Array.from({length:this.count(stride,type)},(_,i)=>fn(i));}
  end(){if(this.pos!==this.bytes.length)throw Error(`Unexpected trailing TR3 data (${this.bytes.length-this.pos} bytes).`);}
}
const tr3Sign8=n=>(n<<24)>>24;
const tr3Sign5=n=>(n<<27)>>27;
const tr3Functions=['None','Side portal','Floor slope','Ceiling slope','Trigger','Death sector','Climbable wall','Split floor NW–SE','Split floor NE–SW','Split ceiling NW–SE','Split ceiling NE–SW','Floor opening SW','Floor opening NE','Floor opening SE','Floor opening NW','Ceiling opening SW','Ceiling opening NE','Ceiling opening NW','Ceiling opening SE','Monkey swing','Minecart left','Minecart right'];
const tr3TriggerTypes=['Trigger','Pad','Switch','Key','Pickup','Heavy','Antipad','Combat','Dummy','Antitrigger'];
const tr3Actions=['Activate object','Camera','Underwater current','Flip map','Flip on','Flip off','Look at object','End level','Play soundtrack','Flip effect','Secret','Clear bodies'];
function describeTR3Command(c){
  const name=tr3Functions[c.type];
  if(c.type===4)return `${tr3TriggerTypes[c.triggerType]??'Trigger type '+c.triggerType} @ ${c.index} · timer ${c.setup&255} · one-shot ${!!(c.setup&256)} · mask ${(c.setup>>9)&31}${c.reference!==undefined?' · key/switch object '+(c.reference&1023):''}: ${c.actions.map(a=>`${tr3Actions[a.type]??'Action '+a.type} ${a.target}${a.camera!==undefined?' (camera setup '+a.camera+')':''}`).join('; ')}`;
  if(c.type===1)return `${name} → Room ${c.value}`;
  if(c.type===2||c.type===3)return `${name} · X ${tr3Sign8(c.value)}, Z ${tr3Sign8(c.value>>8)}`;
  if(c.type>=7&&c.type<=18)return `${name} · raw header 0x${c.header.toString(16)} · corners 0x${c.value.toString(16)}`;
  if(c.type===6)return `${name} · direction mask ${(c.header>>8)&15}`;
  return name;
}

// Raw floor-data commands remain available to the inspector. TR3 slopes and
// split floor planes are evaluated in native Y-down coordinates before adapting.
export function readTR3FloorData(words,index){
  if(!index)return [];
  let p=index;const read=()=>{if(p>=words.length)throw Error('Invalid TR3 floor-data reference.');return words[p++];};
  const commands=[];
  for(let count=0;count<1024;count++){
    const header=read(),type=header&31,command={index:p-1,type,header};
    if(type===1||type===2||type===3||(type>=7&&type<=18))command.value=read();
    else if(type===4){
      command.triggerType=(header>>8)&127;command.setup=read();command.actions=[];
      let more=true;
      if(command.triggerType===2||command.triggerType===3){command.reference=read();more=!(command.reference&0x8000);}
      while(more){const word=read(),action={type:(word>>10)&31,target:word&1023};let end=word;
        if(action.type===1){action.camera=read();end=action.camera;}
        command.actions.push(action);more=!(end&0x8000);
      }
    }else if(![0,5,6,19,20,21].includes(type))throw Error(`Unsupported TR3 floor-data function ${type}.`);
    commands.push(command);if(header&0x8000)return commands;
  }
  throw Error('Unterminated TR3 floor data.');
}
function tr3Floor(room,sector,commands){
  const split=commands.find(c=>[7,8,11,12,13,14].includes(c.type));
  const slant=commands.find(c=>c.type===2);
  const diagonal=split&&[8,13,14].includes(split.type);
  const triangles=diagonal?[[[0,0],[0,1],[1,1]],[[0,0],[1,1],[1,0]]]:[[[0,0],[0,1],[1,0]],[[1,0],[0,1],[1,1]]];
  const vertices=[];
  for(let half=0;half<2;half++){
    let h=sector.floor*256,xs=slant?tr3Sign8(slant.value):0,zs=slant?tr3Sign8(slant.value>>8):0;
    if(split){const t=Array.from({length:4},(_,i)=>(split.value>>(i*4))&15);
      h+=tr3Sign5((split.header>>(half===0?10:5))&31)*256;
      [zs,xs]=diagonal?(half===0?[t[2]-t[1],t[3]-t[2]]:[t[3]-t[0],t[0]-t[1]]):(half===0?[t[2]-t[1],t[0]-t[1]]:[t[3]-t[0],t[3]-t[2]]);
    }
    for(const [u,v] of triangles[half]){
      // Continuous plane equivalent of GetHeight's quarter-unit slope arithmetic.
      const y=h+(xs<0?-xs*u:xs*(1-u))*256+(zs<0?-zs*v:zs*(1-v))*256;
      vertices.push(...levelToWorld([room.x+(sector.x+u)*1024,y,room.z+(sector.z+v)*1024]));
    }
  }
  const below=sector.below===255?-1:sector.below,portals=[below,below];
  if(split?.type>=11){if([11,13].includes(split.type))portals[1]=-1;else portals[0]=-1;}
  return {vertices,portals};
}

export class TR3Parser extends LevelParser {
  matches(bytes){if(bytes.length<4)return false;const v=new DataView(bytes.buffer,bytes.byteOffset,4).getUint32(0,true);return v===0xff180038||v===0xff080038||v===0xff180034||v===0xff080034;}
  parse(buffer,source='Level.TR2',progress=()=>{}){
    this.colorTiles=new Map();
    const r=new TR3Reader(new Uint8Array(buffer));if(!this.matches(r.bytes))throw Error('Not a supported TR3 PC level.');r.skip(4);
    progress('Reading TR3 texture pages…');r.skip(768);this.palette=r.take(1024);
    const pages=r.count(256*256*3);if(pages>1024)throw Error('Too many TR3 texture pages.');r.skip(pages*65536);
    this.atlases=Array.from({length:pages},()=>{const pixels=new Uint8Array(256*256*4);
      for(let i=0;i<65536;i++){const pixel=r.n();pixels[i*4]=Math.round(((pixel>>10)&31)*255/31);pixels[i*4+1]=Math.round(((pixel>>5)&31)*255/31);pixels[i*4+2]=Math.round((pixel&31)*255/31);pixels[i*4+3]=(pixel&0x8000)?255:0;}
      return {image:{data:pixels,width:256,height:256}};
    });r.skip(4);
    progress('Reading TR3 rooms and sectors…');const rooms=r.list(24,id=>this.room(r,id),'u16');if(!rooms.length)throw Error('This TR3 level contains no rooms.');
    const floor=r.v(r.count(2),'u16');const meshBytes=r.take(r.count(2)*2),pointers=r.v(r.count(4),'u32');
    // Frame offsets are retained in the model records; animations are not played.
    r.skip(r.count(32)*32);r.skip(r.count(6)*6);r.skip(r.count(8)*8);r.skip(r.count(2)*2);
    const bones=r.v(r.count(4),'i32'),frameWords=r.take(r.count(2)*2);
    const models=r.list(18,()=>({slot:r.n('u32'),nmeshes:r.n(),mesh:r.n(),bone:r.n('u32'),frameByte:r.n('u32'),anim:r.n()}));
    const statics=r.list(32,()=>{const s={slot:r.n('u32'),mesh:r.n(),visibility:r.v(6),collision:r.v(6),flags:r.n()};return s;});
    const sprites=r.list(16,()=>({tile:r.n(),x:r.n('u8'),y:r.n('u8'),width:r.n(),height:r.n(),bounds:r.v(4)}));
    const sequences=r.list(8,()=>({slot:r.n('i32'),count:r.n('i16'),texture:r.n()}));
    r.skip(r.count(16)*16);r.skip(r.count(16)*16);const boxes=r.count(8);r.skip(boxes*8);r.skip(r.count(2)*2);r.skip(boxes*20);r.skip(r.count(2)*2);
    this.objectTextures=r.list(20,()=>({blend:r.n(),tile:r.n()&0x7fff,uv:Array.from({length:4},()=>{const xf=r.n('u8'),x=r.n('u8'),yf=r.n('u8'),y=r.n('u8');return [(x+(xf>=128?1:0))/256,(y+(yf>=128?1:0))/256];})}));
    const items=r.list(24,id=>{const slot=r.n('i16'),room=r.n('i16'),pos=r.v(3,'i32'),yaw=r.n('i16'),intensity=r.v(2),flags=r.n();return {id,slot,room,pos,rot:[yaw,0,0],intensity,flags,ocb:0,name:`TR3 slot ${slot}`};});
    r.skip(8192);r.skip(r.count(16,'u16')*16);r.skip(r.count(1,'u16'));r.skip(370*2);r.skip(r.count(8)*8);r.skip(r.count(4)*4);r.end();
    progress('Building TR3 reference poses…');const meshCache=new Map(),meshes=pointers.map(pointer=>{
      if(pointer%2||pointer>=meshBytes.length)throw Error('Invalid TR3 mesh pointer.');
      if(!meshCache.has(pointer)){const reader=new TR3Reader(meshBytes.subarray(pointer));reader.skip(10);const vertices=reader.list(6,()=>reader.v(3),'u16');const normals=reader.n('i16');reader.skip(Math.abs(normals)*(normals>=0?6:2));const faces=[...this.faces(reader,4),...this.faces(reader,3),...this.faces(reader,4,true),...this.faces(reader,3,true)];meshCache.set(pointer,this.geometry(vertices,faces));}
      return meshCache.get(pointer);
    });
    const frames=models.map(m=>{if(!Number.isInteger(m.bone))throw Error('Invalid TR3 bone offset.');if(m.frameByte===frameWords.length)return {offset:[0,0,0],rotations:[]};
      if(m.frameByte%2||m.frameByte>frameWords.length)throw Error('Invalid TR3 frame offset.');const f=new TR3Reader(frameWords.subarray(m.frameByte));
      const frame={bounds:f.v(6),offset:f.v(3),rotations:[]};if(m.nmeshes>10000)throw Error('Too many TR3 model meshes.');
      for(let i=0;i<m.nmeshes;i++){const first=f.n(),axis=first>>14;let x=0,y=0,z=0;
        if(axis){const a=(first&1023)*Math.PI/1024;if(axis===1)x=a;else if(axis===2)y=a;else z=a;}
        else{const next=f.n();x=((first>>4)&1023)*Math.PI/1024;y=(((first&15)<<6)|(next>>10))*Math.PI/1024;z=(next&1023)*Math.PI/1024;}
        frame.rotations.push(multiplyQuaternion(multiplyQuaternion([0,Math.sin(y),0,Math.cos(y)],[Math.sin(x),0,0,Math.cos(x)]),[0,0,Math.sin(z),Math.cos(z)]));
      }return frame;
    });models.forEach((m,i)=>{m.frame=i;m.anim=-1;});
    const spriteModelSlots=new Set();
    for(const sequence of sequences){if(models.some(m=>m.slot===sequence.slot))continue;const sprite=this.sprite(sprites[sequence.texture]);const frame=frames.length;frames.push({bounds:sprite.bounds,offset:[0,0,0],rotations:[]});models.push({slot:sequence.slot,nmeshes:1,mesh:meshes.length,bone:0,frame,anim:-1});meshes.push(sprite);spriteModelSlots.add(sequence.slot);}
    for(const room of rooms){Object.assign(room,this.geometry(room.vertices,room.faces));room.name=`Room ${room.id}`;room.volumes=[];room.triggers=[];room.mapSectors=[];room.wallSectors=[];
      for(const sector of room.sectors){
        const commands=readTR3FloorData(floor,sector.index),surface=tr3Floor(room,sector,commands),side=commands.find(c=>c.type===1)?.value??-1;
        for(const target of [room.flipped,side,sector.below===255?-1:sector.below,sector.above===255?-1:sector.above])if(target>=rooms.length)throw Error('Invalid TR3 room reference.');
        const trigger=commands.find(c=>c.type===4);if(trigger)room.triggers.push({x:sector.x,z:sector.z,index:trigger.index,vertices:surface.vertices,...trigger});
        room.mapSectors.push({floorPortals:surface.portals,ceilingPortals:[sector.above===255?-1:sector.above],side,floorHeight:sector.floor*256,ceilingHeight:sector.ceiling*256,floorData:commands,inspection:[`Base floor Y ${sector.floor*256} · ceiling Y ${sector.ceiling*256} (level units; slopes may change heights)`,...commands.map(describeTR3Command)]});
        // Equal base heights can still describe open, sloped/split sectors.
        // TR3's solid-wall sentinel requires BOTH height bytes to be -127.
        if(sector.floor===-127&&sector.ceiling===-127)room.wallSectors.push(sector.x*room.nz+sector.z);
      }
      room.spriteInstances=room.sprites.map(s=>{const vertex=room.vertices[s.vertex];if(!vertex)throw Error('Invalid TR3 room sprite vertex.');return {...this.sprite(sprites[s.texture]),position:[room.x+vertex[0],vertex[1],room.z+vertex[2]]};});
      for(const portal of room.portals)if(portal.room>=rooms.length)throw Error('Invalid TR3 portal room.');
    }
    const textures={room:this.atlases,static:this.atlases,moveable:this.atlases,sprite:this.atlases};
    const result=new SceneBuilder().build(rooms,{meshes,bones,frames,models,statics,animations:[]},{items},textures,source);
    for(const node of result.nodes)if(node.extras?.kind==='moveable'&&spriteModelSlots.has(node.extras.slot))node.extras.billboard=true;
    result.meta.format={id:'tr3',label:'TR3 PC',capabilities:{eventVolumes:false}};
    result.meta.statistics={texturePages:pages,objectTextures:this.objectTextures.length,meshPointers:pointers.length,models:models.length,staticDefinitions:statics.length,floorWords:floor.length,sprites:rooms.reduce((n,r)=>n+r.sprites.length,0)};
    return result;
  }
  faces(r,corners,colored=false){return r.list(corners*2+2,()=>({indices:r.v(corners,'u16'),texture:r.n(),colored}),'u16');}
  room(r,id){
    const [x,z,bottom,top]=r.v(4,'i32'),data=new TR3Reader(r.take(r.count(2)*2));let vertices=[],faces=[],sprites=[];
    if(data.bytes.length){vertices=data.list(12,()=>{const v=data.v(3);data.skip(6);return v;},'u16');faces=[...this.faces(data,4),...this.faces(data,3)];sprites=data.list(4,()=>({vertex:data.n(),texture:data.n()}),'u16');data.end();}
    const portals=r.list(32,()=>({room:r.n(),normal:r.v(3),vertices:Array.from({length:4},()=>r.v(3))}),'u16');
    const nz=r.n(),nx=r.n();if(!nx||!nz||nx*nz>1000000)throw Error('Invalid TR3 room dimensions.');r.need(nx*nz*8);
    const sectors=Array.from({length:nx*nz},(_,i)=>({x:Math.floor(i/nz),z:i%nz,index:r.n(),box:r.n(),below:r.n('u8'),floor:r.n('i8'),above:r.n('u8'),ceiling:r.n('i8')}));
    r.skip(4);r.skip(r.count(24,'u16')*24);const statics=r.list(20,()=>{const pos=r.v(3,'i32'),yaw=r.n();r.skip(4);return {pos,rot:[yaw,0,0],slot:r.n(),scale:1,name:''};},'u16');
    const flipped=r.n('i16'),flags=r.n(),effect=r.n('u8'),reverb=r.n('u8');r.skip(1);
    return {id,x,z,bottom,top,vertices,faces,sprites,portals,nx,nz,sectors,statics,flipped,flags,effect,reverb};
  }
  geometry(vertices,faces){
    const buckets=new Map();
    for(const face of faces){let texture;
      if(face.colored){const color=((face.texture&0x7fff)>>8)&255;this.colorTiles??=new Map();if(!this.colorTiles.has(color)){const pixel=new Uint8Array([...this.palette.subarray(color*4,color*4+3),255]);this.colorTiles.set(color,this.atlases.length);this.atlases.push({image:{data:pixel,width:1,height:1}});}
        texture={tile:this.colorTiles.get(color),blend:0,uv:[[.5,.5],[.5,.5],[.5,.5],[.5,.5]]};
      }else texture=this.objectTextures[face.texture&0x7fff];
      if(!texture||!this.atlases[texture.tile])throw Error('Invalid TR3 texture reference.');
      const points=face.indices.map(i=>{if(!vertices[i])throw Error('Invalid TR3 face vertex.');return vertices[i];});
      const a=points[1].map((v,i)=>v-points[0][i]),b=points[2].map((v,i)=>v-points[0][i]),normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...normal)||1;
      const doubleSided=!!(face.texture&0x8000),key=`${texture.tile}/${texture.blend}/${doubleSided}`;
      if(!buckets.has(key))buckets.set(key,{texture:texture.tile,blend:texture.blend,doubleSided,alphaTest:texture.blend===0?0:.3,additive:texture.blend===2,animated:false,polygons:[]});
      buckets.get(key).polygons.push({shape:face.indices.length===4?0:1,indices:face.indices,normal:normal.map(v=>v/length),uv:texture.uv.slice(0,face.indices.length)});
    }return {vertices,buckets:[...buckets.values()]};
  }
  sprite(s){
    if(!s||!this.atlases[s.tile])throw Error('Invalid TR3 sprite reference.');
    const [left,top,right,bottom]=s.bounds,vertices=[[left,top,0],[right,top,0],[right,bottom,0],[left,bottom,0]];
    const u=s.x/256,v=s.y/256,w=(s.width+1)/65536,h=(s.height+1)/65536;
    return {vertices,bounds:[left,right,top,bottom,0,0],buckets:[{texture:s.tile,blend:1,doubleSided:true,polygons:[{shape:0,indices:[0,1,2,3],normal:[0,0,-1],uv:[[u,v],[u+w,v],[u+w,v+h],[u,v+h]]}]}]};
  }
}
