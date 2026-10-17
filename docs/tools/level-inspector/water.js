import * as THREE from 'three';

export function markWaterOpenings(geometry,room,rooms){
  const position=geometry.attributes.position,mask=new Float32Array(position.count);
  const portals=(room?.portals||[]).filter(p=>((room.flags|rooms.find(r=>r.roomId===p.room)?.flags)&1)&&Math.abs(p.normal[1])>0).map(p=>{
    const box=new THREE.Box3();for(const v of p.vertices)box.expandByPoint(new THREE.Vector3(v[0],-v[1],-v[2]).divideScalar(1024));
    box.expandByScalar(2/1024);return box;
  });
  const point=new THREE.Vector3();let count=0;
  for(let i=0;i<position.count;i+=3){
    if(portals.some(box=>[0,1,2].every(j=>box.containsPoint(point.fromBufferAttribute(position,i+j))))){mask.fill(1,i,i+3);count++;}
  }
  geometry.setAttribute('waterOpening',new THREE.BufferAttribute(mask,1));return count;
}
export function hideWaterOpenings(shader){
  shader.vertexShader='attribute float waterOpening; varying float vWaterOpening;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWaterOpening=waterOpening;');
  shader.fragmentShader='varying float vWaterOpening;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vWaterOpening>0.5) discard;');
}
