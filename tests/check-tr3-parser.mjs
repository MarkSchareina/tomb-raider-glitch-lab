import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseLevel} from '../docs/tools/ten-viewer/level-formats.js';
import {TR3Parser,readTR3FloorData} from '../docs/tools/ten-viewer/tr3-parser.js';

// The .TR2 suffix is deliberately not used for detection (TR2 and TR3 share it).
for(const bytes of [[],[0x2d,0,0,0],[0x20,0,0,0],[0x38,0,0,0]])assert.throws(()=>parseLevel(Uint8Array.from(bytes).buffer,'JUNGLE.TR2'),/Unsupported/);
assert.throws(()=>parseLevel(Uint8Array.from([84,69,78,0,2,0,0,0]).buffer,'anything.tr2'),/Unsupported TEN version/);
assert.throws(()=>parseLevel(Uint8Array.from([0x38,0,0x18,0xff]).buffer,'anything.ten'),/Truncated TR3/);
// Camera setup words have their own end bit; the following floor-data command
// must not accidentally become a trigger action. Switch references can end too.
const commands=readTR3FloorData([0,4,0x3e05,1024|7,0x8000|3,0x8000|6|(5<<8)],1);
assert.equal(commands.length,2);assert.deepEqual(commands[0].actions,[{type:1,target:7,camera:0x8003}]);assert.equal(commands[1].type,6);
assert.deepEqual(readTR3FloorData([0,0x8204,0,0x8009],1)[0].actions,[]);
assert.throws(()=>readTR3FloorData([0,4,0],1),/reference/);
assert.throws(()=>readTR3FloorData([0,0x801f],1),/Unsupported/);

const filename=process.env.TR3_LEVEL;
if(filename){
 const bytes=fs.readFileSync(filename),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length);
 const parser=new TR3Parser(),scene=parseLevel(buffer,path.basename(filename));
 assert.equal(scene.meta.format.id,'tr3');assert.equal(scene.meta.format.capabilities.eventVolumes,false);assert.deepEqual(scene.meta.missingItems,[]);
 for(const mesh of scene.meshes)for(const p of mesh){assert.equal(p.position.length%9,0);assert.equal(p.uv.length,p.position.length/3*2);assert.equal(p.uv1.length,p.uv.length);for(const v of p.position)assert(Number.isFinite(v));for(const v of p.uv)assert(Number.isFinite(v));assert(scene.materials[p.material]);}
 for(const material of scene.materials){const image=scene.images[material.image];assert.equal(image.data.length,image.width*image.height*4);}
 scene.nodes.forEach((node,i)=>{assert(node.parent===null||(node.parent>=0&&node.parent<i));if(node.rotation)assert(Math.abs(Math.hypot(...node.rotation)-1)<1e-10);});
 for(const room of scene.meta.rooms){assert.equal(room.mapSectors.length,room.nx*room.nz);for(const t of room.triggers){assert.equal(t.vertices.length,18);assert(t.vertices.every(Number.isFinite));}}
 if(process.env.TR3_BASELINE){
  const reference=JSON.parse(fs.readFileSync(process.env.TR3_BASELINE,'utf8'));
  assert.equal(scene.meta.rooms.length,reference.room_count);assert.equal(scene.meta.items.length,reference.item_count);
  for(const expected of reference.rooms){const room=scene.meta.rooms[expected.id];
   for(const key of ['x','z','bottom','top','nx','nz','flags'])assert.equal(room[key],expected[key]);
   assert.equal(room.flipped,expected.flip);assert.deepEqual(room.portals.map(p=>p.room),expected.portals);
   for(const sector of expected.sectors){const s=room.mapSectors[sector.x*room.nz+sector.z];assert.equal(s.floorHeight,sector.floor);assert.equal(s.ceilingHeight,sector.ceiling);}
  }
  for(const expected of reference.items){const item=scene.meta.items[expected.id];assert.equal(item.slot,expected.object);assert.equal(item.room,expected.room);assert.equal(item.flags,expected.flags);assert.equal(item.rot[0],expected.angle);assert.deepEqual(item.pos,[expected.x,expected.y,expected.z]);}
 }
 if(path.basename(filename).toUpperCase()==='JUNGLE.TR2'){
  assert.equal(scene.meta.rooms.length,165);assert.equal(scene.meta.items.length,142);assert.equal(scene.meta.statistics.texturePages,11);assert.equal(scene.meta.statistics.meshPointers,373);assert.equal(scene.meta.statistics.objectTextures,2462);
  const lara=scene.meta.items.find(i=>i.slot===0);assert.equal(lara.room,4);assert.deepEqual(lara.pos,[28160,-256,28160]);assert.equal(scene.meta.rooms[4].nx,14);assert.equal(scene.meta.rooms[4].nz,16);
  assert.deepEqual(scene.meta.rooms[0].triggers[0].actions.map(a=>a.target),[96,97,104,104,102,101]);
  const laraRoot=scene.nodes.findIndex(n=>n.extras?.itemId===lara.id);assert.equal(scene.nodes.filter(n=>n.name.startsWith(`Object ${lara.id} / Mesh `)).length,15);
  assert.deepEqual(scene.nodes[laraRoot].translation,[27.5,.25,-27.5]);
 }
 if(path.basename(filename).toUpperCase()==='MINES.TR2'){
  for(const [id,expectedWalls,expectedEqualHeightSectors] of [[1,26,18],[4,38,19]]){
   const room=scene.meta.rooms[id];assert.equal(room.wallSectors.length,expectedWalls);
   const open=room.mapSectors.map((s,i)=>({s,i})).filter(({s})=>s.floorHeight===-1792&&s.ceilingHeight===-1792);
   assert.equal(open.length,expectedEqualHeightSectors);
   for(const {s,i} of open){assert(!room.wallSectors.includes(i),'Slopes/splits with equal base heights are not solid walls');assert(s.floorData.some(c=>[2,7,8,11,12,13,14].includes(c.type)));}
   for(const i of room.wallSectors){assert.equal(room.mapSectors[i].floorHeight,-32512);assert.equal(room.mapSectors[i].ceilingHeight,-32512);}
  }
 }
 for(const cut of [100,2000,Math.floor(buffer.byteLength/2),buffer.byteLength-1])assert.throws(()=>parseLevel(buffer.slice(0,cut),'truncated.tr2'),/Truncated|Invalid/);
 const corrupted=buffer.slice(0);new DataView(corrupted).setUint32(4+768+1024,0xffffffff,true);assert.throws(()=>parseLevel(corrupted,'bad-count.tr2'),/count/);
 // Parser instances can be reused: palette material indices must not leak.
 const reused=parser.parse(buffer,'one.tr2');const again=parser.parse(buffer,'two.tr2');assert.deepEqual(again.materials,reused.materials);
 console.log(`PASS: TR3 parser, ${scene.meta.rooms.length} rooms / ${scene.meta.items.length} items, geometry/poses/texture references, floor-data framing, corrupt/truncated input, parser reuse.`);
}else console.log('PASS: format detection and TR3 floor-data validation. Set TR3_LEVEL for the JUNGLE.TR2 fixture.');
