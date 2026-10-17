// Texture-free vector projection of a built scene, with camera/frustum clipping.
// Painter ordering approximates intersecting transparent surfaces (no depth buffer).
import * as THREE from 'three';

const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const n=x=>Number(x.toFixed(3));
const planes=[v=>v.w+v.x,v=>v.w-v.x,v=>v.w+v.y,v=>v.w-v.y,v=>v.w+v.z,v=>v.w-v.z];
function polygonClip(vertices){
 for(const distance of planes){const next=[];for(let i=0;i<vertices.length;i++){
  const a=vertices[i],b=vertices[(i+1)%vertices.length],da=distance(a),db=distance(b);
  if(da>=0)next.push(a);if((da>=0)!==(db>=0))next.push(a.clone().lerp(b,da/(da-db)));
 }vertices=next;if(!vertices.length)break;}return vertices;
}
function segmentClip(a,b){for(const d of planes){const da=d(a),db=d(b);if(da<0&&db<0)return null;if(da<0)a=a.clone().lerp(b,da/(da-db));else if(db<0)b=a.clone().lerp(b,da/(da-db));}return [a,b];}

// Clip hidden portions of depth-tested lines against opaque projected faces.
// Average-depth painter sorting cannot do this: a long edge can pass both in
// front of and behind a sloping floor. NDC depth is affine in screen space,
// including for perspective cameras; no raster image or wall-plane cut is used.
function hiddenInterval(a,b,face){
 let lo=0,hi=1;
 const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 const sign=Math.sign(cross(...face));if(!sign)return null;
 for(let i=0;i<3;i++){
  const p=face[i],q=face[(i+1)%3],da=sign*cross(p,q,a),db=sign*cross(p,q,b);
  if(da<0&&db<0)return null;
  if(da<0)lo=Math.max(lo,da/(da-db));else if(db<0)hi=Math.min(hi,da/(da-db));
  if(lo>=hi)return null;
 }
 const [p,q,r]=face,area=cross(p,q,r);
 const depth=v=>(cross(q,r,v)*p.z+cross(r,p,v)*q.z+cross(p,q,v)*r.z)/area;
 const da=a.z-depth(a)-1e-8,db=b.z-depth(b)-1e-8;
 if(da<=0&&db<=0)return null;
 if(da<=0)lo=Math.max(lo,da/(da-db));else if(db<=0)hi=Math.min(hi,da/(da-db));
 return lo<hi?[lo,hi]:null;
}

export function renderSceneSVG({scene,camera,config}){
 const {width,height}=config.output,items=[],opaqueFaces=[],segments=[];
 camera.updateMatrixWorld();scene.updateMatrixWorld(true);
 const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
 const project=v=>new THREE.Vector4(v.x,v.y,v.z,1).applyMatrix4(vp);
 const xy=v=>[(v.x/v.w+1)*width/2,(1-v.y/v.w)*height/2];
 const screen=v=>xy(project(v));
 const add=(xml,vertices,object,material)=>items.push({xml,z:vertices.reduce((sum,v)=>sum+v.z/v.w,0)/vertices.length,overlay:material.depthTest===false,order:object.renderOrder});
 scene.traverseVisible(o=>{
  if(o.userData.svgExclude)return;
  o.userData.updateSurfaceEdges?.(camera);
  if(o.isSprite){
   const l=o.userData.svgLabel;if(!l)return;
   const center=new THREE.Vector3().setFromMatrixPosition(o.matrixWorld),v=project(center);
   if(v.w<=0||planes[4](v)<0||planes[5](v)<0)return;
   const scale=new THREE.Vector3();o.getWorldScale(scale);
   const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
   const origin=screen(center),rp=screen(center.clone().addScaledVector(right,scale.x)),tp=screen(center.clone().addScaledVector(up,scale.y));
   const w=Math.hypot(rp[0]-origin[0],rp[1]-origin[1]),h=Math.hypot(tp[0]-origin[0],tp[1]-origin[1]);
   const x=origin[0]-o.center.x*w,y=origin[1]-(1-o.center.y)*h,k=h/l.height;
   if(x+w<0||x>width||y+h<0||y>height)return;
   const text=l.rows.map((row,i)=>`<text x="${n(x+(l.centered?w/2:12*k))}" y="${n(y+(l.baseline+i*l.lineHeight)*k)}" fill="${escape(l.color)}" font-family="Segoe UI,Arial,sans-serif" font-size="${n(l.fontSize*k)}" font-weight="600"${l.centered?' text-anchor="middle"':''}>${escape(row)}</text>`).join('');
   add(`<g><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#101720" fill-opacity="0.91"/>${text}</g>`,[v],o,o.material);return;
  }
  if(!o.geometry||(!o.isMesh&&!o.isLine))return;
  const g=o.geometry,pos=g.attributes.position,index=g.index,count=index?index.count:pos.count;
  const vertex=i=>project(new THREE.Vector3().fromBufferAttribute(pos,index?index.getX(i):i).applyMatrix4(o.matrixWorld));
  const begin=g.drawRange.start,end=Math.min(count,begin+g.drawRange.count);
  const materialAt=i=>Array.isArray(o.material)?o.material[(g.groups.find(group=>i>=group.start&&i<group.start+group.count)||{}).materialIndex??0]:o.material;
  if(o.isMesh)for(let i=begin;i+2<end;i+=3){
   const m=materialAt(i);if(!m||!m.visible||m.opacity===0)continue;
   const p=polygonClip([vertex(i),vertex(i+1),vertex(i+2)]);if(p.length<3)continue;
   const coords=p.map(xy),area=coords.reduce((sum,a,j)=>{const b=coords[(j+1)%coords.length];return sum+a[0]*b[1]-a[1]*b[0];},0);
   // WebGLRenderer flips front-face winding for mirrored object transforms.
   const facing=area*(o.matrixWorld.determinant()<0?-1:1);
   if(Math.abs(area)<1e-7||(m.side===THREE.FrontSide&&facing>=0)||(m.side===THREE.BackSide&&facing<=0))continue;
   const faceColor=m.color.clone();
   if(m.vertexColors&&g.attributes.color){const colors=g.attributes.color,average=new THREE.Color(0,0,0);for(let j=0;j<3;j++){const k=index?index.getX(i+j):i+j;average.r+=colors.getX(k)/3;average.g+=colors.getY(k)/3;average.b+=colors.getZ(k)/3;}faceColor.multiply(average);}
   const col='#'+faceColor.getHexString(),path=coords.map(a=>a.map(n).join(',')).join(' ');
   if(m.colorWrite!==false)add(`<polygon points="${path}" ${m.wireframe?`fill="none" stroke="${col}" stroke-width="0.7"`:`fill="${col}"`} opacity="${m.transparent?m.opacity:1}"/>`,p,o,m);
   if(m.depthTest!==false&&m.depthWrite!==false&&!m.wireframe&&(!m.transparent||m.opacity===1)){
    const ndc=p.map(v=>new THREE.Vector3(v.x/v.w,v.y/v.w,v.z/v.w));
    for(let j=1;j+1<ndc.length;j++)opaqueFaces.push([ndc[0],ndc[j],ndc[j+1]]);
   }
  }
  if(o.isLine){const m=o.material;if(!m?.visible||m.opacity===0)return;const step=o.isLineSegments?2:1;
   for(let i=begin;i+1<end;i+=step){const p=segmentClip(vertex(i),vertex(i+1));if(!p)continue;const [a,b]=p.map(xy);
    const dash=m.isLineDashedMaterial?' stroke-dasharray="6 4"':'';
    const style=`fill="none" stroke="#${m.color.getHexString()}" stroke-width="${o.userData.svgStrokeWidth??m.linewidth??1}"${o.userData.svgStrokeWidth?' vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"':''} opacity="${m.transparent?m.opacity:1}"${dash}`;
    if(m.depthTest===false)add(`<path d="M${n(a[0])},${n(a[1])} L${n(b[0])},${n(b[1])}" ${style}/>`,p,o,m);
    else segments.push({p,o,m,style});
   }
  }
 });
 // A modest screen grid avoids testing every room edge against every face in
 // large overview scenes. Faces spanning cells are deduplicated per segment.
 const grid=new Map(),cells=32;
 const cell=v=>Math.max(0,Math.min(cells-1,Math.floor((v+1)*cells/2)));
 const bounds=points=>[cell(Math.min(...points.map(v=>v.x))),cell(Math.max(...points.map(v=>v.x))),cell(Math.min(...points.map(v=>v.y))),cell(Math.max(...points.map(v=>v.y)))];
 const visit=(points,callback)=>{const [x0,x1,y0,y1]=bounds(points);for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)callback(x*cells+y);};
 for(const face of opaqueFaces)visit(face,key=>{if(!grid.has(key))grid.set(key,[]);grid.get(key).push(face);});
 for(const {p,o,m,style} of segments){
  const [a,b]=p.map(v=>new THREE.Vector3(v.x/v.w,v.y/v.w,v.z/v.w)),candidates=new Set();
  visit([a,b],key=>{for(const face of grid.get(key)??[])candidates.add(face);});
  const hidden=[];for(const face of candidates){const interval=hiddenInterval(a,b,face);if(interval)hidden.push(interval);}
  hidden.sort((x,y)=>x[0]-y[0]);let start=0;
  const emit=(lo,hi)=>{if(hi-lo<1e-9)return;const ends=[a.clone().lerp(b,lo),a.clone().lerp(b,hi)],coords=ends.map(v=>[(v.x+1)*width/2,(1-v.y)*height/2]);
   add(`<path d="M${n(coords[0][0])},${n(coords[0][1])} L${n(coords[1][0])},${n(coords[1][1])}" ${style}/>`,ends.map(v=>new THREE.Vector4(v.x,v.y,v.z,1)),o,m);items.at(-1).surfaceLine=true;};
  for(const [lo,hi] of hidden){if(lo>start)emit(start,lo);start=Math.max(start,hi);if(start>=1)break;}if(start<1)emit(start,1);
 }
 items.sort((a,b)=>Number(a.overlay)-Number(b.overlay)||(a.overlay?a.order-b.order:Number(!!a.surfaceLine)-Number(!!b.surfaceLine))||b.z-a.z);
 const background=scene.background?.isColor?`<rect width="100%" height="100%" fill="#${scene.background.getHexString()}"/>`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" style="display:block;background:${scene.background?.isColor?'#'+scene.background.getHexString():'transparent'}"><desc>Texture-free scene projection. Intersecting transparent surfaces use approximate painter ordering.</desc><defs><clipPath id="viewport"><rect width="${width}" height="${height}"/></clipPath></defs>${background}<g clip-path="url(#viewport)">${items.map(i=>i.xml).join('')}</g></svg>`;
}
