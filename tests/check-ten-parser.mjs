import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {decompress,parseTEN} from '../docs/tools/ten-viewer/ten-parser.js';

assert.deepEqual([...decompress(Uint8Array.from([0x30,65,66,67]),3)],[65,66,67]);
assert.deepEqual([...decompress(Uint8Array.from([0x10,65,1,0]),5)],[65,65,65,65,65]);
for(const [bytes,size] of [[[0xf0],1],[[0x00,0,0],4],[[0x30,65],3],[[0x10,65],2]])
  assert.throws(()=>decompress(Uint8Array.from(bytes),size));
assert.throws(()=>parseTEN(new Uint8Array(20).buffer),/Not a TEN/);
assert.throws(()=>parseTEN(Uint8Array.from([84,69,78,0,2,0,0,0]).buffer),/Unsupported TEN version/);

if(process.env.TEN_LEVEL){
  const bytes=fs.readFileSync(process.env.TEN_LEVEL);
  const scene=parseTEN(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),path.basename(process.env.TEN_LEVEL));
  assert(scene.meta.rooms.length>0);assert(scene.nodes.length>0);
  for(const mesh of scene.meshes)for(const p of mesh){
    assert(p.position.length%9===0);assert(p.uv.length===p.position.length/3*2);
    assert([...p.position,...p.uv].every(Number.isFinite));
  }
  // Optional comparison with an independently generated Python export.
  if(process.env.TEN_BASELINE){
    const root=process.env.TEN_BASELINE;
    const meta=JSON.parse(fs.readFileSync(path.join(root,'viewer/metadata.json')));
    assert.deepEqual(scene.meta.rooms,meta.rooms);
    assert.deepEqual(scene.meta.missingItems,meta.missingItems);
    assert.deepEqual(scene.meta.items.map(({color,...rest})=>rest),meta.items.map(({color,...rest})=>rest));
    for(let i=0;i<meta.bounds.length;i++){
      const actual=scene.meta.bounds[i],expected=meta.bounds[i];
      for(const key of ['room','name','itemId','kind','scale','bounds','position'])assert.deepEqual(actual[key],expected[key]);
      actual.rotation.forEach((v,j)=>assert(Math.abs(v-expected.rotation[j])<1e-12));
    }
    const gltf=JSON.parse(fs.readFileSync(path.join(root,'model/Only_Up.gltf')));
    const geometry=fs.readFileSync(path.join(root,'model/geometry.bin'));
    assert.equal(scene.nodes.length,gltf.nodes.length);assert.equal(scene.meshes.length,gltf.meshes.length);
    for(let i=0;i<scene.meshes.length;i++)for(let j=0;j<scene.meshes[i].length;j++){
      const actual=scene.meshes[i][j],p=gltf.meshes[i].primitives[j];
      for(const [key,attribute] of [['position','POSITION'],['uv','TEXCOORD_0'],['uv1','TEXCOORD_1']]){
        const a=gltf.accessors[p.attributes[attribute]],v=gltf.bufferViews[a.bufferView],offset=(v.byteOffset||0)+(a.byteOffset||0);
        const expected=geometry.subarray(offset,offset+v.byteLength);
        assert(Buffer.from(actual[key].buffer).equals(expected),`Mesh ${i}/${j} ${key} differs from offline export.`);
      }
    }
  }
  console.log(`PASS: TEN parser (${scene.meta.rooms.length} rooms, ${scene.meta.items.length} items); geometry/metadata parity if TEN_BASELINE supplied.`);
}else console.log('PASS: parser validation tests. Set TEN_LEVEL for an actual level and TEN_BASELINE for export comparison.');
