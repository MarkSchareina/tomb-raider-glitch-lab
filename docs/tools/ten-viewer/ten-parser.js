import {SceneBuilder,levelToWorld} from './scene-builder.js';
import {LevelParser} from './level-parser.js';
// TEN 1.10.1 layout: TombEngine v1.10.1 Specific/level.cpp.
// Pure data parser: never executes embedded scripts or game code.
const MAX_BLOCK=384*1024*1024;
class Reader {
  constructor(bytes){this.bytes=bytes;this.view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);this.pos=0;}
  need(n){if(!Number.isSafeInteger(n)||n<0||this.pos+n>this.bytes.length)throw Error(`Truncated TEN data at byte ${this.pos}.`);}
  skip(n){this.need(n);this.pos+=n;}
  take(n){this.need(n);const out=this.bytes.slice(this.pos,this.pos+n);this.pos+=n;return out;}
  n(type){const formats={i:['getInt32',4],h:['getInt16',2],H:['getUint16',2],B:['getUint8',1],f:['getFloat32',4]};const [fn,size]=formats[type];this.need(size);const v=this.view[fn](this.pos,true);this.pos+=size;return v;}
  v(n,type='f'){this.need(n*({i:4,h:2,H:2,B:1,f:4}[type]));return Array.from({length:n},()=>this.n(type));}
  count(minBytes=1){const n=this.n('i');if(n<0||n>2000000||n*minBytes>this.bytes.length-this.pos)throw Error(`Invalid TEN count at byte ${this.pos-4}.`);return n;}
  list(fn,minBytes=1){return Array.from({length:this.count(minBytes)},fn);}
  string(){let n=0,shift=0,b;do{b=this.n('B');if(shift>=28)throw Error('Invalid string length.');n+=(b&127)*2**shift;shift+=7;}while(b&128);return new TextDecoder('utf-8',{fatal:true}).decode(this.take(n));}
  end(){if(this.pos!==this.bytes.length)throw Error(`Unexpected trailing TEN data (${this.bytes.length-this.pos} bytes).`);}
}
export function decompress(src,size){
  if(size<0||size>MAX_BLOCK)throw Error('TEN block exceeds the 384 MiB import limit.');
  const out=new Uint8Array(size);let p=0,q=0;
  const byte=()=>{if(p>=src.length)throw Error('Truncated LZ4 block.');return src[p++];};
  const length=n=>{if(n===15){let b;do{b=byte();n+=b;}while(b===255);}return n;};
  while(p<src.length){const token=byte(),literal=length(token>>4);if(p+literal>src.length||q+literal>size)throw Error('Invalid LZ4 literal.');out.set(src.subarray(p,p+literal),q);p+=literal;q+=literal;if(p===src.length)break;
    const offset=byte()|(byte()<<8),match=length(token&15)+4;if(!offset||offset>q||q+match>size)throw Error('Invalid LZ4 match.');for(let i=0;i<match;i++)out[q+i]=out[q+i-offset];q+=match;
  }
  if(q!==size)throw Error('Incorrect LZ4 output size.');return out;
}
function polygons(r,mesh=false){return r.list(()=>{
  const bucket={texture:r.n('i'),blend:r.n('B'),material:r.n('i'),animated:r.n('B')};
  bucket.polygons=r.list(()=>{const shape=r.n('i');r.skip(8);if(shape!==0&&shape!==1)throw Error(`Unsupported polygon shape ${shape}.`);if(mesh)r.skip(4);const normal=r.v(3),n=shape===0?4:3,indices=r.v(n,'i'),uv=Array.from({length:n},()=>r.v(2));r.skip(n*36);return {shape,normal,indices,uv};},12);return bucket;
},14);}
function rooms(r){const result=r.list((_,id)=>{
  const [x,z,bottom,top]=r.v(4,'i'),n=r.count(36),vertices=Array.from({length:n},()=>r.v(3));r.skip(n*24);
  const buckets=polygons(r),portals=r.list(()=>({room:r.n('h'),normal:r.v(3,'i'),vertices:Array.from({length:4},()=>r.v(3,'i'))}),62);
  const [nz,nx]=r.v(2,'i');if(nx<1||nz<1||nx*nz>1000000)throw Error('Invalid room dimensions.');r.need(nx*nz*100);
  const sectors=Array.from({length:nx*nz},(_,i)=>{const [trigger,box,material,stopper]=r.v(4,'i'),s={x:Math.floor(i/nz),z:i%nz,trigger,box,material,stopper};
    for(const key of ['floor','ceiling'])s[key]={angle:r.n('f'),portals:r.v(2,'i'),planes:[r.v(3),r.v(3)]};s.side=r.n('i');r.skip(8);return s;});
  r.skip(r.count(58)*58);return {id,x,z,bottom,top,nx,nz,vertices,buckets,portals,sectors};
},20);r.skip(r.count(2)*2);return result;}
function objects(r){
  const meshes=r.list(()=>{r.skip(18);const n=r.count(44),vertices=Array.from({length:n},()=>r.v(3));r.skip(n*32);return {vertices,buckets:polygons(r,true)};},22);
  const animations=r.list(()=>{const frame=r.n('i');r.skip(64);return {frame_ptr:frame};},68);
  for(const stride of [12,16,4])r.skip(r.count(stride)*stride);
  const bones=r.v(r.count(4),'i');
  const frames=r.list(()=>{const bounds=r.v(6,'h'),offset=r.v(3,'h'),n=r.n('h');if(n<0||n>10000)throw Error('Invalid animation frame.');r.need(n*16);return {bounds,offset,rotations:Array.from({length:n},()=>r.v(4))};},20);
  const models=r.list(()=>Object.fromEntries(['slot','skin','nmeshes','mesh','bone','frame','anim'].map(k=>[k,r.n('i')])),28);
  const statics=r.list(()=>{const slot=r.n('i'),mesh=r.n('i'),visibility=r.v(6,'h'),collision=r.v(6,'h');r.skip(6);return {slot,mesh,visibility,collision};},38);
  return {meshes,animations,bones,frames,models,statics};
}
function geometryTail(r){
  r.skip(r.count(36)*36);r.skip(r.count(8)*8);const boxes=r.count(28);r.skip(boxes*28);r.skip(r.count(8)*8);r.skip(2*r.count(0)*boxes*4);r.skip(r.count(23)*23);
  for(let i=r.count(18);i;i--){r.skip(14);r.skip(r.count(32)*32);}
  for(let i=r.count(75);i;i--){r.string();r.skip(74);}r.end();
}
function dynamic(r,rooms){
  if(r.count()!==rooms.length)throw Error('Room count mismatch.');
  for(const room of rooms){room.name=r.string();r.list(()=>r.string());r.skip(12);[room.flipped,room.flags,room.effect,room.reverb,room.flip_number]=r.v(5,'i');
    room.statics=r.list(()=>{const pos=r.v(3,'i'),rot=r.v(3,'H'),scale=r.n('f');r.skip(18);const slot=r.n('H');r.skip(2);return {pos,rot,scale,slot,name:r.string()};},45);
    room.volumes=r.list(()=>({type:r.n('i'),pos:r.v(3),rot:r.v(4),scale:r.v(3),enabled:r.n('B'),adjacent:r.n('B'),name:r.string(),event:r.n('i')}),51);
  }
  const items=r.list((_,id)=>{const slot=r.n('h'),room=r.n('h'),pos=r.v(3,'i'),rot=r.v(3,'h');r.skip(16);return {id,slot,room,pos,rot,ocb:r.n('h'),flags:r.n('h'),name:r.string()};},43);
  r.list(()=>{r.skip(30);r.string();},31);r.list(()=>{r.skip(24);r.string();},25);r.skip(r.count(40)*40);
  for(let group=0;group<2;group++)r.list(()=>{r.skip(20);r.string();},21);
  if(r.count(0))for(const group of ['global','volume'])r.list(()=>{r.string();if(group==='volume')r.skip(4);r.list(()=>{r.skip(8);r.string();r.string();r.skip(5);},15);});
  r.end();return {items};
}
function media(r){
  const textures={};
  function texture(maps){const [width,height]=r.v(2,'i');if(width<1||height<1||width>16384||height>16384)throw Error('Unsupported texture dimensions.');let bytes;
    for(let n=0;n<(maps?4:1);n++){if(n&&!r.n('B'))continue;const size=r.n('i');if(n===0)bytes=r.take(size);else r.skip(size);}
    if(bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71)throw Error('This TEN uses a non-PNG atlas. The browser importer currently supports embedded PNG textures.');
    return {width,height,bytes};
  }
  for(const kind of ['room','moveable','static','animated','sprite'])textures[kind]=r.list(()=>texture(kind!=='sprite'),12);
  texture(false);r.skip(r.n('H')*2);r.skip(r.count(8)*8);r.list(()=>{r.skip(4);r.skip(r.n('i'));},8);r.end();return textures;
}
function triggers(room){return room.sectors.filter(s=>s.trigger>=0).map(s=>{const vertices=[],f=s.floor,tris=Math.abs(f.angle-Math.PI/4)<.0001?[[[0,0],[0,1],[1,1]],[[0,0],[1,1],[1,0]]]:[[[1,0],[1,1],[0,1]],[[0,0],[1,0],[0,1]]];
  tris.forEach((t,i)=>{const [a,b,h]=f.planes[i];for(const [u,v] of t)vertices.push(...levelToWorld([room.x+(s.x+u)*1024,h+a*(u*1024-512)+b*(v*1024-512),room.z+(s.z+v)*1024]));});return {x:s.x,z:s.z,index:s.trigger,vertices};});}
export function parseTEN(buffer,source='Level.ten',progress=()=>{}){
  const r=new Reader(new Uint8Array(buffer));if(r.v(4,'B').join(',')!=='84,69,78,0')throw Error('Not a TEN level file.');
  const version=r.v(4,'B');if(version.join('.')!=='1.10.1.0')throw Error(`Unsupported TEN version ${version.join('.')}. Supported: 1.10.1.0.`);r.skip(8);
  const blocks={};let total=0;
  for(const name of ['media','geometry','dynamic']){progress(`Unpacking ${name}…`);const size=r.n('i'),packed=r.n('i');total+=size;if(total>768*1024*1024)throw Error('Expanded level exceeds the 768 MiB import limit.');blocks[name]=decompress(r.take(packed),size);}r.end();
  progress('Reading textures…');const textures=media(new Reader(blocks.media));
  progress('Reading rooms and objects…');const geometry=new Reader(blocks.geometry),roomList=rooms(geometry),objectList=objects(geometry);geometryTail(geometry);if(!roomList.length)throw Error('This level contains no rooms.');
  const entities=dynamic(new Reader(blocks.dynamic),roomList);progress('Building the inspection scene…');for(const r of roomList){r.triggers=triggers(r);r.mapSectors=r.sectors.map(s=>({floorPortals:s.floor.portals,side:s.side}));r.wallSectors=r.sectors.filter(s=>s.floor.angle===s.ceiling.angle&&JSON.stringify(s.floor.planes)===JSON.stringify(s.ceiling.planes)).map(s=>s.x*r.nz+s.z);}
  for(const m of objectList.models)m.frame=objectList.animations[m.anim]?.frame_ptr??m.frame;
  const result=new SceneBuilder().build(roomList,objectList,entities,textures,source);result.meta.format={id:'ten',label:'TEN 1.10.1.0',capabilities:{eventVolumes:true}};return result;
}

export class TENParser extends LevelParser {
  matches(bytes){return bytes.length>=4&&bytes[0]===84&&bytes[1]===69&&bytes[2]===78&&bytes[3]===0;}
  parse(buffer,source,progress){return parseTEN(buffer,source,progress);}
}
