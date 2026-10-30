import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { DataUtils } from '../frontend/node_modules/three/build/three.module.js';
const root=new URL('../frontend/public/assets/characters/',import.meta.url);
const summary=[];
for(const name of ['knight','viking','ranger']){
  const meta=JSON.parse(await fs.readFile(new URL(name+'.json',root),'utf8'));
  const mesh=await fs.readFile(new URL(name+'-mesh.bin',root));
  const poses=await fs.readFile(new URL(name+'-poses.bin',root));
  assert.equal(poses.length,meta.bones*16*meta.frames*2);
  for(let i=0;i<poses.length;i+=2)assert.ok(Number.isFinite(DataUtils.fromHalfFloat(poses.readUInt16LE(i))),'Invalid bone matrix');
  for(const clip of Object.values(meta.animations)){
    assert.ok(clip.duration>0&&clip.frames>=2);
    assert.ok(clip.start>=0&&clip.start+clip.frames<=meta.frames);
  }
  for(const required of ['idle','walk','run','slash','stab','shoot','block','hit','death','dodge','jump','ride','ride_slash','ride_stab','ride_shoot'])assert.ok(meta.animations[required]);
  for(const required of ['back','strafeLeft','strafeRight','dodgeBack','dodgeLeft','dodgeRight','backslash','land','guardRun','guardBack','guardLeft','guardRight'])assert.ok(meta.animations[required],`Missing directional clip ${required}`);
  const data={};
  for(const [kind,attributes]of Object.entries(meta.geometries)){
    const fields={};
    for(const [key,field]of Object.entries(attributes)){
      assert.equal(field.offset%4,0);assert.ok(field.offset+field.length*4<=mesh.length);
      fields[key]=Array.from({length:field.length},(_,i)=>mesh.readFloatLE(field.offset+i*4));
      assert.ok(fields[key].every(Number.isFinite));
    }
    const vertices=fields.position.length/3;
    for(const i of fields.index)assert.ok(Number.isInteger(i)&&i>=0&&i<vertices);
    for(const i of fields.skinIndex)assert.ok(Number.isInteger(i)&&i>=0&&i<meta.bones);
    for(let i=0;i<fields.skinWeight.length;i+=4)assert.ok(Math.abs(fields.skinWeight.slice(i,i+4).reduce((a,b)=>a+b,0)-1)<.002);
    data[kind]=fields.index.length/3;
  }
  assert.ok(data.bodyFar<data.bodyMid&&data.bodyMid<data.body);
  const idle=meta.animations.idle.start*meta.bones*32,run=meta.animations.run.start*meta.bones*32;
  assert.notDeepEqual(poses.subarray(idle,idle+meta.bones*32),poses.subarray(run,run+meta.bones*32));
  summary.push({model:name,clips:Object.keys(meta.animations).length,triangles:[data.body,data.bodyMid,data.bodyFar]});
}
console.log(JSON.stringify({result:'PASS',checks:'finite poses, bounded indices, normalized weights, distinct animations and three LODs',models:summary},null,2));
