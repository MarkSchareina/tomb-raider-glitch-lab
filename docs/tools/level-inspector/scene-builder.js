// Format-neutral inspection scene builder. No renderer or browser dependencies.
export const levelToWorld=v=>[v[0]/1024,-v[1]/1024,-v[2]/1024];
export function multiplyQuaternion(a,b){const [x,y,z,w]=a,[X,Y,Z,W]=b;return [w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z];}
function pose(rot){const [y,p,r]=rot.map(v=>v*Math.PI/65536);return multiplyQuaternion(multiplyQuaternion([0,-Math.sin(y),0,Math.cos(y)],[Math.sin(p),0,0,Math.cos(p)]),[0,0,-Math.sin(r),Math.cos(r)]);}
function frameFor(m,o){return o.frames[m.frame];}
export class SceneBuilder {
 build(rooms,o,entities,textures,source){
  const nodes=[],meshes=[],materials=[],images=[],cache=new Map(),materialCache=new Map(),roomNodes=new Map(),bounds=[],missingItems=[];
  function node(name,parent,fields={}){nodes.push({name,parent,...fields});return nodes.length-1;}
  function mesh(data,kind,key){if(!data)throw Error('Object references a missing mesh.');if(cache.has(key))return cache.get(key);
    const primitives=[];
    for(const b of data.buckets){const position=[],uv=[],uv1=[],polygonEdges=[];
      for(const p of b.polygons){const corners=p.indices.map(i=>{if(!data.vertices[i])throw Error('Invalid polygon vertex.');return levelToWorld(data.vertices[i]);});
        corners.forEach((v,i)=>polygonEdges.push(...v,...corners[(i+1)%corners.length]));
        for(const tri of p.shape===0?[[0,2,1],[0,3,2]]:[[0,2,1]])for(const j of tri){const v=corners[j],n=p.normal;position.push(...v);uv.push(...p.uv[j]);uv1.push(...(Math.abs(n[1])>=.15?[v[0],v[2]]:[Math.abs(n[2])>=Math.abs(n[0])?v[0]:v[2],v[1]]));}
      }
      if(!position.length)continue;
      const group=b.animated?'animated':kind,mkey=`${group}/${b.texture}/${b.blend}/${!!b.doubleSided}`;
      if(!materialCache.has(mkey)){const atlas=textures[group]?.[b.texture];if(!atlas)throw Error('Missing texture atlas.');materialCache.set(mkey,materials.length);materials.push({image:images.length,blend:b.blend,doubleSided:!!b.doubleSided,alphaTest:b.alphaTest,additive:b.additive});images.push(atlas.image??atlas.bytes);}
      primitives.push({position:new Float32Array(position),uv:new Float32Array(uv),uv1:new Float32Array(uv1),polygonEdges,material:materialCache.get(mkey)});
    }
    const id=meshes.length;meshes.push(primitives);cache.set(key,id);return id;
  }
  const metadata=rooms.map(r=>{const extras={kind:'room',roomId:r.id,name:r.name,flipped:r.flipped,flags:r.flags,sectors:r.sectors.length},parent=node(`Room ${r.id} - ${r.name}`,null,{extras});roomNodes.set(r.id,parent);
    node(`Room surfaces ${r.id}`,parent,{mesh:mesh(r,'room',`room/${r.id}`),translation:[r.x/1024,0,-r.z/1024],extras:{kind:'geometry',roomId:r.id}});
    return {...extras,x:r.x,z:r.z,nx:r.nx,nz:r.nz,bottom:r.bottom,top:r.top,portals:r.portals,volumes:r.volumes,triggers:r.triggers,mapSectors:r.mapSectors,wallSectors:r.wallSectors};
  });
  for(const r of rooms)(r.spriteInstances||[]).forEach((sprite,i)=>node(`Room sprite ${i}`,roomNodes.get(r.id),{mesh:mesh(sprite,'sprite',`sprite/${r.id}/${i}`),translation:levelToWorld(sprite.position),extras:{kind:'sprite',roomId:r.id,billboard:true}}));
  const statics=new Map(o.statics.map(s=>[s.slot,s])),models=new Map(o.models.map(m=>[m.slot,m]));
  for(const r of rooms)r.statics.forEach((s,i)=>{const m=statics.get(s.slot);if(!m)throw Error('Missing static definition.');const position=levelToWorld(s.pos),rotation=pose(s.rot);node(s.name||`Static ${s.slot}`,roomNodes.get(r.id),{mesh:mesh(o.meshes[m.mesh],'static',`static/${m.mesh}`),translation:position,rotation,scale:s.scale,extras:{kind:'static',roomId:r.id,slot:s.slot,sourceIndex:i}});bounds.push({room:r.id,name:s.name,kind:'collision',position,rotation,scale:s.scale,bounds:m.collision});});
  for(const item of entities.items){const m=models.get(item.slot);if(!m){missingItems.push(item.id);continue;}if(!roomNodes.has(item.room))throw Error('Item references a missing room.');
    const position=levelToWorld(item.pos),rotation=pose(item.rot),frame=frameFor(m,o)||{offset:[0,0,0],rotations:[]};
    const parent=node(item.name||`Object ${item.id} - Slot ${item.slot}`,roomNodes.get(item.room),{translation:position,rotation,extras:{kind:'moveable',roomId:item.room,itemId:item.id,slot:item.slot,ocb:item.ocb,referencePose:true}});
    if(frame.bounds)bounds.push({room:item.room,name:item.name,itemId:item.id,kind:'reference',position,rotation,scale:1,bounds:frame.bounds});
    const chain=[],stack=[];let current=0;
    if(m.nmeshes<0||m.nmeshes>10000)throw Error('Invalid mesh count.');
    for(let j=0;j<m.nmeshes;j++){let p=parent,trans=frame.offset;
      if(j){const offset=m.bone+(j-1)*4;if(offset<0||offset+4>o.bones.length)throw Error('Invalid bone reference.');const [opcode,x,y,z]=o.bones.slice(offset,offset+4),flag=opcode&3;
        if(flag===1&&stack.length)current=stack.pop();else if(flag===2)stack.push(current);else if(flag===3&&stack.length)current=stack.at(-1);p=chain[current];trans=[x,y,z];}
      const q=frame.rotations[j]||[0,0,0,1];chain.push(node(`Object ${item.id} / Mesh ${j}`,p,{mesh:mesh(o.meshes[m.mesh+j],'moveable',`moveable/${m.mesh+j}`),translation:levelToWorld(trans),rotation:[q[0],-q[1],-q[2],q[3]]}));current=j;
    }
  }
  // Preserve the same ordering as the offline exporter for stable inspection lists.
  bounds.sort((a,b)=>(a.kind==='reference'?0:1)-(b.kind==='reference'?0:1));
  return {nodes,meshes,materials,images,meta:{rooms:metadata,items:entities.items,bounds,missingItems,source,coordinateSystem:'X, -Y, -Z; one unit = 1024 level units'}};
}
}
