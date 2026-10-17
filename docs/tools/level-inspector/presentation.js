// Reproducible explanatory scenes. All public coordinates are native level units.
import * as THREE from 'three';

export const toWorld = v => new THREE.Vector3(v[0]/1024,-v[1]/1024,-v[2]/1024);
export const fromWorld = v => [v.x*1024,-v.y*1024,-v.z*1024];
const evidenceColors={measured:'#dc4a57',model:'#a077db',reported:'#e3a54b',static:'#5bbca6'};
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e8);
const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
function requireValue(ok,message){if(!ok)throw Error(`Scene: ${message}`);}

export function validatePresentation(input,meta,sha256){
 const p=structuredClone(input);
 requireValue(p?.format==='glitchlab-scene'&&p.version===1,'unsupported format/version.');
 requireValue(typeof p.title==='string'&&p.title.length<=160,'title is required (160 characters maximum).');
 requireValue(p.level?.sha256===sha256&&/^[0-9a-f]{64}$/.test(sha256),'level SHA-256 does not match the loaded level.');
 const ids=new Set(meta.rooms.map(r=>r.roomId));
 requireValue(Array.isArray(p.rooms)&&p.rooms.length>0&&p.rooms.length<=1000&&p.rooms.every(id=>ids.has(id)),'unknown or empty room selection.');
 requireValue(p.camera&&vector(p.camera.position)&&vector(p.camera.target)&&vector(p.camera.up),'camera position, target and up are required.');
 const direction=toWorld(p.camera.target).sub(toWorld(p.camera.position)),up=toWorld(p.camera.up);
 requireValue(direction.length()>1e-6&&up.length()>1e-6&&direction.clone().cross(up).length()>1e-9,'degenerate camera.');
 requireValue(['orthographic','perspective'].includes(p.camera.type),'invalid camera type.');
 requireValue(Number.isFinite(p.camera.span)&&p.camera.span>=128&&p.camera.span<=1e7,'camera span must be 128..10000000 level units.');
 requireValue(Number.isFinite(p.camera.fov??45)&&(p.camera.fov??45)>=10&&(p.camera.fov??45)<=120,'FOV must be 10..120 degrees.');
 p.output??={width:1600,height:1000};
 requireValue([p.output.width,p.output.height].every(n=>Number.isInteger(n)&&n>=256&&n<=4096)&&p.output.width*p.output.height<=16777216,'invalid output size.');
 p.palette??='rooms';requireValue(['rooms','trview'].includes(p.palette),'invalid color scheme.');
 p.displayMode??='color';requireValue(['texture','color','wire'].includes(p.displayMode),'invalid display mode.');
 if(p.legend!==undefined)requireValue(typeof p.legend==='string'&&p.legend.length<=220,'invalid legend.');
 p.background??='#101720';requireValue(color(p.background),'invalid background color.');
 p.roomColors??={};requireValue(Object.entries(p.roomColors).every(([id,c])=>ids.has(+id)&&color(c)),'invalid room color.');
 p.portals??='walls';requireValue(['walls','none'].includes(p.portals),'portals must be walls or none.');
 p.coordinates??={local:false,world:false};
 requireValue(typeof p.coordinates.local==='boolean'&&typeof p.coordinates.world==='boolean','coordinate overlay switches must be boolean.');
 p.objects??=[];requireValue(Array.isArray(p.objects)&&p.objects.length<=10000&&p.objects.every(id=>meta.items.some(i=>i.id===id)),'invalid object ids.');
 p.waypoints??=[];p.lines??=[];p.regions??=[];p.shapes??=[];
 requireValue(Array.isArray(p.shapes)&&p.shapes.length<=100,'too many shapes.');
 for(const shape of p.shapes){requireValue(Array.isArray(shape.vertices)&&shape.vertices.length>=3&&shape.vertices.length<=10000&&shape.vertices.every(vector),'invalid shape vertices.');requireValue(Array.isArray(shape.triangles)&&shape.triangles.length<=20000&&shape.triangles.every(t=>Array.isArray(t)&&t.length===3&&t.every(i=>Number.isInteger(i)&&i>=0&&i<shape.vertices.length)),'invalid shape triangles.');requireValue(color(shape.color)&&Number.isFinite(shape.opacity)&&shape.opacity>=0&&shape.opacity<=1,'invalid shape appearance.');}
 for(const list of [p.waypoints,p.lines,p.regions])requireValue(Array.isArray(list)&&list.length<=500,'too many annotations.');
 const names=new Set();
 for(const w of p.waypoints){requireValue(typeof w.id==='string'&&w.id.length<=80&&!names.has(w.id),'waypoint ids must be unique.');names.add(w.id);requireValue(vector(w.position),'invalid waypoint position.');}
 for(const a of [...p.waypoints,...p.lines,...p.regions,...p.shapes]){
  requireValue(typeof a.label==='string'&&a.label.length<=160,'annotation label required (160 characters maximum).');
  requireValue(Object.hasOwn(evidenceColors,a.evidence),'evidence must be measured, model, reported or static.');
  if(a.labelPosition!==undefined)requireValue(vector(a.labelPosition),'invalid label position.');
  if(a.color!==undefined)requireValue(color(a.color),'invalid annotation color.');
 }
 for(const l of p.lines){requireValue(['arrow','trace','measurement'].includes(l.kind),'invalid line kind.');requireValue(Array.isArray(l.points)&&l.points.length>=2&&l.points.length<=10000&&l.points.every(vector),'invalid line points.');}
 for(const r of p.regions){requireValue(['square','circle'].includes(r.kind)&&vector(r.center),'invalid region.');requireValue(Number.isFinite(r.radius)&&r.radius>0&&r.radius<=1e7,'invalid region radius.');}
 return p;
}

function ancestor(o,key){while(o){if(o.userData[key]!==undefined)return o.userData[key];o=o.parent;}}
function label(scene,text,position,color,unit){
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font='600 26px Segoe UI,Arial';
 const rows=text.split('\n');
 canvas.width=Math.ceil(Math.max(...rows.map(row=>ctx.measureText(row).width)))+24;canvas.height=rows.length*34+8;
 ctx.font='600 26px Segoe UI,Arial';ctx.fillStyle='#101720e8';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle=color;rows.forEach((row,i)=>ctx.fillText(row,12,30+i*34));
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false}));
 sprite.userData.svgLabel={rows,color,width:canvas.width,height:canvas.height,fontSize:26,lineHeight:34,baseline:30};
 sprite.position.copy(position);sprite.scale.set(canvas.width*unit,canvas.height*unit,1);sprite.center.set(0,0);sprite.renderOrder=20;scene.add(sprite);
}

// Keep only polygon edges belonging to at least one camera-facing surface.
// Standalone lines otherwise reveal the backs of culled walls as ghost boxes.
export function bindSurfaceEdges(lines,mesh){
 const position=mesh.geometry.attributes.position,index=mesh.geometry.index;
 const key=v=>v.toArray().map(Math.fround).join(',');
 const edgeKey=(a,b)=>[key(a),key(b)].sort().join('|');
 const faces=new Map(),count=index?index.count:position.count;
 for(let i=0;i<count;i+=3){
  const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(position,index?index.getX(i+j):i+j));
  const normal=new THREE.Vector3().crossVectors(v[1].clone().sub(v[0]),v[2].clone().sub(v[0]));
  const face={point:v[0],normal};
  for(let j=0;j<3;j++){const k=edgeKey(v[j],v[(j+1)%3]);if(!faces.has(k))faces.set(k,[]);faces.get(k).push(face);}
 }
 const source=Array.from(lines.geometry.attributes.position.array),edges=[];
 for(let i=0;i<source.length;i+=6){const a=new THREE.Vector3().fromArray(source,i),b=new THREE.Vector3().fromArray(source,i+3);edges.push({values:source.slice(i,i+6),faces:faces.get(edgeKey(a,b))??[]});}
 lines.frustumCulled=false;
 lines.userData.updateSurfaceEdges=camera=>{
  const inverse=mesh.matrixWorld.clone().invert(),eye=new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse);
  const towardCamera=new THREE.Vector3(0,0,1).transformDirection(camera.matrixWorld).transformDirection(inverse);
  const attribute=lines.geometry.attributes.position;let n=0;
  for(const edge of edges)if(edge.faces.some(f=>f.normal.dot(camera.isOrthographicCamera?towardCamera:eye.clone().sub(f.point))>1e-8)){
   attribute.array.set(edge.values,n);n+=6;
  }
  attribute.needsUpdate=true;lines.geometry.setDrawRange(0,n/3);
 };
 lines.onBeforeRender=(_renderer,_scene,camera)=>lines.userData.updateSurfaceEdges(camera);
}

export function buildPresentation(world,meta,input,sha256){
 const p=validatePresentation(input,meta,sha256),scene=new THREE.Scene();scene.background=new THREE.Color(p.background);
 const aspect=p.output.width/p.output.height,span=p.camera.span/1024;
 const camera=p.camera.type==='orthographic'?new THREE.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,.01,100000):new THREE.PerspectiveCamera(p.camera.fov??45,aspect,.01,100000);
 camera.position.copy(toWorld(p.camera.position));camera.up.copy(toWorld(p.camera.up).normalize());camera.lookAt(toWorld(p.camera.target));camera.updateMatrixWorld();
 const unit=span/p.output.height*.65,rooms=new Set(p.rooms),objects=new Set(p.objects),floorMeshes=new Map();let meshCount=0,wallPortals=0,coordinateLabels=0;
 world.updateMatrixWorld(true);
 world.traverse(o=>{
  if(!o.isMesh||o.userData.wireDepthOnly||!rooms.has(ancestor(o,'roomId')))return;
  const room=ancestor(o,'roomId'),kind=ancestor(o,'kind'),isRoom=kind==='geometry'||kind==='room';
  if(!isRoom&&!objects.has(ancestor(o,'itemId')))return;
  const source=o.geometry,position=source.getAttribute('position');let geometry;
  if(isRoom&&p.hideCeilings){
   const positions=[],uv=[],colors=[],allowed=new Set(),normal=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
   const key=v=>v.map(n=>Math.fround(n)).join(',');
   for(let i=0;i<position.count;i+=3){
    a.fromBufferAttribute(position,i);b.fromBufferAttribute(position,i+1);c.fromBufferAttribute(position,i+2);
    normal.crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize();if(normal.y<-.5)continue;
    for(let j=0;j<3;j++){const v=[position.getX(i+j),position.getY(i+j),position.getZ(i+j)];positions.push(...v);allowed.add(key(v));uv.push(source.attributes.uv.getX(i+j),source.attributes.uv.getY(i+j));if(source.attributes.color)colors.push(source.attributes.color.getX(i+j),source.attributes.color.getY(i+j),source.attributes.color.getZ(i+j));}
   }
   geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   if(colors.length)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
   geometry.userData.polygonEdges=(source.userData.polygonEdges||[]).filter((_,i,all)=>{const start=Math.floor(i/6)*6;return allowed.has(key(all.slice(start,start+3)))&&allowed.has(key(all.slice(start+3,start+6)));});
  }else geometry=source.clone();
  const texture=o.userData.textureMaterial??o.material;
  // Imported textures remain owned by the level; this scene owns only clones.
  const trview=p.palette==='trview'&&p.displayMode!=='texture';
  const material=trview?new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.FrontSide,wireframe:p.displayMode==='wire'}):p.displayMode==='texture'||(!isRoom&&p.displayMode==='color')?texture.clone():new THREE.MeshBasicMaterial({color:p.roomColors[room]??'#72899e',side:THREE.FrontSide,wireframe:p.displayMode==='wire'});
  const mesh=new THREE.Mesh(geometry,material);mesh.applyMatrix4(o.matrixWorld);scene.add(mesh);meshCount++;
  if(isRoom){if(!floorMeshes.has(room))floorMeshes.set(room,[]);floorMeshes.get(room).push(mesh);}
  if(isRoom&&p.displayMode==='color'){const edges=geometry.userData.polygonEdges??source.userData.polygonEdges;if(edges?.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(edges,3));const lines=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#233443',transparent:true,opacity:.65}));lines.applyMatrix4(o.matrixWorld);bindSurfaceEdges(lines,mesh);scene.add(lines);}}
 });
 function line(points,color,dashed=false){const g=new THREE.BufferGeometry().setFromPoints(points.map(toWorld));const m=dashed?new THREE.LineDashedMaterial({color,dashSize:span/90,gapSize:span/150,depthTest:false}):new THREE.LineBasicMaterial({color,depthTest:false});const o=new THREE.Line(g,m);o.renderOrder=10;o.computeLineDistances();scene.add(o);return o;}
 if(p.portals==='walls')for(const r of meta.rooms.filter(r=>rooms.has(r.roomId)))for(const portal of r.portals){
  if(portal.normal[1]!==0)continue;
  const points=portal.vertices.map(v=>[r.x+v[0],v[1],r.z+v[2]]);line([...points,points[0]],'#36cbd8').userData.svgStrokeWidth=1.5;
  for(let i=0;i<4;i++){const a=toWorld(points[i]),b=toWorld(points[(i+1)%4]),d=b.clone().sub(a);if(!d.length())continue;const edge=new THREE.Mesh(new THREE.CylinderGeometry(span/400,span/400,d.length(),6),new THREE.MeshBasicMaterial({color:'#36cbd8',depthTest:false}));edge.position.copy(a).add(b).multiplyScalar(.5);edge.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());edge.renderOrder=30;edge.userData.svgExclude=true;scene.add(edge);}
  if(p.portalLabels!==false)label(scene,`Portal ${r.roomId} / ${portal.room}`,toWorld(points[0]),'#36cbd8',unit);wallPortals++;
 }
 for(const shape of p.shapes){const g=new THREE.BufferGeometry().setFromPoints(shape.vertices.map(toWorld));g.setIndex(shape.triangles.flat());const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:shape.color,opacity:shape.opacity,transparent:true,depthWrite:false,side:THREE.DoubleSide}));scene.add(mesh);if(shape.label)label(scene,shape.label,toWorld(shape.labelPosition??shape.vertices[0]),shape.color,unit);}
 for(const r of p.regions){const [x,y,z]=r.center,d=r.radius,points=r.kind==='square'?[[x-d,y,z-d],[x+d,y,z-d],[x+d,y,z+d],[x-d,y,z+d],[x-d,y,z-d]]:Array.from({length:129},(_,i)=>[x+d*Math.sin(i*Math.PI/64),y,z+d*Math.cos(i*Math.PI/64)]);const col=r.color??evidenceColors[r.evidence];line(points,col,true);if(r.stroke===true)for(let i=1;i<points.length;i++){const a=toWorld(points[i-1]),b=toWorld(points[i]),d=b.clone().sub(a);const edge=new THREE.Mesh(new THREE.CylinderGeometry(span/900,span/900,d.length(),6),new THREE.MeshBasicMaterial({color:col,depthTest:false}));edge.position.copy(a).add(b).multiplyScalar(.5);edge.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());edge.renderOrder=10;scene.add(edge);}
  label(scene,r.label,toWorld(r.labelPosition??points[0]),col,unit);}
 for(const w of p.waypoints){const pos=toWorld(w.position),col=w.color??evidenceColors[w.evidence];const dot=new THREE.Mesh(new THREE.SphereGeometry(span/240,12,8),new THREE.MeshBasicMaterial({color:col,depthTest:false}));dot.position.copy(pos);dot.renderOrder=15;scene.add(dot);label(scene,w.label,w.labelPosition?toWorld(w.labelPosition):pos,col,unit);}
 for(const l of p.lines){const col=l.color??evidenceColors[l.evidence];line(l.points,col,l.evidence!=='measured');
  if(l.kind==='arrow'){const a=toWorld(l.points.at(-2)),b=toWorld(l.points.at(-1)),delta=b.clone().sub(a);if(delta.length()>1e-8){const arrow=new THREE.ArrowHelper(delta.normalize(),a,b.distanceTo(a),col,span/65,span/110);arrow.line.material.depthTest=false;arrow.cone.material.depthTest=false;arrow.renderOrder=15;scene.add(arrow);}}
  let text=l.label;if(l.kind==='measurement'){let length=0;for(let i=1;i<l.points.length;i++)length+=toWorld(l.points[i]).distanceTo(toWorld(l.points[i-1]));text+=` · ${length.toFixed(3)} squares / ${(length*1024).toFixed(1)} units`;}
  if(text)label(scene,text,toWorld(l.labelPosition??l.points[Math.floor(l.points.length/2)]),col,unit);
 }
 if(p.coordinates.local||p.coordinates.world){
  scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  for(const r of meta.rooms.filter(r=>rooms.has(r.roomId))){
   const walls=new Set(r.wallSectors||[]);
   for(let x=0;x<r.nx;x++)for(let z=0;z<r.nz;z++){
    if(walls.has(x*r.nz+z))continue;
    const X=r.x+(x+.5)*1024,Z=r.z+(z+.5)*1024;
    ray.set(toWorld([X,r.top-1024,Z]),down);
    const hit=ray.intersectObjects(floorMeshes.get(r.roomId)||[],false).find(h=>h.face?.normal.y>.15);
    if(!hit)continue;

    // Each square owns a small billboard; dimensions are in world units so it
    // stays aligned with the sector when the camera zooms or rotates.
    const rows=[];if(p.coordinates.local)rows.push(`R${r.roomId} ${x}/${z}`);
    if(p.coordinates.world)rows.push(`X ${X}`,`Z ${Z}`);
    const c=document.createElement('canvas');c.width=256;c.height=rows.length*34+12;
    const ctx=c.getContext('2d');ctx.fillStyle='#101720bb';ctx.fillRect(0,0,c.width,c.height);ctx.textAlign='center';ctx.fillStyle='#e9eef5';ctx.font='32px Segoe UI,Arial';rows.forEach((t,i)=>ctx.fillText(t,128,28+i*34));
    const texture=new THREE.CanvasTexture(c),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false}));
    sprite.userData.svgLabel={rows,color:'#e9eef5',width:c.width,height:c.height,fontSize:32,lineHeight:34,baseline:28,centered:true};
    sprite.position.copy(hit.point);sprite.scale.set(.88,c.height/256*.88,1);sprite.renderOrder=5;scene.add(sprite);coordinateLabels++;
   }
  }
 }
 return {scene,camera,config:p,stats:{meshes:meshCount,wallPortals,coordinateLabels,waypoints:p.waypoints.length},dispose(){scene.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat())if(m){if(o.isSprite)m.map?.dispose();m.dispose();}});}};
}

export function renderPresentation(presentation){
 const {scene,camera,config}=presentation,{width,height}=config.output;
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 try{renderer.setPixelRatio(1);renderer.setSize(width,height);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.render(scene,camera);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.drawImage(renderer.domElement,0,0);
  ctx.fillStyle='#101720ed';ctx.fillRect(0,0,width,48);ctx.fillRect(0,height-32,width,32);ctx.fillStyle='#edf4fa';ctx.font='600 22px Segoe UI,Arial';ctx.fillText(config.title,20,32);
  ctx.font='14px Segoe UI,Arial';ctx.fillText(config.legend??'Red: motion / measured · Blue: facing · Purple: model · Amber: reported · Green: static placement | Wall portals only',20,height-11);
  return {dataURL:canvas.toDataURL('image/png'),width,height,stats:presentation.stats};
 }finally{renderer.dispose();renderer.forceContextLoss();}
}
