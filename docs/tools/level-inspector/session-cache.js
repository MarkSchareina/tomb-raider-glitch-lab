// Large binary files belong in IndexedDB; only the tab's cache key and view
// settings go into sessionStorage. A new tab starts without a selected level.
// Reuse the old tab key after the canonical URL migration.
const key='ten-viewer-session-v1:'+location.pathname.replace('/tools/level-inspector/','/tools/ten-viewer/');
let database;
function db(){
  return database??=new Promise((resolve,reject)=>{
    const request=indexedDB.open('ten-viewer-cache',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('levels');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('Browser cache is unavailable.'));
  });
}
async function transaction(mode,operation){
  const database=await db();
  return new Promise((resolve,reject)=>{
    const tx=database.transaction('levels',mode),request=operation(tx.objectStore('levels'));
    tx.oncomplete=()=>resolve(request?.result);
    tx.onerror=tx.onabort=()=>reject(tx.error||Error('Browser cache failed.'));
  });
}
export function readSession(){
  try{return JSON.parse(sessionStorage.getItem(key))||{};}catch{return {};}
}
export function writeView(view){
  try{const saved=readSession();if(saved.id)sessionStorage.setItem(key,JSON.stringify({...saved,view}));}catch{/* Storage may be disabled. */}
}
export function forgetSession(){
  try{sessionStorage.removeItem(key);}catch{/* Storage may be disabled. */}
}
export async function restoreSession(){
  const saved=readSession();
  // Reclaim abandoned entries, without deleting another active tab's cache.
  // A tab that is used again refreshes its entry on successful restoration.
  await transaction('readwrite',store=>{
    const request=store.openCursor();request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;
      if(cursor.key!==saved.id&&cursor.value.time<Date.now()-7*86400000)cursor.delete();cursor.continue();};
  });
  if(!saved.id)return null;
  const entry=await transaction('readonly',store=>store.get(saved.id));
  if(!entry){forgetSession();return null;}
  return {file:entry.file,view:saved.view};
}
export async function cacheLevel(file,isCurrent){
  const previous=readSession().id;
  forgetSession();
  // Check sessionStorage before spending space on a file that cannot be restored.
  const id=crypto.randomUUID();
  sessionStorage.setItem(key,JSON.stringify({}));
  await transaction('readwrite',store=>store.put({file,time:Date.now()},id));
  if(!isCurrent()){await transaction('readwrite',store=>store.delete(id));return;}
  sessionStorage.setItem(key,JSON.stringify({id}));
  if(previous)await transaction('readwrite',store=>store.delete(previous));
}
