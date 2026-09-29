const {chromium} = require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const level=process.env.TEN_LEVEL;
if(!level)throw Error('Set TEN_LEVEL to a local Only_Up.ten (TEN 1.10.1.0) fixture.');
const {pathToFileURL}=require('url');
const http=require('http');
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(pathname==='/test-prefix/embed.html'){res.setHeader('Content-Type','text/html');res.end(`<script>window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==document.querySelector('iframe').contentWindow)return;if(e.data.type==='ten-viewer:ready')window.embedReady=true;if(e.data.type==='ten-viewer:loaded')window.embedResult=e.data;});</script><iframe src="tools/ten-viewer/" style="width:1400px;height:900px"></iframe>`);return;}
 if(!pathname.startsWith('/test-prefix/')){res.writeHead(404);res.end();return;}
 let file=path.resolve(root,'docs',pathname.slice('/test-prefix/'.length));
 if(!file.startsWith(path.join(root,'docs')+path.sep)){res.writeHead(403);res.end();return;}
 if(pathname.endsWith('/'))file=path.join(file,'index.html');
 try{const types={'.html':'text/html','.js':'text/javascript','.css':'text/css'};res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
});
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[],failed=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/test-prefix/tools/ten-viewer/`;
  await page.goto(url);
  await page.locator('#levelFile').setInputFiles(level);
  await page.waitForFunction(()=>window.viewerReady===true,null,{timeout:60000});
  await page.locator('[data-id="9"]').click();
  await page.waitForFunction(()=>window.viewerReady===true,{timeout:60000});
  const initial=await page.evaluate(()=>window.viewerDiagnostics());
  assert.equal(initial.fly,true);assert.equal(await page.locator('#speed').inputValue(),'25');assert(initial.triggers>0);
  await page.locator('#orbit').click();
  assert.equal(initial.rooms,49);assert(initial.textures>0);assert(initial.drawCalls>0);
  fs.mkdirSync(path.join(root,'qa'),{recursive:true});
  await page.screenshot({path:path.join(root,'qa/textures.png')});
  let foundHover=false;
  for(const y of [450,500,550,600]){
    for(const x of [600,700,800,900,1000]){
      await page.mouse.move(x,y);await page.waitForTimeout(220);
      if(await page.locator('#hoverInfo').isVisible()){foundHover=true;break;}
    }
    if(foundHover)break;
  }
  assert(foundHover,'Hover tooltip should appear over geometry');
  const hoverCount=await page.evaluate(()=>window.viewerDiagnostics().hoverChecks);
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>window.viewerDiagnostics().hoverChecks),hoverCount,'No repeated hover queries at rest');
  assert((await page.locator('#hoverInfo').innerText()).includes('Room'));
  assert.equal(await page.evaluate(()=>window.viewerDiagnostics().selectedSector),null);
  await page.screenshot({path:path.join(root,'qa/hover.png')});
  await page.mouse.down();assert.equal(await page.locator('#hoverInfo').isVisible(),false);
  await page.mouse.move(400,200);await page.mouse.up();
  await page.locator('#focus').click();

  const mapRect=await page.locator('#mapCanvas').boundingBox();
  await page.locator('#mapCanvas').click({position:{x:(12+7.5*20.8)*mapRect.width/440,y:(22.4+7.5*20.8)*mapRect.height/440}});
  assert.deepEqual(await page.evaluate(()=>window.viewerDiagnostics().selectedSector),[7,7]);
  assert((await page.locator('#sectorInfo').innerText()).includes('crumbling_floor_9'));
  await page.screenshot({path:path.join(root,'qa/selected-crumbling-floor.png')});
  await page.getByRole('button',{name:'Colored Geometry',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.viewerDiagnostics().mode),'color');
  await page.screenshot({path:path.join(root,'qa/colors.png')});
  await page.mouse.move(950,600);await page.mouse.down();
  await page.mouse.move(950,220,{steps:24});await page.mouse.up();
  await page.waitForTimeout(500);
  await page.screenshot({path:path.join(root,'qa/colors-below.png')});
  await page.locator('#outlines').uncheck();await page.locator('#outlines').check();
  await page.getByRole('button',{name:'Focus',exact:false}).click();

  await page.locator('#bounds').check();
  await page.locator('#objects').uncheck();
  await page.screenshot({path:path.join(root,'qa/bounds.png')});
  await page.locator('#bounds').uncheck();
  await page.locator('#objects').check();
  await page.getByRole('button',{name:'Wireframe',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.viewerDiagnostics().mode),'wire');
  await page.screenshot({path:path.join(root,'qa/wireframe.png')});
  // Keep the reported switch sector selected while changing projection/render modes.
  await page.evaluate(()=>{window.tenViewer.selectRoom(6);window.tenViewer.selectSector(2,11);});
  for(const [label,name] of [['Textures','texture'],['Colored Geometry','geometry'],['Wireframe','wire']]){
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.waitForTimeout(250);
    assert.deepEqual(await page.evaluate(()=>window.viewerDiagnostics().selectedSector),[2,11]);
    await page.screenshot({path:path.join(root,`qa/selection-room6-${name}.png`)});
  }
  await page.getByRole('button',{name:'Textures',exact:true}).click();
  await page.locator('[data-id="2"]').click();
  await page.getByRole('button',{name:'Colored Geometry',exact:true}).click();
  const water=await page.evaluate(()=>window.viewerDiagnostics());assert(water.waterOpeningTriangles>0);assert(water.trviewFaceCounts.water>0);
  await page.screenshot({path:path.join(root,'qa/water-above.png')});
  await page.mouse.move(950,600);await page.mouse.down();await page.mouse.move(950,220,{steps:24});await page.mouse.up();await page.waitForTimeout(400);
  await page.screenshot({path:path.join(root,'qa/water-below.png')});
  await page.locator('[data-id="33"]').click();
  const smallMap=await page.locator('#mapCanvas').boundingBox();
  await page.locator('#mapCanvas').click({position:{x:(12+2.5*416/7)*smallMap.width/440,y:(12+3.5*416/7)*smallMap.height/440}});
  assert.deepEqual(await page.evaluate(()=>window.viewerDiagnostics().selectedSector),[2,3]);
  await page.screenshot({path:path.join(root,'qa/yellow-sector.png')});
  await page.locator('[data-id="9"]').click();
  const wallMap=await page.locator('#mapCanvas').boundingBox();
  await page.locator('#mapCanvas').click({position:{x:(12+1.5*20.8)*wallMap.width/440,y:(22.4+18.5*20.8)*wallMap.height/440}});
  assert.deepEqual(await page.evaluate(()=>window.viewerDiagnostics().selectedSector),[1,18]);
  await page.screenshot({path:path.join(root,'qa/selected-wall.png')});
  await page.locator('[data-id="10"]').click();
  await page.locator('#triggers').check();
  await page.locator('#mapCanvas').click({position:{x:100,y:100}});
  assert(await page.evaluate(()=>window.viewerDiagnostics().selectedSector!==null));
  assert((await page.locator('#sectorInfo').innerText()).includes('Sector'));
  await page.screenshot({path:path.join(root,'qa/sector-selection.png')});
  assert.deepEqual(await page.evaluate(()=>window.viewerDiagnostics().visibleTriggerRooms),[10]);
  await page.screenshot({path:path.join(root,'qa/triggers.png')});
  await page.locator('#triggers').uncheck();
  await page.locator('[data-id="17"]').click();
  await page.locator('#isolate').check();
  let d=await page.evaluate(()=>window.viewerDiagnostics());
  assert.deepEqual(d.visibleRooms,[17]);
  assert((await page.locator('#mapTitle').innerText()).startsWith('Room 17'));
  await page.locator('#mapToggle').uncheck();assert.equal(await page.locator('#roomMap').isVisible(),false);
  await page.locator('#mapToggle').check();
  await page.locator('#inside').click();
  await page.waitForTimeout(100);
  assert(!(await page.locator('#mapDetails').innerText()).includes('outside'));
  await page.screenshot({path:path.join(root,'qa/minimap.png')});
  await page.locator('#portals').check();await page.locator('#volumes').check();
  await page.locator('#objects').uncheck();await page.locator('#objects').check();
  await page.locator('#fly').click();
  const before=await page.evaluate(()=>window.viewerDiagnostics().camera);
  await page.keyboard.down('KeyW');await page.waitForTimeout(400);await page.keyboard.up('KeyW');
  const after=await page.evaluate(()=>window.viewerDiagnostics().camera);
  assert(Math.hypot(...after.map((x,i)=>x-before[i]))>0.1);
  await page.locator('#orbit').click();await page.locator('#isolate').uncheck();
  await page.locator('#portals').uncheck();await page.locator('#volumes').uncheck();
  await page.locator('[data-id="9"]').click();
  await page.locator('#search').fill('Floor 13');
  assert.equal(await page.locator('.room-button:visible').count(),1);
  await page.locator('#search').fill('');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(root,'qa/mobile.png')});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  const result={passed:true,initial,flightDistance:Math.hypot(...after.map((x,i)=>x-before[i])),errors,failed,
    checked:['Textured scene','49 rooms','color mode','wireframe','room isolation','object toggle','portal and volume overlays','free flight moves camera','room search','390px layout']};
  fs.writeFileSync(path.join(root,'qa/browser-check.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  await page.setViewportSize({width:1440,height:1000});
  // Failed imports preserve the existing scene and allow retry.
  const invalid=Buffer.from(fs.readFileSync(level).subarray(0,24));invalid[4]=2;
  await page.locator('#levelFile').setInputFiles({name:'wrong-version.ten',mimeType:'application/octet-stream',buffer:invalid});
  await page.waitForFunction(()=>document.querySelector('#loading').textContent.includes('Unsupported TEN version'));
  assert.equal(await page.locator('#roomCount').innerText(),'49');
  await page.locator('#levelFile').setInputFiles({name:'truncated.ten',mimeType:'application/octet-stream',buffer:fs.readFileSync(level).subarray(0,30)});
  await page.waitForFunction(()=>document.querySelector('#loading').textContent.includes('Truncated TEN'));
  await page.reload();
  await page.waitForFunction(()=>window.viewerReady===true&&document.querySelector('#cancelImport').hidden,null,{timeout:60000});
  assert.equal(await page.locator('#levelName').innerText(),path.basename(level));
  // Drop path uses the exact same importer. Re-import must not accumulate meshes.
  const bytes=fs.readFileSync(level).toString('base64');
  await page.evaluate(base64=>{const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const dt=new DataTransfer();dt.items.add(new File([bytes],'Dropped.ten'));window.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));},bytes);
  await page.waitForFunction(()=>window.viewerReady===true&&document.querySelector('#levelName').textContent==='Dropped.ten',null,{timeout:60000});
  const repeated=await page.evaluate(()=>window.viewerDiagnostics());assert.equal(repeated.meshes,initial.meshes);assert.equal(repeated.triggers,initial.triggers);assert.equal(repeated.rooms,initial.rooms);
  await page.evaluate(base64=>{const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));window.tenViewer.openFile(new File([bytes],'Cancelled.ten'));document.querySelector('#cancelImport').click();},bytes);
  await page.waitForFunction(()=>document.querySelector('#cancelImport').hidden);
  assert.equal(await page.locator('#roomCount').innerText(),'49');
  // Real file://, with HTTP entirely blocked: no server or CDN required.
  // Reload preserves the last successful file even after cancelled imports.
  await page.evaluate(()=>{window.tenViewer.selectRoom(9);window.tenViewer.selectSector(7,7);});
  await page.getByRole('button',{name:'Colored Geometry',exact:true}).click();
  await page.locator('#objects').uncheck();await page.locator('#mapToggle').uncheck();
  await page.locator('#fov').fill('60');await page.locator('#speed').fill('12');
  await page.locator('#search').fill('#9');
  await page.locator('#fly').click();
  const savedCamera=await page.evaluate(()=>window.viewerDiagnostics().camera);
  await page.reload();
  await page.waitForFunction(()=>window.viewerReady===true&&document.querySelector('#cancelImport').hidden,null,{timeout:60000});
  const restored=await page.evaluate(()=>window.viewerDiagnostics());
  assert.equal(await page.locator('#levelName').innerText(),'Dropped.ten');
  assert.equal(restored.selected,9);assert.deepEqual(restored.selectedSector,[7,7]);assert.equal(restored.mode,'color');
  assert.deepEqual(restored.camera,savedCamera);assert.equal(restored.fly,true);
  assert.equal(await page.locator('#objects').isChecked(),false);assert.equal(await page.locator('#mapToggle').isChecked(),false);
  assert.equal(await page.locator('#fov').inputValue(),'60');assert.equal(await page.locator('#speed').inputValue(),'12');
  assert.equal(await page.locator('#search').inputValue(),'#9');assert.equal(await page.locator('.room-button:visible').count(),1);
  const fresh=await page.context().newPage();await fresh.goto(url);
  await fresh.waitForFunction(()=>!!window.tenViewer);assert.equal(await fresh.locator('#roomCount').innerText(),'0');await fresh.close();
  const offline=await browser.newPage({viewport:{width:1440,height:1000}});offline.on('pageerror',e=>errors.push(e.message));
  const requests=[];await offline.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});
  await offline.goto(pathToFileURL(path.join(root,'docs/tools/ten-viewer/standalone.html')).href);
  await offline.locator('#levelFile').setInputFiles(level);
  await offline.waitForFunction(()=>window.viewerReady===true,null,{timeout:60000});
  const local=await offline.evaluate(()=>window.viewerDiagnostics());assert.equal(local.rooms,49);assert.equal(local.meshes,initial.meshes);assert.equal(local.textures,initial.textures);assert.deepEqual(requests,[]);
  await offline.getByRole('button',{name:'Colored Geometry',exact:true}).click();await offline.locator('[data-id="9"]').click();
  await offline.screenshot({path:path.join(root,'qa/offline-import.png')});
  await offline.waitForFunction(()=>document.querySelector('#cancelImport').hidden);
  await offline.reload();
  await offline.waitForFunction(()=>window.viewerReady===true&&document.querySelector('#cancelImport').hidden,null,{timeout:60000});
  assert.equal(await offline.evaluate(()=>window.viewerDiagnostics().selected),9);
  assert.equal(await offline.evaluate(()=>window.viewerDiagnostics().mode),'color');assert.deepEqual(requests,[]);
  await page.goto(url.replace('tools/ten-viewer/','embed.html'));
  await page.waitForFunction(()=>window.embedReady===true);
  await page.evaluate(base64=>{const file=new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],'Embedded.ten');document.querySelector('iframe').contentWindow.postMessage({type:'ten-viewer:open',file},location.origin);},bytes);
  await page.waitForFunction(()=>window.embedResult?.rooms===49,null,{timeout:60000});
  await page.evaluate(()=>document.querySelector('iframe').contentWindow.postMessage({type:'ten-viewer:select',room:9,sector:[7,7]},location.origin));
  const embedded=page.frames().find(f=>f.url().includes('tools/ten-viewer'));
  await embedded.waitForFunction(()=>window.viewerDiagnostics().selectedSector?.join(',')==='7,7');
  assert((await embedded.locator('#sectorInfo').innerText()).includes('crumbling_floor_9'));
  const blocked=await context.newPage();
  await blocked.addInitScript(()=>{indexedDB.open=()=>{throw new DOMException('Storage disabled','SecurityError');};});
  blocked.on('pageerror',e=>errors.push(e.message));await blocked.goto(url);
  await blocked.locator('#levelFile').setInputFiles(level);
  await blocked.waitForFunction(()=>window.viewerReady===true&&document.querySelector('#cancelImport').hidden,null,{timeout:60000});
  assert.equal(await blocked.locator('#roomCount').innerText(),'49');
  assert((await blocked.locator('#loading').innerText()).includes('Browser storage is unavailable or full'));
  await blocked.close();
  assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
  fs.writeFileSync(path.join(root,'qa/ten-import-check.json'),JSON.stringify({passed:true,initial,repeated,local,offlineNetworkRequests:requests,errors,failed},null,2));
  console.log('TEN import: file selection, drop, replacement, errors, cancellation, session reload/settings, tab isolation and offline HTML passed.');
  await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1);});
