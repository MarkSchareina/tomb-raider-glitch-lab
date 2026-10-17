import {clipSectorTriangle,buildSectorColumn} from './sector-highlight.js';
import * as THREE from 'three';

export class SectorInspector {
  constructor(scene,panel){this.scene=scene;this.panel=panel;this.group=new THREE.Group();scene.add(this.group);}
  clear(){
    for(const child of [...this.group.children]){this.group.remove(child);if(child.userData.ownedGeometry)child.geometry.dispose();child.material.dispose();}
    this.panel.textContent='Click a square to inspect its contents.';
  }
  select(r,x,z,meta,roomGroup,options={objects:true,triggers:true,portals:true,volumes:true}){
    this.clear();const xmin=r.x/1024+x,zmax=-r.z/1024-z,ymin=-r.bottom/1024,ymax=-r.top/1024;
    const column=new THREE.Box3(new THREE.Vector3(xmin,ymin,zmax-1),new THREE.Vector3(xmin+1,ymax,zmax));
    // Surface highlight and column guide are independent of each other.
    const minimum=column.min.toArray(),maximum=column.max.toArray(),roomTriangles=[];
    roomGroup.updateWorldMatrix(true,true);
    roomGroup.traverse(o=>{
      if(!o.isMesh||o.userData.wireDepthOnly)return;let ancestor=o;while(ancestor&&!ancestor.userData.kind)ancestor=ancestor.parent;
      const isRoom=['geometry','room'].includes(ancestor?.userData.kind);
      if(!isRoom&&!options.objects)return;
      if(!new THREE.Box3().setFromObject(o).intersectsBox(column))return;
      const positions=[],uvs=[],source=o.geometry.attributes,point=new THREE.Vector3();
      const indices=o.geometry.index,count=indices?indices.count:source.position.count;
      for(let i=0;i<count;i+=3){
        const triangle=[];
        for(let j=0;j<3;j++){
          const index=indices?indices.getX(i+j):i+j;
          if(options.geometryMode&&source.waterOpening?.getX(index)>.5)break;
          point.fromBufferAttribute(source.position,index).applyMatrix4(o.matrixWorld);
          triangle.push([...point.toArray(),source.uv?.getX(index)??0,source.uv?.getY(index)??0]);
        }
        if(triangle.length!==3)continue;
        if(isRoom)roomTriangles.push(triangle);
        const polygon=clipSectorTriangle(triangle,minimum,maximum);
        for(let j=1;j<polygon.length-1;j++)for(const vertex of [polygon[0],polygon[j],polygon[j+1]]){
          positions.push(...vertex.slice(0,3));uvs.push(...vertex.slice(3,5));
        }
      }
      if(!positions.length)return;
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      const material=new THREE.MeshBasicMaterial({color:0xffdf35,transparent:true,opacity:options.geometryMode?0.9:(isRoom?0.35:0.65),depthWrite:false,side:o.userData.textureMaterial.side,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,alphaMap:o.userData.textureMaterial.map,alphaTest:0});
      material.onBeforeCompile=shader=>{
        shader.uniforms.selectionAlphaCutoff={value:o.userData.textureMaterial.alphaTest};
        shader.fragmentShader='uniform float selectionAlphaCutoff;\n'+shader.fragmentShader;
        // Test the source texture alpha, not the deliberately translucent highlight.
        shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>',`
          #ifdef USE_ALPHAMAP
            float sourceAlpha=texture2D(alphaMap,vAlphaMapUv).a;
            if(sourceAlpha<selectionAlphaCutoff) discard;
            diffuseColor.a*=sourceAlpha;
          #endif`);
      };
      const overlay=new THREE.Mesh(geometry,material);overlay.userData.ownedGeometry=true;overlay.renderOrder=4;this.group.add(overlay);
    });
    const guide=buildSectorColumn(roomTriangles,minimum,maximum);
    const sideGeometry=new THREE.BufferGeometry();sideGeometry.setAttribute('position',new THREE.Float32BufferAttribute(guide.sides,3));
    const columnFill=new THREE.Mesh(sideGeometry,new THREE.MeshBasicMaterial({color:0xffdf35,transparent:true,opacity:.07,depthWrite:false,depthTest:true,side:THREE.DoubleSide,forceSinglePass:true}));
    columnFill.renderOrder=6;columnFill.userData.ownedGeometry=true;this.group.add(columnFill);
    const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(guide.lines,3));
    const outline=new THREE.LineSegments(lineGeometry,new THREE.LineBasicMaterial({color:0xffdf35,transparent:true,opacity:.85,depthWrite:false,depthTest:true}));
    outline.renderOrder=7;outline.userData.ownedGeometry=true;this.group.add(outline);
    const entries=[],sector=r.mapSectors[x*r.nz+z];
    const add=(height,text)=>entries.push({height,text});
    if(options.objects)for(const b of meta.bounds||[]){
      const v=b.bounds,box=new THREE.Box3(new THREE.Vector3(v[0],-v[3],-v[5]).divideScalar(1024),new THREE.Vector3(v[1],-v[2],-v[4]).divideScalar(1024));
      const matrix=new THREE.Matrix4().compose(new THREE.Vector3().fromArray(b.position),new THREE.Quaternion().fromArray(b.rotation),new THREE.Vector3().setScalar(b.scale));box.applyMatrix4(matrix);
      if(box.max.x<=column.min.x||box.min.x>=column.max.x||box.max.z<=column.min.z||box.min.z>=column.max.z||box.max.y<ymin||box.min.y>ymax)continue;
      const objectOutline=new THREE.Box3Helper(box,0xffdf35);objectOutline.material.depthTest=true;objectOutline.material.depthWrite=false;objectOutline.renderOrder=5;objectOutline.userData.ownedGeometry=true;this.group.add(objectOutline);
      add(box.max.y,`${b.itemId!==undefined?'Object '+b.itemId:'Static'}: ${b.name||'Unnamed'} · Room ${b.room} · bounds overlap`);
    }
    if(options.triggers)for(const t of r.triggers||[])if(t.x===x&&t.z===z)add(Math.max(...t.vertices.filter((_,i)=>i%3===1)),`Trigger ${t.index}`);
    if(options.portals){for(const id of new Set(sector.floorPortals.filter(p=>p>=0)))add(ymin,`Floor portal → Room ${id}`);for(const id of new Set((sector.ceilingPortals||[]).filter(p=>p>=0)))add(ymax,`Ceiling portal → Room ${id}`);if(sector.side>=0)add((ymin+ymax)/2,`Side portal → Room ${sector.side}`);}
    if(options.volumes)for(const v of r.volumes||[]){
      const box=new THREE.Box3(new THREE.Vector3(...v.scale).negate().divideScalar(1024),new THREE.Vector3(...v.scale).divideScalar(1024));
      box.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(v.pos[0],-v.pos[1],-v.pos[2]).divideScalar(1024),new THREE.Quaternion(v.rot[0],-v.rot[1],-v.rot[2],v.rot[3]),new THREE.Vector3(1,1,1)));
      if(box.intersectsBox(column))add(box.max.y,`Event volume: ${v.name} · bounds overlap`);
    }
    const title=document.createElement('strong');title.textContent=`Sector ${x}, ${z}`;this.panel.replaceChildren(title);
    if(sector.inspection?.length){
      const details=document.createElement('ul');
      for(const text of sector.inspection){const item=document.createElement('li');item.textContent=text;details.append(item);}
      this.panel.append(details);
    }
    const note=document.createElement('div');note.textContent='Top to bottom · enabled overlays';this.panel.append(note);
    const list=document.createElement('ol');
    entries.sort((a,b)=>b.height-a.height||a.text.localeCompare(b.text));for(const e of entries){const li=document.createElement('li');li.textContent=e.text;list.append(li);}this.panel.append(list);
    if(!entries.length){const empty=document.createElement('div');empty.textContent='No enabled objects or overlays in this sector.';this.panel.append(empty);}
  }
}
