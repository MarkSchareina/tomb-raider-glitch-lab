// Opt-in file-based render interface for ordinary static servers.
// No server process, input emulation or arbitrary script evaluation is needed.
export function watchRenderJob(api){
 const path=new URLSearchParams(location.search).get('renderJob');
 if(!path)return;
 const base=new URL('./',location.href),url=new URL(path,base);
 if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))throw Error('Render job must be inside the viewer directory.');
 let last='',busy=false;
 const status=document.getElementById('sceneStatus');
 async function poll(){
  if(busy)return;busy=true;
  try{
   const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error(`Render job HTTP ${response.status}`);
   const job=await response.json();if(!job.id||job.id===last)return;last=job.id;
   const level=new URL(job.levelURL,url);
   if(level.origin!==base.origin||!level.pathname.startsWith(base.pathname))throw Error('Level must be inside the viewer directory.');
   if(api.levelIdentity().sha256!==job.scene.level.sha256){
    const r=await fetch(level);if(!r.ok)throw Error(`Level HTTP ${r.status}`);
    await api.openFile(new File([await r.arrayBuffer()],job.scene.level.name));
   }
   api.loadPresentation(job.scene);
   const saved=api.savePresentation(),image=api.renderImage(saved);
   let preview=document.getElementById('renderPreview');
   if(!preview){preview=document.createElement('img');preview.id='renderPreview';preview.alt='Rendered explanation scene';preview.style.cssText='width:100%;margin-top:12px';const box=document.createElement('details'),heading=document.createElement('summary');heading.textContent='Rendered PNG preview';box.append(heading,preview);status.parentElement.append(box);}
   preview.src=image.dataURL;
   preview.dataset.manifest=JSON.stringify({job:job.id,scene:saved,level:api.levelIdentity(),stats:image.stats,width:image.width,height:image.height});
   status.textContent=`Rendered ${job.id}: ${image.width} × ${image.height}; ${image.stats.meshes} meshes, ${image.stats.wallPortals} wall portals`;
  }catch(error){status.textContent=error.message;}finally{busy=false;}
 }
 poll();setInterval(poll,2000);
}
