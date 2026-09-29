import * as THREE from 'three';

export class HoverInfo {
  constructor(canvas,panel,camera,getTargets,describe,accept){
    this.canvas=canvas;this.panel=panel;this.camera=camera;this.getTargets=getTargets;this.describe=describe;this.accept=accept;
    this.ray=new THREE.Raycaster();this.ray.params.Line.threshold=0.035;this.pointer=null;this.last=0;this.down=false;this.dirty=false;this.changedAt=0;this.cameraMatrix=new THREE.Matrix4();this.boxes=new WeakMap();this.ndc=new THREE.Vector2();this.checks=0;this.lastCost=0;
    canvas.addEventListener('pointermove',e=>{this.pointer={x:e.clientX,y:e.clientY};this.down=e.buttons!==0;this.dirty=true;this.changedAt=performance.now();this.hide();});
    canvas.addEventListener('pointerdown',()=>{this.down=true;this.hide();});
    canvas.addEventListener('pointerup',()=>{this.down=false;this.dirty=true;this.changedAt=performance.now();});
    canvas.addEventListener('pointerleave',()=>{this.pointer=null;this.hide();});
    canvas.addEventListener('pointercancel',()=>{this.down=false;this.pointer=null;this.hide();});
    window.addEventListener('blur',()=>{this.pointer=null;this.hide();});
  }
  invalidate(){this.dirty=true;this.changedAt=performance.now();this.hide();}
  hide(){this.panel.hidden=true;this.canvas.style.cursor='';}
  update(moving){
    const now=performance.now();
    if(!this.cameraMatrix.equals(this.camera.matrixWorld)){
      this.cameraMatrix.copy(this.camera.matrixWorld);this.dirty=true;this.changedAt=now;this.hide();
    }
    if(!this.pointer||this.down||moving){this.hide();return;}
    // Query once after the pointer and camera settle, never continuously at rest.
    if(!this.dirty||now-this.changedAt<120)return;
    this.dirty=false;const started=performance.now();this.checks++;
    const rect=this.canvas.getBoundingClientRect(),p=this.pointer;
    this.ray.setFromCamera(this.ndc.set((p.x-rect.left)/rect.width*2-1,1-(p.y-rect.top)/rect.height*2),this.camera);
    const candidates=[];
    for(const object of this.getTargets()){
      let visible=true;for(let o=object;o;o=o.parent)if(!o.visible){visible=false;break;}
      if(!visible)continue;
      let cached=this.boxes.get(object);
      if(!cached||!cached.matrix.equals(object.matrixWorld)){
        if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();
        cached={matrix:object.matrixWorld.clone(),box:object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld)};
        if(object.isLine)cached.box.expandByScalar(this.ray.params.Line.threshold);
        this.boxes.set(object,cached);
      }
      if(this.ray.ray.intersectsBox(cached.box))candidates.push(object);
    }
    const hits=[];
    for(const hit of this.ray.intersectObjects(candidates,false)){
      if(hits.length&&hit.distance>hits[0].distance+0.015)break;
      if(this.accept(hit))hits.push(hit);
    }
    this.lastCost=performance.now()-started;
    if(!hits.length){this.hide();return;}
    // Coplanar trigger patches take precedence over the underlying floor.
    const nearest=hits[0].distance,hit=hits.find(h=>h.object.userData.trigger&&h.distance<nearest+0.015)||hits[0];
    const info=this.describe(hit);if(!info){this.hide();return;}
    this.panel.textContent=info.text;this.panel.dataset.kind=info.kind;this.panel.hidden=false;this.canvas.style.cursor='pointer';
    const x=p.x-rect.left,y=p.y-rect.top,w=this.panel.offsetWidth,h=this.panel.offsetHeight;
    this.panel.style.left=`${Math.max(8,Math.min(x+15,rect.width-w-8))}px`;
    this.panel.style.top=`${Math.max(8,Math.min(y+17,rect.height-h-8))}px`;
  }
}
