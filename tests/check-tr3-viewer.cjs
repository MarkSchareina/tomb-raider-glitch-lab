const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),http=require('http');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..'),level=process.env.TR3_LEVEL,ten=process.env.TEN_LEVEL;
if(!level)throw Error('Set TR3_LEVEL to the local Remastered 3/DATA/JUNGLE.TR2 fixture.');
const server=http.createServer((req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://local').pathname);
 const file=path.resolve(root,'docs','.'+name+(name.endsWith('/')?'index.html':''));
 if(!file.startsWith(path.join(root,'docs')+path.sep)){res.writeHead(403);res.end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],failures=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(r.url());});
 const ready=()=>page.waitForFunction(()=>window.viewerReady===true&&document.querySelector('#cancelImport').hidden,null,{timeout:60000});
 await page.goto(`http://127.0.0.1:${server.address().port}/tools/ten-viewer/`);
 await page.locator('#levelFile').setInputFiles(level);await ready();
 assert.match(await page.locator('#formatName').innerText(),/TR3 PC/);assert(await page.locator('#volumes').isDisabled());
 const initial=await page.evaluate(()=>window.viewerDiagnostics());assert.equal(initial.rooms,165);assert(initial.textures>0);assert(initial.triggers>0);
 await page.locator('[data-id="4"]').click();await page.locator('#orbit').click();
 fs.mkdirSync(path.join(root,'qa'),{recursive:true});await page.screenshot({path:path.join(root,'qa/tr3-jungle-room4.png')});
 await page.locator('#isolate').uncheck();await page.locator('#overview').click();await page.screenshot({path:path.join(root,'qa/tr3-jungle-overview.png')});
 await page.locator('#isolate').check();await page.evaluate(()=>{window.tenViewer.selectRoom(0);window.tenViewer.selectSector(1,1);});
 await page.locator('#triggers').check();await page.locator('#bounds').check();await page.locator('#portals').check();
 assert.match(await page.locator('#sectorInfo').innerText(),/Activate object 96/);
 for(const [label,mode] of [['Colored Geometry','color'],['Wireframe','wire'],['Textures','texture']]){
  await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.evaluate(()=>window.viewerDiagnostics().mode),mode);
  await page.screenshot({path:path.join(root,`qa/tr3-jungle-${mode}.png`)});
 }
 await page.reload();await ready();assert.equal(await page.locator('#levelName').innerText(),path.basename(level));assert(await page.locator('#triggers').isChecked());
 assert.deepEqual(await page.evaluate(()=>window.viewerDiagnostics().selectedSector),[1,1]);
 // A failed import must retain the current TR3 scene and its cached file.
 await page.locator('#levelFile').setInputFiles({name:'truncated.tr2',mimeType:'application/octet-stream',buffer:fs.readFileSync(level).subarray(0,2000)});
 await page.waitForFunction(()=>document.querySelector('#loading').getAttribute('role')==='alert');assert.equal(await page.locator('#roomCount').innerText(),'165');
 if(ten){await page.locator('#levelFile').setInputFiles(ten);await ready();assert.match(await page.locator('#formatName').innerText(),/TEN/);assert.equal(await page.locator('#volumes').isDisabled(),false);}
 const base64=fs.readFileSync(level).toString('base64');
 await page.evaluate(base64=>{const file=new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],'Dropped.tr2');const data=new DataTransfer();data.items.add(file);window.dispatchEvent(new DragEvent('drop',{dataTransfer:data,bubbles:true,cancelable:true}));},base64);await ready();
 assert.equal(await page.locator('#levelName').innerText(),'Dropped.tr2');assert.equal(await page.evaluate(()=>window.viewerDiagnostics().meshes),initial.meshes);
 await page.evaluate(base64=>{const file=new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],'Cancelled.tr2');window.tenViewer.openFile(file);document.querySelector('#cancelImport').click();},base64);await ready();assert.equal(await page.locator('#levelName').innerText(),'Dropped.tr2');
 // Offline uses the same parser registry, bundled with all its dependencies.
 const offline=await browser.newPage({viewport:{width:1440,height:1000}}),requests=[];
 offline.on('pageerror',e=>errors.push(e.message));await offline.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});
 await offline.goto(pathToFileURL(path.join(root,'docs/tools/ten-viewer/standalone.html')).href);
 await offline.locator('#levelFile').setInputFiles(level);await offline.waitForFunction(()=>window.viewerReady===true&&document.querySelector('#cancelImport').hidden,null,{timeout:60000});
 assert.equal(await offline.locator('#roomCount').innerText(),'165');await offline.reload();await offline.waitForFunction(()=>window.viewerReady===true,null,{timeout:60000});
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 fs.writeFileSync(path.join(root,'qa/tr3-browser-check.json'),JSON.stringify({passed:true,initial,errors,failures,offlineNetworkRequests:requests},null,2));
 console.log('PASS: JUNGLE.TR2 file/drop, TEN↔TR3 switching, modes, sectors/triggers, cache reload, rejection, cancellation and offline.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
