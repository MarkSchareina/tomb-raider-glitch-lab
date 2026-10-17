// Optional page-native API; all operations stay in the current browser document.
export function registerSceneTools(api){
 const context=document.modelContext??navigator.modelContext;if(!context?.registerTool)return;
 const result=value=>({content:[{type:'text',text:JSON.stringify(value)}]});
 const empty={type:'object',properties:{},additionalProperties:false};
 const tools=[
 {name:'scene_export_svg',description:'Export the active scene and camera as texture-free SVG, without viewer UI or title/footer. Returns SVG text.',inputSchema:empty,execute:()=>result({svg:api.renderSVG()})},
 {name:'scene_inspect',description:'Read the active scene and loaded level identity.',inputSchema:empty,execute:()=>result({level:api.levelIdentity(),scene:api.savePresentation()})},
 {name:'scene_configure',description:'Apply a validated scene to the current hash-matched level. Includes camera, display mode, shapes and annotations.',inputSchema:{type:'object',properties:{scene:{type:'object'}},required:['scene'],additionalProperties:false},execute:({scene})=>result({stats:api.loadPresentation(scene),scene:api.savePresentation()})},
 {name:'scene_verify',description:'Verify level-hash rejection, unchanged state after rejection, and repeatable PNG rendering across a scene roundtrip. Restores the original scene.',inputSchema:empty,execute:()=>{
 const saved=api.savePresentation(),before=api.renderImage(saved).dataURL;let rejected=false;
 try{try{api.loadPresentation({...saved,level:{...saved.level,sha256:'0'.repeat(64)}});}catch{rejected=true;}
 if(!rejected)throw Error('Mismatched level accepted');
 if(api.renderImage().dataURL!==before)throw Error('Rejected input changed scene');
 api.loadPresentation(saved);
 if(api.renderImage().dataURL!==before)throw Error('Scene roundtrip changed PNG');
 return result({levelHashGuard:true,rejectionPreservesScene:true,roundtripPNG:true});
 }finally{api.loadPresentation(saved);}
 }}];
 for(const tool of tools)Promise.resolve(context.registerTool(tool)).catch(error=>console.warn('Scene tool registration:',error.message));
}
