import assert from 'node:assert/strict';
import {heroMovement, movementClip} from '../frontend/src/hero-controls.ts';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2,.73]) {
  const forward={x:Math.sin(yaw),z:Math.cos(yaw)},right={x:-Math.cos(yaw),z:Math.sin(yaw)};
  for(const [key,alias,v,sign,clip] of [
    ['KeyW','ArrowUp',forward,1,'run'],['KeyS','ArrowDown',forward,-1,'back'],
    ['KeyD','ArrowRight',right,1,'strafeRight'],['KeyA','ArrowLeft',right,-1,'strafeLeft']]) {
    const move=heroMovement(new Set([key]),yaw);
    near(move.x,v.x*sign);near(move.z,v.z*sign);
    assert.deepEqual(move,heroMovement(new Set([alias]),yaw));
    assert.deepEqual(move,heroMovement(new Set([key,alias]),yaw));
    assert.equal(movementClip(move.x,move.z,yaw),clip);
  }
  const diagonal=heroMovement(new Set(['KeyW','KeyD']),yaw);
  near(Math.hypot(diagonal.x,diagonal.z),1);
  const stopped=heroMovement(new Set(['KeyW','KeyS','ArrowLeft','KeyD']),yaw);
  near(stopped.x,0);near(stopped.z,0);
  assert.equal(movementClip(-forward.x,-forward.z,yaw,true),'dodgeBack');
  assert.equal(movementClip(right.x,right.z,yaw,true),'dodgeRight');
}
assert.equal(heroMovement(new Set(['Block']),0).block,true);
console.log('PASS: camera-relative WASD/arrows at five yaw angles; aliases, diagonal speed, cancellation, strafe and dodge clips');
