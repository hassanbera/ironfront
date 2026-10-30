import assert from 'node:assert/strict';
import {HeroTrack} from '../frontend/src/hero-track.ts';
const close=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
for(const fps of [30,60,144]){
 const track=new HeroTrack(),out={x:0,y:0,z:0};let packet=0;
 for(let frame=0;frame<fps*3;frame++){
  const now=frame/fps;
  while(packet/10<=now+1e-9){const t=packet++/10;track.push(t,{x:t*6.5,y:t,z:-t*2});}
  track.sample(now,out);
  if(now>.2){close(out.x,(now-HeroTrack.delay)*6.5);close(out.y,now-HeroTrack.delay);close(out.z,-(now-HeroTrack.delay)*2);}
 }
}
// Arrival jitter, direction change and a collision stop: interpolate only
// authoritative positions and hold during a missing-packet interval.
const track=new HeroTrack(),out={x:0,y:0,z:0};
const arrivals=[0,.11,.195,.31,.398,.505,.6];
const positions=[0,.65,1.3,1.95,2.6,2.6,2.6];
let next=0,last=0;
for(let frame=0;frame<180;frame++){
 const now=frame/120;
 while(next<arrivals.length&&arrivals[next]<=now){track.push(arrivals[next],{x:positions[next],y:0,z:0});next++;}
 track.sample(now,out);assert.ok(out.x>=last-1e-8&&out.x<=2.6,'jitter/packet loss must not reverse or overshoot');last=out.x;
}
close(out.x,2.6);
track.push(2,{x:80,y:0,z:0});track.sample(2,out);close(out.x,80);
track.push(2.1,{x:79.4,y:1,z:0});track.sample(2.17,out);close(out.x,79.7);close(out.y,.5);
console.log('PASS: constant render velocity at 30/60/144 FPS; jitter, collision stop, packet loss, teleport, reversal and jump interpolation');
