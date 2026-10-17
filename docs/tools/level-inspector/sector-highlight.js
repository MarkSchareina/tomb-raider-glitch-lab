// Clip a world-space triangle to the selected sector without moving its plane.
// Vertices contain [x,y,z,u,v]; interpolation preserves the source texture mask.
export function clipSectorTriangle(vertices,min,max,inset=0.004){
  const a=vertices[1].map((v,i)=>v-vertices[0][i]),b=vertices[2].map((v,i)=>v-vertices[0][i]);
  const normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...normal);
  if(length<1e-12)return [];
  let polygon=vertices;
  for(let axis=0;axis<3;axis++){
    // Inset within the face plane. A wall on the sector boundary must remain
    // selectable rather than being discarded by an inset perpendicular to it.
    const tangent=Math.sqrt(Math.max(0,1-(normal[axis]/length)**2));
    const margin=Math.min(inset,(max[axis]-min[axis])*0.1)*tangent;
    for(const [boundary,sign] of [[min[axis]+margin,1],[max[axis]-margin,-1]]){
      const output=[];
      for(let i=0;i<polygon.length;i++){
        const start=polygon[i],end=polygon[(i+1)%polygon.length];
        const ds=sign*(start[axis]-boundary),de=sign*(end[axis]-boundary);
        const inside=ds>=-1e-8,nextInside=de>=-1e-8;
        if(inside)output.push(start);
        if(inside!==nextInside){const t=ds/(ds-de);output.push(start.map((value,k)=>value+(end[k]-value)*t));}
      }
      polygon=output;if(!polygon.length)return [];
    }
  }
  return polygon;
}

// A separate, translucent guide surrounds the selected space. Sample the actual
// room surfaces along its perimeter; never scale or move the yellow highlight.
export function buildSectorColumn(triangles,min,max,inset=0.004){
  const corners=[[min[0]+inset,min[2]+inset],[max[0]-inset,min[2]+inset],[max[0]-inset,max[2]-inset],[min[0]+inset,max[2]-inset]];
  const surfaces=triangles.map(([a,b,c])=>{
    const determinant=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
    return {a,b,c,determinant};
  }).filter(t=>Math.abs(t.determinant)>1e-10);
  function heights([x,z]){
    let bottom=Infinity,top=-Infinity;
    for(const {a,b,c,determinant:d} of surfaces){
      const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d;
      const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d,w=1-u-v;
      if(Math.min(u,v,w)<-1e-7)continue;
      const y=u*a[1]+v*b[1]+w*c[1];
      // Projected determinant has the opposite sign of the face's Y normal.
      if(d<0)bottom=Math.min(bottom,y);else top=Math.max(top,y);
    }
    if(!Number.isFinite(bottom))bottom=min[1];
    if(!Number.isFinite(top))top=max[1];
    const gap=Math.max(0,Math.min(.001,(top-bottom)/4));
    return [[x,bottom+gap,z],[x,Math.max(bottom+gap,top-gap),z]];
  }
  const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],lines=[],sides=[],rings=[];
  for(let side=0;side<4;side++){
    const start=corners[side],end=corners[(side+1)%4],direction=end.map((v,i)=>v-start[i]),cuts=[0,1];
    // Include split-plane boundaries so sloping/triangulated caps keep their shape.
    for(const {a,b,c} of surfaces){const points=[a,b,c];for(let i=0;i<3;i++){
      const p=[points[i][0],points[i][2]],q=[points[(i+1)%3][0],points[(i+1)%3][2]];
      const edge=q.map((v,k)=>v-p[k]),offset=p.map((v,k)=>v-start[k]),den=cross(direction,edge);
      if(Math.abs(den)<1e-10)continue;
      const t=cross(offset,edge)/den,u=cross(offset,direction)/den;
      if(t>1e-7&&t<1-1e-7&&u>=-1e-7&&u<=1+1e-7)cuts.push(t);
    }}
    const samples=cuts.sort((a,b)=>a-b).filter((v,i,values)=>!i||v-values[i-1]>1e-7).map(t=>heights(start.map((v,i)=>v+t*direction[i])));
    rings.push(samples[0]);
    for(let i=1;i<samples.length;i++){
      const [lo,hi]=samples[i-1],[nextLo,nextHi]=samples[i];
      lines.push(...lo,...nextLo,...hi,...nextHi);
      sides.push(...lo,...hi,...nextHi,...lo,...nextHi,...nextLo);
    }
  }
  for(const [lo,hi] of rings)lines.push(...lo,...hi);
  return {lines,sides};
}
