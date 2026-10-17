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

export function renderSceneSVG({scene,camera,config}){
 const {width,height}=config.output,items=[];
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
   if(Math.abs(area)<1e-7||(m.side===THREE.FrontSide&&area>=0)||(m.side===THREE.BackSide&&area<=0))continue;
   const faceColor=m.color.clone();
   if(m.vertexColors&&g.attributes.color){const colors=g.attributes.color,average=new THREE.Color(0,0,0);for(let j=0;j<3;j++){const k=index?index.getX(i+j):i+j;average.r+=colors.getX(k)/3;average.g+=colors.getY(k)/3;average.b+=colors.getZ(k)/3;}faceColor.multiply(average);}
   const col='#'+faceColor.getHexString(),path=coords.map(a=>a.map(n).join(',')).join(' ');
   add(`<polygon points="${path}" ${m.wireframe?`fill="none" stroke="${col}" stroke-width="0.7"`:`fill="${col}"`} opacity="${m.transparent?m.opacity:1}"/>`,p,o,m);
  }
  if(o.isLine){const m=o.material;if(!m?.visible||m.opacity===0)return;const step=o.isLineSegments?2:1;
   for(let i=begin;i+1<end;i+=step){const p=segmentClip(vertex(i),vertex(i+1));if(!p)continue;const [a,b]=p.map(xy);
    const dash=m.isLineDashedMaterial?' stroke-dasharray="6 4"':'';
    add(`<path d="M${n(a[0])},${n(a[1])} L${n(b[0])},${n(b[1])}" fill="none" stroke="#${m.color.getHexString()}" stroke-width="${o.userData.svgStrokeWidth??m.linewidth??1}"${o.userData.svgStrokeWidth?' vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"':''} opacity="${m.transparent?m.opacity:1}"${dash}/>`,p,o,m);
   }
  }
 });
 items.sort((a,b)=>Number(a.overlay)-Number(b.overlay)||(a.overlay?a.order-b.order:0)||b.z-a.z);
 const background=scene.background?.isColor?`<rect width="100%" height="100%" fill="#${scene.background.getHexString()}"/>`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" style="display:block;background:${scene.background?.isColor?'#'+scene.background.getHexString():'transparent'}"><desc>Texture-free scene projection. Intersecting transparent surfaces use approximate painter ordering.</desc><defs><clipPath id="viewport"><rect width="${width}" height="${height}"/></clipPath></defs>${background}<g clip-path="url(#viewport)">${items.map(i=>i.xml).join('')}</g></svg>`;
}
