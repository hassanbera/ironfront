// Offline conversion of the CC0 KayKit source models. No runtime bone/mixer per soldier.
// Usage: node scripts/bake-characters.mjs <directory containing the three source GLBs>
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as T from '../frontend/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../frontend/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries, mergeVertices } from '../frontend/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from '../frontend/node_modules/meshoptimizer/meshopt_simplifier.js';
await MeshoptSimplifier.ready;

globalThis.ProgressEvent ??= class { constructor(type, data) { Object.assign(this, { type }, data); } };
const source = process.argv[2];
if (!source) throw new Error('Pass the downloaded KayKit source directory. See characters/SOURCES.md.');
const output = new URL('../frontend/public/assets/characters/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const clips = {
  idle:'Idle', walk:'Walking_A', run:'Running_A', slash:'1H_Melee_Attack_Slice_Horizontal',
  chop:'2H_Melee_Attack_Chop', stab:'1H_Melee_Attack_Stab', dual:'Dualwield_Melee_Attack_Chop',
  shoot:'2H_Ranged_Shooting', throw:'Throw', block:'Blocking', blockHit:'Block_Hit',
  hit:'Hit_A', death:'Death_A', deathAlt:'Death_B', dodge:'Dodge_Forward', jump:'Jump_Idle', ride:'Sit_Chair_Pose',
  ride_slash:'1H_Melee_Attack_Slice_Horizontal', ride_stab:'1H_Melee_Attack_Stab', ride_shoot:'2H_Ranged_Shooting',
};
const hashes=[];
for (const [name,file] of [['knight','Knight'],['viking','Barbarian'],['ranger','Rogue_Hooded']]) {
  const original=await fs.readFile(path.join(source,file+'.glb'));
  hashes.push({file:file+'.glb',sha256:crypto.createHash('sha256').update(original).digest('hex')});
  const jsonLen=original.readUInt32LE(12), j=JSON.parse(original.subarray(20,20+jsonLen));
  const bin=original.subarray(28+jsonLen);
  const image=j.images[0], view=j.bufferViews[image.bufferView];
  await fs.writeFile(new URL(name+'.png',output),bin.subarray(view.byteOffset,view.byteOffset+view.byteLength));
  j.images=[];j.textures=[];j.materials=[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}];
  j.buffers=[{byteLength:bin.length,uri:'data:application/octet-stream;base64,'+bin.toString('base64')}];
  for(const mesh of j.meshes)for(const p of mesh.primitives)p.material=0;
  const gltf=await new GLTFLoader().parseAsync(JSON.stringify(j),'');
  const scene=gltf.scene;scene.updateMatrixWorld(true);
  const all=[];scene.traverse(o=>{if(o.isMesh)all.push(o)});
  const skinned=all.find(o=>o.isSkinnedMesh), skeleton=skinned.skeleton;
  const pieces=all.filter(o=>o.isSkinnedMesh||/_(Helmet|Hat|Cape)$/.test(o.name));
  const staticPieces=pieces.filter(o=>!o.isSkinnedMesh);
  const slotR=scene.getObjectByName('handslotr'), slotL=scene.getObjectByName('handslotl');
  // GLTFLoader sanitizes dots in node names for animation property bindings.
  if(!slotR||!slotL)throw new Error('Missing weapon sockets');
  const stringCenter=new T.Object3D();
  const extras=[...staticPieces,slotR,slotL,stringCenter];
  const bones=skeleton.bones.length+extras.length;
  const socketR=skeleton.bones.length+extras.indexOf(slotR), socketL=socketR+1;
  const socketString=socketL+1;
  const body=[];
  function attributes(g,joint=0,paint=[1,1,1,0]) {
    const count=g.attributes.position.count;
    if(!g.attributes.normal)g.computeVertexNormals();
    if(!g.attributes.uv)g.setAttribute('uv',new T.BufferAttribute(new Float32Array(count*2),2));
    if(!g.attributes.skinIndex){
      const si=new Float32Array(count*4), sw=new Float32Array(count*4);
      for(let i=0;i<count;i++){si[i*4]=joint;sw[i*4]=1}
      g.setAttribute('skinIndex',new T.BufferAttribute(si,4));g.setAttribute('skinWeight',new T.BufferAttribute(sw,4));
    }else g.setAttribute('skinIndex',new T.BufferAttribute(new Float32Array(g.attributes.skinIndex.array),4));
    const p=new Float32Array(count*4);for(let i=0;i<count;i++)p.set(paint,i*4);
    g.setAttribute('paint',new T.BufferAttribute(p,4));
    for(const a of Object.keys(g.attributes))if(!['position','normal','uv','skinIndex','skinWeight','paint'].includes(a))g.deleteAttribute(a);
    return g.toNonIndexed();
  }
  for(const p of pieces)body.push(attributes(p.geometry.clone(),skeleton.bones.length+extras.indexOf(p),/Cape/.test(p.name)?[1,1,1,2]:p.isSkinnedMesh&&!/Head/.test(p.name)?[1,1,1,3]:[1,1,1,0]));
  const geometry=mergeGeometries(body);
  const mixer=new T.AnimationMixer(scene);
  const animations={}, mats=[];
  const sourceClips=new Map(gltf.animations.map(c=>[c.name,c]));
  const sit=mixer.clipAction(sourceClips.get('Sit_Chair_Pose'));sit.play();mixer.setTime(0);
  const seated=skeleton.bones.filter(b=>/^(upperleg|lowerleg|foot|toes)/.test(b.name)).map(b=>({bone:b,rotation:b.quaternion.clone()}));
  const hip=scene.getObjectByName('hips'),sitHeight=hip.position.clone();
  mixer.stopAllAction();
  const tmp=new T.Matrix4();
  const v0=new T.Vector3(),v1=new T.Vector3(),v2=new T.Vector3(),q0=new T.Quaternion(),q1=new T.Quaternion();
  function pointBone(bone,child,target) {
    bone.getWorldPosition(v0);child.getWorldPosition(v1);
    const delta=new T.Quaternion().setFromUnitVectors(v1.sub(v0).normalize(),v2.copy(target).sub(v0).normalize());
    bone.getWorldQuaternion(q0);bone.parent.getWorldQuaternion(q1);
    bone.quaternion.copy(q1.invert().multiply(delta.multiply(q0)));scene.updateMatrixWorld(true);
  }
  function arm(side,target,pole) {
    const upper=scene.getObjectByName('upperarm'+side),lower=scene.getObjectByName('lowerarm'+side),hand=scene.getObjectByName('hand'+side);
    const a=upper.getWorldPosition(new T.Vector3()),b=lower.getWorldPosition(new T.Vector3()),c=hand.getWorldPosition(new T.Vector3());
    const l1=a.distanceTo(b),l2=b.distanceTo(c),dir=target.clone().sub(a),distance=T.MathUtils.clamp(dir.length(),Math.abs(l1-l2)+.001,l1+l2-.001);dir.normalize();
    const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));
    const bend=pole.clone().addScaledVector(dir,-pole.dot(dir)).normalize();
    const elbow=a.clone().addScaledVector(dir,along).addScaledVector(bend,height);
    pointBone(upper,lower,elbow);pointBone(lower,hand,target);
  }
  function bowPose(t) {
    scene.updateMatrixWorld(true);
    const shoulder=scene.getObjectByName('upperarml').getWorldPosition(new T.Vector3());
    const pull=t<.62?Math.min(1,t/.5):Math.max(0,1-(t-.62)/.12);
    const left=new T.Vector3(.18,shoulder.y+.035,.53),right=new T.Vector3(-.16,shoulder.y+.02,.47-pull*.39);
    arm('l',left,new T.Vector3(1,-.15,0));arm('r',right,new T.Vector3(-1,.15,-.4));
    for(const [slot,position]of [[slotL,left],[slotR,right]]) {
      slot.position.copy(slot.parent.worldToLocal(position.clone()));
      slot.parent.getWorldQuaternion(q0);slot.quaternion.copy(q0.invert());
    }
    scene.updateMatrixWorld(true);
  }
  for(const [key,clipName]of Object.entries(clips)) {
    const clip=sourceClips.get(clipName);if(!clip)throw new Error('Missing clip: '+clipName);
    mixer.stopAllAction();const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
    const frames=Math.max(2,Math.ceil(clip.duration*24)+1),start=mats.length/(bones*16);
    animations[key]={start,frames,duration:clip.duration};
    for(let frame=0;frame<frames;frame++) {
      mixer.setTime(Math.min(clip.duration-0.00001,frame/(frames-1)*clip.duration));
      const restored=[];
      if(key==='shoot'||key==='ride_shoot') for(const nodeName of ['upperarml','lowerarml','upperarmr','lowerarmr','handslotl','handslotr']) { const node=scene.getObjectByName(nodeName);restored.push({node,position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()}); }
      if(key.startsWith('ride_')) { for(const part of seated)part.bone.quaternion.copy(part.rotation);hip.position.copy(sitHeight); }
      if(key==='shoot'||key==='ride_shoot') bowPose(frame/(frames-1));
      const head=scene.getObjectByName('head');head.scale.multiplyScalar(0.60);
      scene.updateMatrixWorld(true);
      stringCenter.matrixWorld.copy(key==='shoot'||key==='ride_shoot'?slotR.matrixWorld:slotL.matrixWorld.clone().multiply(new T.Matrix4().makeTranslation(0,0,-.22)));
      for(let b=0;b<skeleton.bones.length;b++) {
        tmp.multiplyMatrices(skeleton.bones[b].matrixWorld,skeleton.boneInverses[b]);
        mats.push(...tmp.elements);
      }
      for(const extra of extras)mats.push(...extra.matrixWorld.elements);
      head.scale.multiplyScalar(1/0.60);
      for(const saved of restored){saved.node.position.copy(saved.position);saved.node.quaternion.copy(saved.quaternion);saved.node.scale.copy(saved.scale)}
    }
  }
  mixer.stopAllAction();scene.updateMatrixWorld(true);
  const boxes=new T.Box3();for(const mesh of pieces){mesh.computeBoundingBox?.();boxes.union(new T.Box3().setFromObject(mesh))}
  const boneData=new Uint16Array(mats.length);for(let i=0;i<mats.length;i++)boneData[i]=T.DataUtils.toHalfFloat(mats[i]);
  await fs.writeFile(new URL(name+'-poses.bin',output),Buffer.from(boneData.buffer));

  // Weapons are socket-bound geometry, so hands and equipment share exactly the same pose.
  const equipment={};
  function asset(nodeName) {
    const mesh=all.find(o=>o.name===nodeName);if(!mesh)return null;
    const slot=mesh.parent===slotL?slotL:slotR;
    const g=mesh.geometry.clone().applyMatrix4(new T.Matrix4().copy(slot.matrixWorld).invert().multiply(mesh.matrixWorld));
    return attributes(g,slot===slotL?socketL:socketR);
  }
  const sword=asset('1H_Sword')||asset('1H_Axe')||asset('Knife');
  const shield=asset('Badge_Shield')||asset('Barbarian_Round_Shield');
  const axe=asset('2H_Axe')||sword;
  const leftAxe=asset('1H_Axe_Offhand')||asset('1H_Sword_Offhand')||asset('Knife_Offhand');
  const metal=new T.Color('#aeb9bd'),wood=new T.Color('#684a31');
  function handmade(g,joint,col){return attributes(g,joint,[col.r,col.g,col.b,1])}
  // Weapons point along socket +Y, matching the source sword grip.
  const spear=mergeGeometries([
    handmade(new T.CylinderGeometry(.026,.032,2.7,7).translate(0,0.65,0),socketR,wood),
    handmade(new T.ConeGeometry(.09,.4,4).rotateY(Math.PI/4).translate(0,2.18,0),socketR,metal),
  ]);
  const bowCurve=new T.CatmullRomCurve3([new T.Vector3(0,-.65,-.22),new T.Vector3(0,-.32,-.04),new T.Vector3(0,0,0),new T.Vector3(0,.32,-.04),new T.Vector3(0,.65,-.22)]);
  function stringHalf(sign){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-.007,sign*.65,-.22,.007,sign*.65,-.22,.007,0,0,-.007,0,0],3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();
    const prepared=attributes(g,socketL,[.8,.76,.59,1]);
    for(let i=0;i<prepared.attributes.position.count;i++)if(prepared.attributes.position.getY(i)===0)prepared.attributes.skinIndex.setX(i,socketString);
    return prepared;
  }
  const bow=mergeGeometries([
    handmade(new T.TubeGeometry(bowCurve,12,.028,5,false),socketL,wood),
    stringHalf(1),stringHalf(-1),
    handmade(new T.CylinderGeometry(.012,.012,.85,5).rotateX(Math.PI/2).translate(0,0,.4),socketR,wood),
    handmade(new T.ConeGeometry(.035,.12,4).rotateX(Math.PI/2).translate(0,0,.88),socketR,metal),
  ]);
  const genericShield=handmade(new T.CylinderGeometry(.36,.36,.065,12).rotateX(Math.PI/2).translate(0,0,.16),socketL,new T.Color('#697674'));
  for(const [kind,parts]of Object.entries({sword:[sword,shield||genericShield],spear:[spear,shield||genericShield],axe:[axe],dual:[sword,leftAxe],bow:[bow],javelin:[spear,shield||genericShield]})) equipment[kind]=mergeGeometries(parts.filter(Boolean));
  const bodyIndexed=mergeVertices(geometry);
  const lods={};
  for(const [key,ratio,error]of [['bodyMid',.28,.018],['bodyFar',.1,.035]]) {
    const lod=bodyIndexed.clone();
    const [indices]=MeshoptSimplifier.simplify(new Uint32Array(lod.index.array),lod.attributes.position.array,3,Math.floor(lod.index.count*ratio/3)*3,error,['Permissive']);
    lod.setIndex(new T.BufferAttribute(indices,1));lods[key]=lod;
  }
  const blobs=[],geometries={};let byteOffset=0;
  for(const [key,unindexed]of Object.entries({body:geometry,...lods,...equipment})) {
    const g=mergeVertices(unindexed);
    const fields={};
    for(const [a,attr]of Object.entries({...g.attributes,index:g.index})) {
      const data=new Float32Array(attr.array);
      fields[a]={offset:byteOffset,length:data.length,size:attr.itemSize};
      const blob=Buffer.from(data.buffer);blobs.push(blob);byteOffset+=blob.length;
    }
    geometries[key]=fields;
  }
  await fs.writeFile(new URL(name+'-mesh.bin',output),Buffer.concat(blobs));
  await fs.writeFile(new URL(name+'.json',output),JSON.stringify({bones,frames:mats.length/(bones*16),height:boxes.max.y-boxes.min.y,animations,geometries}));
  console.log(name,JSON.stringify({bones,frames:mats.length/(bones*16),bodyTriangles:geometry.attributes.position.count/3,lodTriangles:Object.values(lods).map(g=>g.index.count/3),meshBytes:byteOffset,poseBytes:boneData.byteLength}));
}
await fs.copyFile(path.join(source,'LICENSE.txt'),new URL('LICENSE-KayKit.txt',output));
await fs.writeFile(new URL('provenance.json',output),JSON.stringify({source:'https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0',license:'CC0-1.0',sourceFiles:hashes},null,2));
