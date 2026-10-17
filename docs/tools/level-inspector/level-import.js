import * as THREE from 'three';

export async function importLevel(file,progress,signal){
  if(file.size>512*1024*1024)throw Error('The selected file exceeds the 512 MiB import limit.');
  const buffer=await file.arrayBuffer();signal?.throwIfAborted();
  let workerURL;
  const worker=window.TEN_VIEWER_CONFIG?.workerSource
    ?new Worker(workerURL=URL.createObjectURL(new Blob([window.TEN_VIEWER_CONFIG.workerSource],{type:'text/javascript'})))
    :new Worker(new URL('./level-worker.js',import.meta.url),{type:'module'});
  const result=await new Promise((resolve,reject)=>{
    const abort=()=>{finish();reject(new DOMException('Import cancelled.','AbortError'));};
    const finish=()=>{worker.terminate();if(workerURL)URL.revokeObjectURL(workerURL);signal?.removeEventListener('abort',abort);};
    worker.onmessage=({data})=>{if(data.progress)progress(data.progress);else{finish();data.error?reject(Error(data.error)):resolve(data.result);}};
    worker.onerror=()=>{finish();reject(Error('The level parser could not run in this browser.'));};
    signal?.addEventListener('abort',abort,{once:true});worker.postMessage({buffer,name:file.name},[buffer]);
  });
  progress('Loading embedded textures…');
  const urls=[],textures=[],materials=[],geometries=[];
  try{
    // Decode each atlas once even when several blend modes use the same image.
    const cache=new Map();
    for(const source of result.images){
      signal?.throwIfAborted();const bytes=source.data??source;let texture=cache.get(bytes.buffer);
      if(!texture){
        if(source.data){texture=new THREE.DataTexture(source.data,source.width,source.height);texture.needsUpdate=true;}
        else{const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));urls.push(url);texture=await new THREE.TextureLoader().loadAsync(url);}
        texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;cache.set(bytes.buffer,texture);
      }
      textures.push(texture);
    }
    for(const m of result.materials)materials.push(new THREE.MeshBasicMaterial({map:textures[m.image],alphaTest:m.alphaTest??.3,side:m.doubleSided?THREE.DoubleSide:THREE.FrontSide,transparent:!!m.additive,blending:m.additive?THREE.AdditiveBlending:THREE.NormalBlending,depthWrite:!m.additive}));
    const geometryGroups=result.meshes.map(primitives=>primitives.map(p=>{const g=new THREE.BufferGeometry();geometries.push(g);g.setAttribute('position',new THREE.BufferAttribute(p.position,3));g.setAttribute('uv',new THREE.BufferAttribute(p.uv,2));g.setAttribute('uv1',new THREE.BufferAttribute(p.uv1,2));g.userData.polygonEdges=p.polygonEdges;return {geometry:g,material:materials[p.material]};}));
    const world=new THREE.Group(),nodes=[];world.userData.billboards=[];
    for(const n of result.nodes){const object=new THREE.Group();object.name=n.name;object.userData=n.extras||{};if(object.userData.billboard)world.userData.billboards.push(object);
      if(n.translation)object.position.fromArray(n.translation);if(n.rotation)object.quaternion.fromArray(n.rotation);if(n.scale!==undefined)object.scale.setScalar(n.scale);
      for(const p of geometryGroups[n.mesh]||[])object.add(new THREE.Mesh(p.geometry,p.material));
      (n.parent===null?world:nodes[n.parent]).add(object);nodes.push(object);
    }
    signal?.throwIfAborted();return {world,meta:result.meta};
  }catch(error){for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of new Set(textures))t.dispose();throw error;}
  finally{for(const url of urls)URL.revokeObjectURL(url);}
}
