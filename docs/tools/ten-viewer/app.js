import {VIEWER_NAME,setupViewerInfo} from './viewer-info.js';
import {importLevel} from './level-import.js';
import {cacheLevel,restoreSession,writeView,forgetSession} from './session-cache.js';
import {HoverInfo} from './hover-info.js';
import {markWaterOpenings,hideWaterOpenings} from './water.js';
import * as THREE from 'three';

import {OrbitControls} from './vendor/OrbitControls.js';

import {SectorInspector} from './sector-inspector.js';
import {RoomMap} from './room-map.js';




const $ = id => document.getElementById(id);

const canvas = $('canvas');
const roomMap = new RoomMap($('mapCanvas'),$('mapTitle'),$('mapDetails'));

const renderer = new THREE.WebGLRenderer({canvas, antialias:true});

renderer.setPixelRatio(Math.min(devicePixelRatio,2));

renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
renderer.localClippingEnabled=true;
const inspector=new SectorInspector(scene,$('sectorInfo'));
roomMap.onSelect=(x,z)=>selectSector(x,z);

scene.background = new THREE.Color('#101720');

const camera = new THREE.PerspectiveCamera(45,1,0.008,1500);

const controls = new OrbitControls(camera,canvas);

controls.enableDamping = true;

controls.dampingFactor = 0.1;

controls.minDistance = 0.05;

controls.maxDistance = 1000;

scene.add(new THREE.HemisphereLight(0xdce8ff,0x77746c,2.0));

const sun = new THREE.DirectionalLight(0xffffff,2.0);

sun.position.set(100,180,80);scene.add(sun);

let world, meta, selected=0, mode='texture', fly=false;

const roomGroups = new Map(), meshes=[], textureMaterials=new Set(), portalGroups=new Map(), volumeGroups=new Map(), boundGroups=new Map(), triggerGroups=new Map(), triggerMeshes=[], hoverOverlays=[];

// TRView Graphics/TextureStorage.cpp: 256x256 white tile with a black border.

const gridPixels=new Uint8Array(256*256*4).fill(255);

for(let y=0;y<256;y++)for(let x=0;x<256;x++){

  if(x===0||x===255||y===0||y===255){const p=(y*256+x)*4;gridPixels[p]=gridPixels[p+1]=gridPixels[p+2]=0;}

}

const gridTexture=new THREE.DataTexture(gridPixels,256,256);

gridTexture.channel=1;gridTexture.wrapS=gridTexture.wrapT=THREE.RepeatWrapping;

gridTexture.magFilter=THREE.LinearFilter;gridTexture.minFilter=THREE.LinearMipmapLinearFilter;

gridTexture.generateMipmaps=true;gridTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());

gridTexture.needsUpdate=true;

const palette = id => new THREE.Color().setHSL(((id*0.61803398875)+0.06)%1,0.42,0.56);

// TRView MapColours.cpp: Special::Default (0,.7,.7), GeometryWall (0,.6,.15).

// Applied to visible TEN surfaces, not claimed to be a TRView collision mesh.

const trviewColors={surface:new THREE.Color('#00b3b3'),wall:new THREE.Color('#009926'),water:new THREE.Color('#176ec2'),object:new THREE.Color('#999999')};

const status = $('loading');

const raycaster = new THREE.Raycaster();

const clock = new THREE.Clock();

const keys = new Set();

const forward = new THREE.Vector3(),right = new THREE.Vector3(),delta = new THREE.Vector3();

const look = new THREE.Euler(0,0,0,'YXZ');

let dragging=false,lastX=0,lastY=0,downPoint=null;



function resize(){const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}

new ResizeObserver(resize).observe($('viewport'));

function ancestorData(obj,key){while(obj){if(obj.userData[key]!==undefined)return obj.userData;obj=obj.parent;}return {};}

function roomName(room){return room.name.replace(/^Etage\s+/i,'Floor ');}
function getRoom(id){return meta?.rooms.find(r=>r.roomId===id);}

function selectedBox(){const group=roomGroups.get(selected);const geometry=group.children.find(o=>o.userData.kind==='geometry');return new THREE.Box3().setFromObject(geometry||group);}

function fit(box){

  if(box.isEmpty())return;

  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());

  const verticalFov=THREE.MathUtils.degToRad(camera.fov), horizontalFov=2*Math.atan(Math.tan(verticalFov/2)*camera.aspect);

  const distance=size.length()/2/Math.sin(Math.min(verticalFov,horizontalFov)/2)*1.1;

  camera.position.copy(center).addScaledVector(new THREE.Vector3(1,0.7,1).normalize(),Math.max(3,distance));

  camera.lookAt(center);controls.target.copy(center);controls.update();

}

function focusRoom(){if(world){fit(selectedBox());$('pick').textContent='';}}

function selectSector(x,z){
  if(!meta)return;const r=getRoom(selected);if(x<0||z<0||x>=r.nx||z>=r.nz)return;
  roomMap.selection=[x,z];roomMap.lastDraw=0;inspector.select(r,x,z,meta,roomGroups.get(selected),{objects:$('objects').checked,triggers:$('triggers').checked,portals:$('portals').checked,volumes:$('volumes').checked,geometryMode:mode!=='texture'});
}
function selectRoom(id,focus=true){
  if(!meta||!getRoom(id))return;
  if(id!==selected)inspector.clear();

  selected=id;const r=getRoom(id);roomMap.setRoom(r,roomName(r));

  $('selectedName').textContent=`${id} · ${roomName(r)}`;

  $('selectedDetails').textContent=`${r.nx} × ${r.nz} sectors · ${r.portals.length} portals · Height ${Math.round(-r.bottom)} to ${Math.round(-r.top)} level units`;

  document.querySelectorAll('.room-button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.id===id)));

  updateVisibility();if(focus)focusRoom();

}

function updateVisibility(){
  hoverInfo.invalidate();

  if(!meta)return;

  const alternatives=new Set(meta.rooms.filter(r=>r.flipped>=0).map(r=>r.flipped));

  const replaced=new Set(meta.rooms.filter(r=>r.flipped>=0).map(r=>r.roomId));

  for(const r of meta.rooms){

    const active=$('flipped').checked?!replaced.has(r.roomId):!alternatives.has(r.roomId);

    const visible=$('isolate').checked?r.roomId===selected:(active||r.roomId===selected);

    roomGroups.get(r.roomId).visible=visible;

    portalGroups.get(r.roomId).visible=visible&&$('portals').checked;

    volumeGroups.get(r.roomId).visible=visible&&$('volumes').checked;

    boundGroups.get(r.roomId).visible=visible&&$('bounds').checked;
    triggerGroups.get(r.roomId).visible=visible&&$('triggers').checked;

  }

  world.traverse(o=>{if(['moveable','static','sprite'].includes(o.userData.kind))o.visible=$('objects').checked;});
  if(roomMap.selection)selectSector(...roomMap.selection);

}

function setMode(next){
  hoverInfo.invalidate();

  mode=next;

  const trview=$('palette').value==='trview';

  $('paletteLabel').hidden=mode==='texture';$('legend').hidden=mode==='texture'||!trview;

  $('outlinesLabel').hidden=mode!=='color';

  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));

  for(const mesh of meshes){

    const kind=ancestorData(mesh,'kind').kind;

    const roomSurface=kind==='geometry'||kind==='room';

    mesh.material=mode==='texture'?mesh.userData.textureMaterial:mode==='color'?

      (trview?mesh.userData.trviewMaterial:mesh.userData.colorMaterial):

      (trview?mesh.userData.trviewWireMaterial:mesh.userData.wireMaterial);

    const side=THREE.FrontSide;

    mesh.material.side=side;mesh.material.needsUpdate=true;
    mesh.userData.wireDepth.visible=mode==='wire';

    if(mode==='color'){

      mesh.material.map=$('outlines').checked&&roomSurface?gridTexture:null;

    }

    for(const material of [mesh.userData.colorMaterial,mesh.userData.trviewMaterial])

      material.userData.edgeEnabled.value=mode==='color'&&$('outlines').checked&&!roomSurface?1:0;

  }

  if(roomMap.selection)selectSector(...roomMap.selection);
}

function preserveTextureAlpha(shader){
  hideWaterOpenings(shader);

  // THREE alphaMap normally reads green; TEN cutouts use the atlas alpha channel.

  shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>',

    THREE.ShaderChunk.alphamap_fragment.replace('.g;', '.a;'));

}

function addOutlines(){

  for(const mesh of meshes){

    const geometry=mesh.geometry;

    if(!geometry.attributes.edgeBarycentric){

      const edges=geometry.userData.polygonEdges;

      if(!edges)throw new Error('Polygon grid missing. Please export the model again.');

      const pointKey=p=>p.map(v=>Math.fround(v)).join(',');

      const edgeKey=(a,b)=>[pointKey(a),pointKey(b)].sort().join('|');

      const borders=new Set();

      for(let i=0;i<edges.length;i+=6)borders.add(edgeKey(edges.slice(i,i+3),edges.slice(i+3,i+6)));

      const position=geometry.attributes.position;

      const barycentric=new Float32Array(position.count*3),mask=new Float32Array(position.count*3);

      for(let i=0;i<position.count;i+=3){

        const points=[0,1,2].map(j=>[position.getX(i+j),position.getY(i+j),position.getZ(i+j)]);

        const enabled=[0,1,2].map(j=>borders.has(edgeKey(points[(j+1)%3],points[(j+2)%3]))?1:0);

        for(let j=0;j<3;j++){barycentric[(i+j)*3+j]=1;mask.set(enabled,(i+j)*3);}

      }

      geometry.setAttribute('edgeBarycentric',new THREE.BufferAttribute(barycentric,3));

      geometry.setAttribute('edgeMask',new THREE.BufferAttribute(mask,3));

    }

    for(const material of [mesh.userData.colorMaterial,mesh.userData.trviewMaterial]){

      // Borders are part of the surface, so backface culling removes them too.

      material.userData.edgeEnabled={value:0};

      // Keep the TRView tile borders legible when a sector covers few pixels.

      material.onBeforeCompile=shader=>{

        preserveTextureAlpha(shader);

        shader.uniforms.edgeEnabled=material.userData.edgeEnabled;

        shader.vertexShader='attribute vec3 edgeBarycentric; attribute vec3 edgeMask; varying vec3 vEdgeBarycentric; varying vec3 vEdgeMask;\n'+shader.vertexShader;

        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvEdgeBarycentric=edgeBarycentric; vEdgeMask=edgeMask;');

        shader.fragmentShader='uniform float edgeEnabled; varying vec3 vEdgeBarycentric; varying vec3 vEdgeMask;\n'+shader.fragmentShader;

        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>

          #ifdef USE_MAP

            vec2 tileDistance = abs(fract(vMapUv - 0.5) - 0.5) / max(fwidth(vMapUv), vec2(0.00001));

            float tileBorder = 1.0 - smoothstep(0.35, 0.95, min(tileDistance.x, tileDistance.y));

            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.005), tileBorder);

          #endif

          if(edgeEnabled > 0.5){

            vec3 distanceToEdge = vEdgeBarycentric / max(fwidth(vEdgeBarycentric), vec3(0.00001));

            vec3 borders = (1.0 - smoothstep(vec3(0.35), vec3(0.95), distanceToEdge)) * vEdgeMask;

            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.005), max(borders.x, max(borders.y, borders.z)));

          }`);

      };

    }

  }

}

function trviewVertexColors(mesh){

  const geometry=mesh.geometry,position=geometry.attributes.position,normal=geometry.attributes.normal;

  const colors=new Float32Array(position.count*3);

  const kind=ancestorData(mesh,'kind').kind;

  const isRoom=kind==='geometry'||kind==='room';

  const room=isRoom?getRoom(ancestorData(mesh,'roomId').roomId):null;

  const wallSectors=new Set(room?.wallSectors||[]);

  mesh.userData.waterOpeningTriangles=markWaterOpenings(geometry,room,meta.rooms);
  const values={surface:0,wall:0,water:0,object:0};

  for(let i=0;i<position.count;i+=3){

    const ny=normal.getY(i),nx=normal.getX(i),nz=normal.getZ(i);

    // Test the sector just behind the face: steps inside open sectors are surfaces.

    // Positions are room-local; convert glTF Z back to TEN for sector indices.

    const cx=(position.getX(i)+position.getX(i+1)+position.getX(i+2))/3;

    const cz=(position.getZ(i)+position.getZ(i+1)+position.getZ(i+2))/3;

    const sx=Math.floor(cx-nx*0.001),sz=Math.floor(-cz+nz*0.001);

    const fullWall=isRoom&&Math.abs(ny)<0.15&&sx>=0&&sx<room.nx&&sz>=0&&sz<room.nz&&wallSectors.has(sx*room.nz+sz);

    const category=!isRoom?'object':(room.flags&1)?'water':fullWall?'wall':'surface';

    const c=trviewColors[category].clone();

    // Mild directional shading keeps steps and diagonal faces distinguishable.

    const shade=0.7+0.3*Math.abs(nx*0.35+ny*0.85+nz*0.4);c.multiplyScalar(shade);

    for(let j=i;j<Math.min(i+3,position.count);j++)c.toArray(colors,j*3);

    values[category]++;

  }

  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));

  mesh.userData.trviewFaceCounts=values;

}

function setFlight(value){

  fly=value;keys.clear();controls.enabled=!fly;

  $('orbit').setAttribute('aria-pressed',String(!fly));$('fly').setAttribute('aria-pressed',String(fly));

  $('speedLabel').style.display=fly?'flex':'none';

  $('help').textContent=fly?'Drag: look · WASD: fly · Q/E: down/up · Shift: faster':'Drag: rotate · Right-drag: pan · Scroll: zoom';

  if(!fly){camera.getWorldDirection(forward);controls.target.copy(camera.position).addScaledVector(forward,5);controls.update();}

  canvas.focus();

}

function addTriggers(){
  const material=new THREE.MeshBasicMaterial({color:0xb052ff,transparent:true,opacity:0.65,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  for(const r of meta.rooms){
    const group=new THREE.Group();triggerGroups.set(r.roomId,group);scene.add(group);
    for(const t of r.triggers||[]){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(t.vertices,3));
      const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=3;mesh.userData={roomId:r.roomId,trigger:t};group.add(mesh);triggerMeshes.push(mesh);
    }
  }
}
function addBounds(){

  const materials={reference:new THREE.LineBasicMaterial({color:0xffffff,depthTest:false}),collision:new THREE.LineBasicMaterial({color:0xffffff,depthTest:false})};

  for(const r of meta.rooms){const group=new THREE.Group();scene.add(group);boundGroups.set(r.roomId,group);}

  for(const entry of meta.bounds||[]){

    const b=entry.bounds,lo=new THREE.Vector3(b[0],-b[3],-b[5]).divideScalar(1024),hi=new THREE.Vector3(b[1],-b[2],-b[4]).divideScalar(1024);

    const box=new THREE.Box3Helper(new THREE.Box3(lo,hi));box.material=materials[entry.kind];box.renderOrder=5;

    const group=new THREE.Group();group.position.fromArray(entry.position);group.quaternion.fromArray(entry.rotation);group.scale.setScalar(entry.scale);group.name=entry.name;

    box.userData.hover={kind:'overlay',text:`Bounds: ${entry.name||'Unnamed'}\nRoom ${entry.room} · ${entry.kind==='reference'?'Reference pose':'Static collision'}`};hoverOverlays.push(box);
    group.add(box);boundGroups.get(entry.room).add(group);

  }

}

function addOverlays(){

  const pm=new THREE.LineBasicMaterial({color:0x84e5f8,depthTest:false,transparent:true,opacity:0.85});

  const vm=new THREE.LineBasicMaterial({color:0xf0be72,depthTest:false,transparent:true,opacity:0.7});

  for(const r of meta.rooms){

    const portals=new THREE.Group(),volumes=new THREE.Group();

    for(const p of r.portals){

      const pts=p.vertices.map(v=>new THREE.Vector3((r.x+v[0])/1024,-v[1]/1024,-(r.z+v[2])/1024));pts.push(pts[0]);

      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),pm);line.userData.hover={kind:'overlay',text:`Portal: Room ${r.roomId} → Room ${p.room}`};hoverOverlays.push(line);portals.add(line);

    }

    for(const v of r.volumes){

      const edges=new THREE.EdgesGeometry(new THREE.BoxGeometry(v.scale[0]*2/1024,v.scale[1]*2/1024,v.scale[2]*2/1024));

      const box=new THREE.LineSegments(edges,vm);box.position.set(v.pos[0]/1024,-v.pos[1]/1024,-v.pos[2]/1024);

      box.quaternion.set(v.rot[0],-v.rot[1],-v.rot[2],v.rot[3]);box.userData.hover={kind:'overlay',text:`Event volume: ${v.name}\nRoom ${r.roomId} · Event set ${v.event}`};hoverOverlays.push(box);volumes.add(box);

    }

    scene.add(portals,volumes);portalGroups.set(r.roomId,portals);volumeGroups.set(r.roomId,volumes);

  }

}

function disposeScene(root){
  if(!root)return;
  const geometries=new Set(),materials=new Set(),textures=new Set();
  root.traverse(o=>{
    if(o.geometry)geometries.add(o.geometry);
    for(const m of [o.material,...Object.values(o.userData).filter(v=>v?.isMaterial)].flat())if(m?.isMaterial)materials.add(m);
  });
  for(const m of materials){for(const v of Object.values(m))if(v?.isTexture&&v!==gridTexture)textures.add(v);m.dispose();}
  for(const t of textures)t.dispose();for(const g of geometries)g.dispose();root.removeFromParent();
}
function clearLevel(){
  inspector.clear();hoverInfo.invalidate();
  for(const map of [portalGroups,volumeGroups,boundGroups,triggerGroups]){for(const group of map.values())disposeScene(group);map.clear();}
  disposeScene(world);world=null;meta=null;roomGroups.clear();meshes.length=0;triggerMeshes.length=0;hoverOverlays.length=0;textureMaterials.clear();
  roomMap.room=null;roomMap.selection=null;roomMap.lastDraw=0;keys.clear();dragging=false;
  $('rooms').replaceChildren();$('search').value='';$('pick').textContent='';
}
function installLevel(result){
    clearLevel();world=result.world;meta=result.meta;selected=meta.rooms[0].roomId;scene.add(world);
    document.title=`${meta.source} | ${VIEWER_NAME}`;$('levelName').textContent=meta.source;
    $('formatName').textContent=`Geometry Explorer · ${meta.format.label}`;
    $('volumes').disabled=!meta.format.capabilities.eventVolumes;
    $('volumes').parentElement.title=$('volumes').disabled?'This format has no event volumes.':'';
    if($('volumes').disabled)$('volumes').checked=false;
    world.traverse(o=>{

      if(o.userData.kind==='room')roomGroups.set(o.userData.roomId,o);

      if(!o.isMesh)return;

      if(!o.geometry.attributes.normal)o.geometry.computeVertexNormals();

      const id=ancestorData(o,'roomId').roomId;

      o.userData.textureMaterial=o.material;textureMaterials.add(o.material);

      trviewVertexColors(o);

      o.userData.trviewMaterial=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});

      o.userData.trviewWireMaterial=new THREE.MeshBasicMaterial({vertexColors:true,wireframe:true,side:THREE.DoubleSide});

      o.userData.colorMaterial=new THREE.MeshLambertMaterial({color:palette(id),side:THREE.DoubleSide,flatShading:true});

      o.userData.wireMaterial=new THREE.MeshBasicMaterial({color:palette(id).lerp(new THREE.Color(0xffffff),0.3),wireframe:true,side:THREE.DoubleSide});

      for(const material of [o.userData.trviewMaterial,o.userData.trviewWireMaterial,o.userData.colorMaterial,o.userData.wireMaterial]){

        material.alphaMap=o.userData.textureMaterial.map;

        material.alphaTest=o.userData.textureMaterial.alphaTest;

        material.onBeforeCompile=preserveTextureAlpha;

      }

      meshes.push(o);

    });

    // Fill the depth buffer before drawing wire edges or selection overlays.
    // Children inherit the source mesh transform and room/object visibility.
    for(const mesh of meshes){
      const material=new THREE.MeshBasicMaterial({side:THREE.FrontSide,colorWrite:false,
        alphaMap:mesh.userData.textureMaterial.map,alphaTest:mesh.userData.textureMaterial.alphaTest,
        polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
      material.onBeforeCompile=preserveTextureAlpha;
      const depth=new THREE.Mesh(mesh.geometry,material);depth.renderOrder=-1;depth.visible=false;
      depth.userData.wireDepthOnly=true;mesh.add(depth);mesh.userData.wireDepth=depth;
      mesh.userData.wireMaterial.depthWrite=false;mesh.userData.trviewWireMaterial.depthWrite=false;
    }

    for(const r of meta.rooms){

      const button=document.createElement('button');button.className='room-button';button.dataset.id=r.roomId;button.setAttribute('aria-pressed','false');button.title=roomName(r);button.dataset.originalName=r.name;

      const swatch=document.createElement('span');swatch.className='swatch';swatch.style.background=palette(r.roomId).getStyle();

      const number=document.createElement('span');number.className='number';number.textContent=`#${r.roomId}`;

      const label=document.createElement('span');label.className='room-label';label.textContent=roomName(r);

      button.append(swatch,number,label);button.addEventListener('click',()=>selectRoom(r.roomId));$('rooms').append(button);

    }

    $('roomCount').textContent=meta.rooms.length;

    addOutlines();addOverlays();addBounds();addTriggers();resize();selectRoom(selected);setMode(mode);setFlight(true);status.hidden=true;

    $('stats').textContent=`${meta.rooms.length} Rooms · ${meta.items.length} Objects`;

    window.viewerReady=true;

    window.viewerDiagnostics=()=>({hoverChecks:hoverInfo.checks,hoverMilliseconds:hoverInfo.lastCost,mode,selected,fly,rooms:roomGroups.size,meshes:meshes.length,

      visibleRooms:[...roomGroups].filter(([,r])=>r.visible).map(([id])=>id),

      camera:camera.position.toArray(),palette:$('palette').value,

      outlines:mode==='color'&&$('outlines').checked,
      selectedSector:roomMap.selection||null,waterOpeningTriangles:meshes.reduce((n,m)=>n+m.userData.waterOpeningTriangles,0),triggers:triggerMeshes.length,visibleTriggerRooms:[...triggerGroups].filter(([,g])=>g.visible).map(([id])=>id),

      trviewFaceCounts:meshes.reduce((out,m)=>{for(const [k,v] of Object.entries(m.userData.trviewFaceCounts))out[k]=(out[k]||0)+v;return out;},{}),

      textures:[...textureMaterials].filter(m=>m.map?.image).length,

      drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});

}

let importController=null,importNumber=0;
function emptyMessage(){status.textContent='Open or drop a TEN or TR3 level here. Files stay on your device. Supported: TEN 1.10.1.0 and TR3 PC (.tr2).';status.hidden=false;}
async function openFile(file,restoredView){
  if(!file)return;
  const number=++importNumber;importController?.abort();const controller=new AbortController();importController=controller;
  window.viewerReady=false;$('cancelImport').hidden=false;status.setAttribute('role','status');status.hidden=false;
  status.textContent=`Reading ${file.name}…`;
  try{
    const result=await importLevel(file,message=>{if(number===importNumber)status.textContent=message;},controller.signal);
    if(number!==importNumber){disposeScene(result.world);return;}
    status.textContent='Preparing the view…';await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
    if(number!==importNumber){disposeScene(result.world);return;}
    installLevel(result);
    if(restoredView)applyView(restoredView);
    try{
      await cacheLevel(file,()=>number===importNumber);
      if(number===importNumber)saveView();
    }catch{
      if(number===importNumber){forgetSession();status.textContent='Level opened. Browser storage is unavailable or full; reload recovery is not available.';status.hidden=false;}
    }
    if(number!==importNumber)return;
    if(parent!==window&&location.protocol!=='file:')parent.postMessage({type:'ten-viewer:loaded',name:file.name,rooms:meta.rooms.length,objects:meta.items.length},location.origin);
  }catch(error){
    if(number!==importNumber)return;
    if(error.name==='AbortError'){if(meta)status.hidden=true;else emptyMessage();}
    else{status.textContent=error.message;status.setAttribute('role','alert');status.hidden=false;}
    window.viewerReady=!!world;
  }finally{if(number===importNumber){$('cancelImport').hidden=true;importController=null;}}
}
$('openLevel').onclick=()=>$('levelFile').click();
$('levelFile').onchange=event=>{openFile(event.target.files[0]);event.target.value='';};
$('cancelImport').onclick=()=>importController?.abort();
status.onclick=()=>{if(meta&&status.getAttribute('role')==='alert')status.hidden=true;};
$('helpButton').onclick=()=>$('viewerHelp').showModal();
$('closeHelp').onclick=()=>$('viewerHelp').close();
let dragDepth=0;
window.addEventListener('dragenter',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();dragDepth++;$('dropHint').hidden=false;}});
window.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
window.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;$('dropHint').hidden=true;}});
window.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('dropHint').hidden=true;const files=[...e.dataTransfer.files];if(files.length===1)openFile(files[0]);else{status.textContent='Drop one level at a time.';status.hidden=false;}});
window.tenViewer={openFile,selectRoom,selectSector};
window.addEventListener('message',event=>{
  if(event.source!==parent||parent===window||location.protocol==='file:'||event.origin!==location.origin)return;
  const data=event.data;if(data?.type==='ten-viewer:open'&&data.file instanceof File)openFile(data.file);
  if(data?.type==='ten-viewer:select'&&Number.isInteger(data.room)&&getRoom(data.room)){selectRoom(data.room);if(Array.isArray(data.sector)&&data.sector.length===2&&data.sector.every(Number.isInteger))selectSector(...data.sector);}
});
if(parent!==window&&location.protocol!=='file:')parent.postMessage({type:'ten-viewer:ready'},location.origin);

document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));

$('mapToggle').onchange=()=>{$('roomMap').hidden=!$('mapToggle').checked;};
$('focus').onclick=focusRoom;

$('inside').onclick=()=>{if(!world)return;const box=selectedBox(),c=box.getCenter(new THREE.Vector3());camera.position.copy(c);camera.lookAt(c.clone().add(new THREE.Vector3(0,0,-1)));setFlight(true);};

$('overview').onclick=()=>{if(!world)return;$('isolate').checked=false;updateVisibility();const box=new THREE.Box3();for(const r of roomGroups.values())if(r.visible)box.union(new THREE.Box3().setFromObject(r));fit(box);};

$('orbit').onclick=()=>setFlight(false);$('fly').onclick=()=>setFlight(true);

$('fov').oninput=()=>{camera.fov=Number($('fov').value);camera.updateProjectionMatrix();$('fovValue').value=camera.fov;hoverInfo.invalidate();};
$('speed').oninput=()=>{$('speedValue').value=$('speed').value;};

for(const name of ['isolate','objects','flipped','portals','volumes','bounds','triggers'])$(name).onchange=updateVisibility;


$('palette').onchange=()=>setMode(mode);

$('outlines').onchange=()=>setMode(mode);

$('search').oninput=()=>{
  const q=$('search').value.trim().toLowerCase();
  const roomId=/^#\s*(\d+)$/.exec(q);
  document.querySelectorAll('.room-button').forEach(b=>{
    b.hidden=roomId?Number(b.dataset.id)!==Number(roomId[1]):!(`${b.dataset.id} ${b.textContent} ${b.dataset.originalName}`.toLowerCase().includes(q));
  });
};

$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){$('pick').textContent='Fullscreen is not available in this browser view.';}};

canvas.addEventListener('contextmenu',e=>e.preventDefault());

canvas.addEventListener('pointerdown',e=>{canvas.focus();downPoint=[e.clientX,e.clientY];if(fly){dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);}});

canvas.addEventListener('pointermove',e=>{if(!fly||!dragging)return;look.setFromQuaternion(camera.quaternion,'YXZ');look.y-=(e.clientX-lastX)*0.003;look.x-=(e.clientY-lastY)*0.003;look.x=THREE.MathUtils.clamp(look.x,-Math.PI/2+0.01,Math.PI/2-0.01);camera.quaternion.setFromEuler(look);lastX=e.clientX;lastY=e.clientY;});

canvas.addEventListener('pointerup',e=>{

  dragging=false;if(!world||!downPoint||Math.hypot(e.clientX-downPoint[0],e.clientY-downPoint[1])>5)return;

  const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);

  const hits=raycaster.intersectObjects([...triggerMeshes,...meshes],false).filter(h=>{if(mode!=='texture'&&h.object.geometry.attributes.waterOpening?.getX(h.faceIndex*3)>0.5)return false;let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;});

  if(hits.length&&hits[0].object.userData.trigger){const data=hits[0].object.userData,t=data.trigger;selectRoom(data.roomId,false);selectSector(t.x,t.z);$('pick').textContent=`Room ${data.roomId} · Trigger ${t.index} · Sector ${t.x}, ${t.z}`;return;}
  if(hits.length){const hit=hits[0],r=ancestorData(hit.object,'roomId'),item=ancestorData(hit.object,'itemId');selectRoom(r.roomId,false);const room=getRoom(r.roomId);selectSector(Math.floor(hit.point.x-room.x/1024),Math.floor(-hit.point.z-room.z/1024));$('pick').textContent=`Room ${r.roomId} · ${roomName(getRoom(r.roomId))}${item.itemId!==undefined?` · Object ${item.itemId}, Slot ${item.slot}`:''} · Level (${Math.round(hit.point.x*1024)}, ${Math.round(-hit.point.y*1024)}, ${Math.round(-hit.point.z*1024)})`;}

});

canvas.addEventListener('pointercancel',()=>dragging=false);

window.addEventListener('keydown',e=>{if(document.activeElement!==canvas)return;if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight'].includes(e.code)){keys.add(e.code);e.preventDefault();}if(e.code==='KeyF')focusRoom();});

window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();dragging=false;});canvas.addEventListener('blur',()=>keys.clear());

const alphaImages=new WeakMap();
function hoverAccept(hit){
  const g=hit.object.geometry;
  if(mode!=='texture'&&g.attributes.waterOpening?.getX(hit.faceIndex*3)>0.5)return false;
  const material=hit.object.userData.textureMaterial,texture=material?.map;
  if(!hit.uv||!texture?.image||!material.alphaTest)return true;
  let pixels=alphaImages.get(texture.image);
  if(pixels===undefined){
    try{if(texture.image.data){pixels={data:texture.image.data,w:texture.image.width,h:texture.image.height};}else{const c=document.createElement('canvas');c.width=texture.image.width;c.height=texture.image.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(texture.image,0,0);pixels={data:ctx.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height};}}catch{pixels=null;}
    alphaImages.set(texture.image,pixels);
  }
  if(!pixels)return true;
  const uv=hit.uv.clone();texture.transformUv(uv);
  const x=Math.max(0,Math.min(pixels.w-1,Math.floor(uv.x*pixels.w))),y=Math.max(0,Math.min(pixels.h-1,Math.floor(uv.y*pixels.h)));
  return pixels.data[(y*pixels.w+x)*4+3]/255>=material.alphaTest;
}
const hoverInfo=new HoverInfo(canvas,$('hoverInfo'),camera,()=>[...triggerMeshes,...meshes,...hoverOverlays],hit=>{
  if(hit.object.userData.hover)return hit.object.userData.hover;
  const data=ancestorData(hit.object,'roomId'),room=getRoom(data.roomId);if(!room)return null;
  const trigger=hit.object.userData.trigger;
  if(trigger)return {kind:'trigger',text:`Trigger ${trigger.index}\nRoom ${room.roomId} · ${roomName(room)}\nSector ${trigger.x}, ${trigger.z}`};
  const item=ancestorData(hit.object,'itemId');
  if(item.itemId!==undefined){const entry=meta.items.find(i=>i.id===item.itemId);return {kind:'object',text:`Item ${item.itemId} · ${entry?.name||'Unnamed'}\nSlot ${item.slot} · Room ${room.roomId}`};}
  const kind=ancestorData(hit.object,'kind');
  if(kind.kind==='static')return {kind:'object',text:`Static · Slot ${kind.slot}\nRoom ${room.roomId}`};
  return {kind:'room',text:`Room ${room.roomId} · ${roomName(room)}\nSector ${Math.floor(hit.point.x-room.x/1024)}, ${Math.floor(-hit.point.z-room.z/1024)}`};
},hoverAccept);
function frame(){

  requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),0.05);

  if(fly){

    camera.getWorldDirection(forward);right.crossVectors(forward,camera.up).normalize();delta.set(0,0,0);

    if(keys.has('KeyW'))delta.add(forward);if(keys.has('KeyS'))delta.sub(forward);if(keys.has('KeyD'))delta.add(right);if(keys.has('KeyA'))delta.sub(right);if(keys.has('KeyE'))delta.y+=1;if(keys.has('KeyQ'))delta.y-=1;

    const boost=keys.has('ShiftLeft')||keys.has('ShiftRight')?3:1;if(delta.lengthSq())camera.position.addScaledVector(delta.normalize(),+$('speed').value*dt*boost);

  }else controls.update();
  for(const billboard of world?.userData.billboards||[])billboard.quaternion.copy(camera.quaternion);
  renderer.render(scene,camera);
  if(meta)hoverInfo.update(keys.size>0);
  if(meta&&$('mapToggle').checked)roomMap.draw(camera,{triggers:$('triggers').checked,objects:$('objects').checked,items:meta.bounds});

}

const savedControls=['fov','speed','palette','outlines','mapToggle','isolate','objects','flipped','bounds','triggers','portals','volumes','search'];
function saveView(){
  if(!meta)return;
  writeView({selected,sector:roomMap.selection,mode,fly,position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),target:controls.target.toArray(),
    controls:Object.fromEntries(savedControls.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value]))});
}
function applyView(view){
  for(const id of savedControls){const value=view.controls?.[id];if(value===undefined||$(id).disabled)continue;
    if($(id).type==='checkbox')$(id).checked=!!value;else $(id).value=value;
  }
  $('fov').oninput();$('speed').oninput();$('mapToggle').onchange();$('search').oninput();
  if(getRoom(view.selected))selectRoom(view.selected,false);
  setMode(['texture','color','wire'].includes(view.mode)?view.mode:'texture');setFlight(view.fly!==false);
  const vector=(value,length)=>Array.isArray(value)&&value.length===length&&value.every(Number.isFinite);
  if(vector(view.position,3))camera.position.fromArray(view.position);
  if(vector(view.quaternion,4))camera.quaternion.fromArray(view.quaternion).normalize();
  if(vector(view.target,3))controls.target.fromArray(view.target);
  if(!fly)controls.update();
  updateVisibility();
  if(vector(view.sector,2)&&view.sector.every(Number.isInteger))selectSector(...view.sector);
}
window.addEventListener('pagehide',saveView);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveView();});
document.addEventListener('change',saveView);
document.addEventListener('input',saveView);
// Camera movement and canvas selections do not necessarily emit input events.
setInterval(saveView,1000);
setupViewerInfo();
resize();frame();setFlight(true);emptyMessage();
const restoreNumber=importNumber;
restoreSession().then(saved=>{if(saved&&importNumber===restoreNumber)return openFile(saved.file,saved.view);}).catch(()=>{/* Manual import remains available. */});
