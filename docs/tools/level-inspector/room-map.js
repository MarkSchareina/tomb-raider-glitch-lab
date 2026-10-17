import {Vector3} from 'three';

export class RoomMap {
  constructor(canvas,title,details){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.title=title;this.details=details;
    this.direction=new Vector3();this.lastDraw=0;this.hover=null;
    canvas.addEventListener('pointermove',event=>{
      if(!this.room)return;
      const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*440/rect.width,z=(event.clientY-rect.top)*440/rect.height;
      const sx=Math.floor((x-this.ox)/this.cell),sz=Math.floor((z-this.oz)/this.cell);
      this.hover=sx>=0&&sz>=0&&sx<this.room.nx&&sz<this.room.nz?[sx,sz]:null;
      this.lastDraw=0;
    });
    canvas.addEventListener('click',()=>{if(this.hover)this.onSelect?.(...this.hover);});
    canvas.addEventListener('pointerleave',()=>{this.hover=null;this.lastDraw=0;});
  }
  setRoom(room,name){
    if(this.room?.roomId!==room.roomId)this.selection=null;
    this.room=room;this.walls=new Set(room.wallSectors);this.hover=null;this.lastDraw=0;
    this.cell=416/Math.max(room.nx,room.nz);this.ox=(440-room.nx*this.cell)/2;this.oz=(440-room.nz*this.cell)/2;
    this.title.textContent=`Room ${room.roomId} · ${name}`;
    this.canvas.setAttribute('aria-label',`Top-down map of room ${room.roomId}, ${name}; ${room.nx} by ${room.nz} sectors. Positive X points right, positive Z points down.`);
  }
  isBoundaryWall(x,z){
    const r=this.room;
    return this.walls.has(x*r.nz+z)&&(x===0||z===0||x===r.nx-1||z===r.nz-1);
  }
  draw(camera,options={}){
    const now=performance.now();if(!this.room||now-this.lastDraw<50)return;this.lastDraw=now;
    const r=this.room,c=this.ctx,s=this.cell;c.clearRect(0,0,440,440);c.fillStyle='#101720';c.fillRect(0,0,440,440);
    for(let x=0;x<r.nx;x++)for(let z=0;z<r.nz;z++){
      const i=x*r.nz+z,sector=r.mapSectors[i],wall=this.walls.has(i),opening=sector.floorPortals.some(p=>p>=0),px=this.ox+x*s,pz=this.oz+z*s;
      c.fillStyle=this.isBoundaryWall(x,z)?'#666666':(r.flags&1)?(wall?'#164781':opening?'#102d52':'#176ec2'):wall?'#009926':opening?'#173e47':'#00b3b3';c.fillRect(px,pz,s,s);
      if(!wall&&opening){
        c.strokeStyle='#668b93';c.lineWidth=1;c.beginPath();c.moveTo(px+2,pz+s-2);c.lineTo(px+s-2,pz+2);c.stroke();
      }
      c.strokeStyle='#101720';c.lineWidth=1;c.strokeRect(px,pz,s,s);
      if(sector.side>=0){c.strokeStyle='#ad9aff';c.lineWidth=2;c.strokeRect(px+2,pz+2,s-4,s-4);}
    }
    for(const t of options.triggers?r.triggers||[]:[]){c.fillStyle='#b052ff';c.fillRect(this.ox+t.x*s+2,this.oz+t.z*s+2,s-4,s-4);}
    if(options.objects)for(const item of options.items||[]){if(item.room!==r.roomId)continue;const px=item.position[0]-r.x/1024,pz=-item.position[2]-r.z/1024;c.fillStyle='#ffffff';c.beginPath();c.arc(this.ox+px*s,this.oz+pz*s,3,0,Math.PI*2);c.fill();}
    if(this.selection){const [sx,sz]=this.selection;c.fillStyle='#ffdf5555';c.fillRect(this.ox+sx*s,this.oz+sz*s,s,s);c.strokeStyle='#ffe34d';c.lineWidth=4;c.strokeRect(this.ox+sx*s,this.oz+sz*s,s,s);}
    const x=camera.position.x-r.x/1024,z=-camera.position.z-r.z/1024;
    const inside=x>=0&&z>=0&&x<=r.nx&&z<=r.nz;
    if(inside){
      camera.getWorldDirection(this.direction);
      const dx=this.direction.x,dz=-this.direction.z,px=this.ox+x*s,pz=this.oz+z*s;
      c.save();c.translate(px,pz);c.rotate(Math.atan2(dz,dx));c.strokeStyle='#101720';c.fillStyle='#ffcf4d';c.lineWidth=2;
      c.beginPath();c.moveTo(12,0);c.lineTo(-7,-6);c.lineTo(-4,0);c.lineTo(-7,6);c.closePath();c.fill();c.stroke();c.restore();
    }
    let info='+X right · +Z down';
    if(this.hover){
      const [sx,sz]=this.hover,i=sx*r.nz+sz,sector=r.mapSectors[i],dest=[...new Set(sector.floorPortals.filter(p=>p>=0))];
      c.strokeStyle=this.selection?.[0]===sx&&this.selection?.[1]===sz?'#ffe34d':'#ffffff';c.lineWidth=2;c.strokeRect(this.ox+sx*s,this.oz+sz*s,s,s);
      const type=this.isBoundaryWall(sx,sz)?'Room boundary':this.walls.has(i)?'Wall':dest.length?`Opening to room ${dest.join(' / ')}`:'Floor';
      info=`Sector ${sx}, ${sz} · ${type}${sector.side>=0?` · Side portal to ${sector.side}`:''}`;
    }else if(!inside)info+=' · Camera outside map';
    else if(-camera.position.y*1024<r.top||-camera.position.y*1024>r.bottom)info+=' · Camera above/below room';
    this.details.textContent=info;
  }
}
