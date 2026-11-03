import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { DataUtils } from '../frontend/node_modules/three/build/three.module.js';
const root=new URL('../frontend/public/assets/characters/',import.meta.url);
const rules=JSON.parse(await fs.readFile(new URL('../server/rules.json',import.meta.url),'utf8'));
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
    if (kind.startsWith('duelBody')) {
      const joints = new Set(fields.skinIndex.filter((_, i) => fields.skinWeight[i] > 0));
      for (const grip of [meta.bones-3, meta.bones-2]) {
        assert.equal(joints.has(grip), kind === 'duelBodyFar', name+' '+kind+' equipment binding');
      }
    }
    data[kind]=fields.index.length/3;
  }
  assert.ok(data.bodyFar<data.bodyMid&&data.bodyMid<data.body);
  const kits = {knight:['Knight'],viking:['Norse','NorseBow','NorseFur'],
    ranger:['Longbow','Arab','ArabCamel','ArabJavelin','ArabBow','Turk','TurkBow']}[name];
  for (const kit of kits) {
    const label='field'+kit;
    assert.ok(data[label]>data[label+'Mid'] && data[label+'Mid']>data[label+'Far'] && data[label+'Far']>0,
      label+' needs three decreasing LODs');
  }
  if (name === 'knight' || name === 'ranger') {
    assert.ok(data.duelBodyMid < data.duelBody, 'Mid costume should reduce geometry');
    assert.ok(data.duelBodyFar < data.duelBodyMid + data.duelSword, 'Far figure includes its weapon');
    assert.ok(data.duelBodyFar <= 420, 'Distant armored figure including equipment exceeds its crowd budget');
    assert.ok(data.duelSword > 0 && data.duelSword < 500, 'Duel equipment triangle budget');
    for (const motion of ['slash','backslash','stab','blockHit','hit','walk','run','dodgeLeft','dodgeRight']) {
      assert.equal(meta.animations['duel_'+motion]?.duration, meta.animations[motion].duration);
    }
    const rising=meta.animations.duel_risingCut;
    const opening=rules.swordChain.steps[0];
    assert.equal(rising.duration,opening.duration);
    function bladeTip(phase) {
      const frame=rising.start+Math.round(phase*(rising.frames-1));
      const socket=(frame*meta.bones+meta.bones-3)*32;
      return [0,1,2].map(axis=>[...meta.duelBladeTip,1].reduce((sum,component,i)=>
        sum+component*DataUtils.fromHalfFloat(poses.readUInt16LE(socket+2*(i*4+axis))),0));
    }
    const before=bladeTip(opening.impact-.08), contact=bladeTip(opening.impact), after=bladeTip(opening.impact+.08);
    assert.ok(before[0]<-.5 && after[0]>.5 && after[1]>before[1]+.4, name+' rising cut must sweep up from the sword side');
    assert.ok(Math.abs(contact[0])<.04 && contact[2]>1, name+' rising cut missed the server impact');
    for (const motion of ['slash','backslash']) {
      const clip = meta.animations['duel_'+motion];
      const impact = name === 'ranger' ? .42 : .45;
      const frame = clip.start + Math.round(impact * (clip.frames-1));
      const socket = (frame * meta.bones + meta.bones-3) * 32;
      const element = i => DataUtils.fromHalfFloat(poses.readUInt16LE(socket + i*2));
      const tip = meta.duelBladeTip;
      assert.ok(tip.length===3 && tip.every(Number.isFinite));
      if (name==='ranger') assert.ok(tip[0]<-.2, 'Kilij tip must sweep toward the spine in grip space');
      const x = element(0)*tip[0] + element(4)*tip[1] + element(12);
      const z = element(2)*tip[0] + element(6)*tip[1] + element(14);
      assert.ok(Math.abs(x)<.035 && z>1, name+' '+motion+' missed the forward impact line');
    }
  }
  const idle=meta.animations.idle.start*meta.bones*32,run=meta.animations.run.start*meta.bones*32;
  assert.notDeepEqual(poses.subarray(idle,idle+meta.bones*32),poses.subarray(run,run+meta.bones*32));
  summary.push({model:name,clips:Object.keys(meta.animations).length,triangles:[data.body,data.bodyMid,data.bodyFar]});
}
console.log(JSON.stringify({result:'PASS',checks:'finite poses, bounded indices, normalized weights, distinct animations and three LODs',models:summary},null,2));
