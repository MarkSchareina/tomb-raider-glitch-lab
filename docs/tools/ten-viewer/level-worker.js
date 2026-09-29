import {parseLevel} from './level-formats.js';
self.onmessage=({data})=>{
  try{
    const result=parseLevel(data.buffer,data.name,message=>self.postMessage({progress:message}));
    const buffers=new Set();
    for(const image of result.images)buffers.add((image.data??image).buffer);
    for(const mesh of result.meshes)for(const p of mesh)for(const key of ['position','uv','uv1'])buffers.add(p[key].buffer);
    self.postMessage({result},[...buffers]);
  }catch(error){self.postMessage({error:error.message});}
};
