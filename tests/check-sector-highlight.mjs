import assert from 'node:assert/strict';
import {clipSectorTriangle} from '../docs/tools/ten-viewer/sector-highlight.js';
const min=[0,0,0],max=[1,10,1];
for(const [slopeX,slopeZ,height] of [[0,0,2],[.5,-.25,3],[-1,.75,7]]){
 const vertex=(x,z)=>[x,height+slopeX*x+slopeZ*z,z,x,z];
 const polygon=clipSectorTriangle([vertex(-2,-2),vertex(4,-2),vertex(-2,4)],min,max);
 assert(polygon.length>=4);
 for(const [x,y,z,u,v] of polygon){assert(Math.abs(y-height-slopeX*x-slopeZ*z)<1e-12,'Highlight must stay on its source floor/ceiling plane');assert.equal(u,x);assert.equal(v,z);assert(x>=0&&x<=1&&z>=0&&z<=1);}
 assert(Math.min(...polygon.map(v=>v[0]))>0);assert(Math.max(...polygon.map(v=>v[0]))<1);
}
const wall=[[0,-1,-1,0,0],[0,12,-1,1,0],[0,4,4,0,1]];
assert(clipSectorTriangle(wall,min,max).length>0,'Boundary walls remain selectable');
assert(clipSectorTriangle(wall,min,max).every(p=>p[0]===0));
assert.deepEqual(clipSectorTriangle(wall.map(p=>[-.1,...p.slice(1)]),min,max),[]);
assert.deepEqual(clipSectorTriangle([[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]],min,max),[]);
console.log('PASS: sloped floors/ceilings preserve plane and UV alignment; small inset; boundary walls; outside/degenerate faces.');
import {buildSectorColumn} from '../docs/tools/ten-viewer/sector-highlight.js';
const floor=(x,z)=>[x,2+.5*x-.25*z,z],ceiling=(x,z)=>[x,7-.3*x+.75*z,z];
const column=buildSectorColumn([[floor(-2,-2),floor(-2,4),floor(4,-2)],[ceiling(-2,-2),ceiling(4,-2),ceiling(-2,4)]],[0,0,0],[1,10,1]);
assert(column.sides.length>0);assert(column.lines.length>=72);
for(let i=0;i<column.lines.length;i+=3){const [x,y,z]=column.lines.slice(i,i+3);assert(x>0&&x<1&&z>0&&z<1);assert(Math.min(Math.abs(y-(2+.5*x-.25*z+.001)),Math.abs(y-(7-.3*x+.75*z-.001)))<1e-10);}
assert(buildSectorColumn([],min,max).lines.every(Number.isFinite));
console.log('PASS: separate column guide follows sloping floor/ceiling; open surfaces retain a finite guide.');
