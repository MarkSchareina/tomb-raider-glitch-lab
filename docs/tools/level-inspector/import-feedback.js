// Reject accidental image drops before starting a level import.
export function classifyLevelDrop(files){
 if(files.length!==1)return {error:'Drop one level file at a time.'};
 const file=files[0];
 if(file.type?.startsWith('image/')||! /\.(ten|tr2)$/i.test(file.name))return {error:'This is not a level file. Drop a .ten or .tr2 file, or use Load scene for scene JSON.'};
 return {file};
}

export function installImportFeedback({status,dropHint,openFile}){
 let depth=0;
 const dismiss=()=>{if(status.getAttribute('role')==='alert')status.hidden=true;};
 function addDismiss(){
  if(status.getAttribute('role')!=='alert'||status.querySelector('button'))return;
  const button=document.createElement('button');button.textContent='Dismiss';button.setAttribute('aria-label','Dismiss import message');
  button.style.cssText='display:block;margin-top:12px';button.onclick=e=>{e.stopPropagation();dismiss();};status.append(button);
 }
 new MutationObserver(addDismiss).observe(status,{childList:true,attributes:true,attributeFilter:['role']});
 addDismiss();
 window.addEventListener('keydown',e=>{if(e.key==='Escape')dismiss();});
 window.addEventListener('dragstart',e=>{if(e.target.id==='renderPreview')e.preventDefault();},true);
 window.addEventListener('dragenter',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();depth++;dropHint.hidden=false;}});
 window.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
 window.addEventListener('dragleave',()=>{if(--depth<=0){depth=0;dropHint.hidden=true;}});
 window.addEventListener('drop',e=>{
  e.preventDefault();depth=0;dropHint.hidden=true;
  const files=[...(e.dataTransfer?.files||[])];
  // Internal image/link drags have no files and are not import requests.
  if(!files.length)return;
  const result=classifyLevelDrop(files);
  if(result.file){openFile(result.file);return;}
  status.textContent=result.error;status.setAttribute('role','alert');status.hidden=false;
  const message=result.error;
  setTimeout(()=>{if(status.getAttribute('role')==='alert'&&status.textContent.startsWith(message))status.hidden=true;},6000);
 });
}
