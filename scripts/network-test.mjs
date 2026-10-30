import assert from 'node:assert/strict';
const url=process.env.TEST_WS_URL||'ws://127.0.0.1:8787/ws';
const peers=[];
function peer(hello){return new Promise((resolve,reject)=>{const ws=new WebSocket(url);const p={ws,state:null,welcome:null,errors:[],snapshots:0,waiters:[]};peers.push(p);const timeout=setTimeout(()=>reject(new Error('Handshake timeout')),5000);ws.addEventListener('open',()=>ws.send(JSON.stringify(hello)));ws.addEventListener('error',reject);ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.type==='welcome'){clearTimeout(timeout);p.welcome=m;resolve(p)}if(m.type==='error')p.errors.push(m.message);if(m.type==='state'){p.state=m;p.snapshots++;for(const w of p.waiters)w();}});ws.addEventListener('close',()=>{if(!p.welcome){clearTimeout(timeout);resolve(p)}})})}
function until(p,predicate,ms=4000){return new Promise((resolve,reject)=>{if(predicate(p.state))return resolve(p.state);const timer=setTimeout(()=>{p.waiters=p.waiters.filter(x=>x!==check);reject(new Error('State timeout'))},ms);const check=()=>{if(predicate(p.state)){clearTimeout(timer);p.waiters=p.waiters.filter(x=>x!==check);resolve(p.state)}};p.waiters.push(check)})}
function send(p,c){p.ws.send(JSON.stringify(c))}
try{
 const a=await peer({type:'create',name:'Test A',faction:0,heroClass:0,map:0});assert.ok(a.welcome.room.match(/^[A-F0-9]{6}$/));const room=a.welcome.room;
 const b=await peer({type:'join',room,name:'Test B',faction:1,heroClass:1});const c=await peer({type:'join',room,name:'Test C',faction:2,heroClass:2});const d=await peer({type:'join',room,name:'Test D',faction:3,heroClass:0});
 await until(a,s=>s?.players.filter(Boolean).length===4);assert.equal(a.state.phase,'lobby');
 const fifth=await peer({type:'join',room,name:'Fifth',faction:0,heroClass:0});assert.equal(fifth.welcome,null);assert.ok(fifth.errors.length);
 send(b,{type:'start',bots:false});await until(b,s=>s?.tick>3);assert.equal(b.state.phase,'lobby');
 send(a,{type:'start',bots:false});await Promise.all([a,b,c,d].map(p=>until(p,s=>s?.phase==='battle')));for(const p of[a,b,c,d]){assert.equal(p.state.squads.length,16);assert.equal(p.state.squads.reduce((n,s)=>n+s.alive,0),400);assert.equal(p.state.players.filter(x=>x.connected).length,4)}
 for(const p of [a,b,c,d]) {
  assert.equal(p.state.crowd.length,400);
  const keys=new Set(p.state.crowd.map(body=>body[0]));assert.equal(keys.size,400);
  for(const s of p.state.squads){assert.equal(s.slots.length,s.alive);for(const slot of s.slots)assert.ok(keys.has(s.id*32+slot));}
  for(const [key,x,z] of p.state.crowd){assert.ok(Number.isInteger(key)&&Number.isInteger(x)&&Number.isInteger(z));assert.ok(Math.abs(x)<=8500&&Math.abs(z)<=8500);}
 }
 const owned=a.state.squads.find(s=>s.owner===0),enemy=a.state.squads.find(s=>s.owner===1);const oldX=owned.x,oldZ=owned.z;const bodyKey=owned.id*32+owned.slots[0],oldBody=a.state.crowd.find(body=>body[0]===bodyKey);send(a,{type:'order',ids:[owned.id,enemy.id],order:'move',x:-30,z:-30});
 await until(d,s=>s?.squads.find(x=>x.id===owned.id).order==='move');assert.equal(d.state.squads.find(x=>x.id===enemy.id).order,'hold');await until(a,s=>Math.hypot(s.squads.find(x=>x.id===owned.id).x-oldX,s.squads.find(x=>x.id===owned.id).z-oldZ)>2);
 await until(d,s=>{const body=s.crowd.find(body=>body[0]===bodyKey);return Math.hypot(body[1]-oldBody[1],body[2]-oldBody[2])>100;});
 send(a,{type:'formation',ids:[owned.id],formation:2});await until(c,s=>s.squads.find(x=>x.id===owned.id).formation===2);
 send(b,{type:'hero',active:true});send(b,{type:'input',input:{x:1,z:0,facing:1,block:false}});await until(a,s=>s.heroes.find(h=>h.owner===1).active===true);
 const welcome=c.welcome;c.ws.close();await until(a,s=>s.players[2].connected===false);const resumed=await peer({type:'join',room,token:welcome.token,faction:2,heroClass:0});assert.equal(resumed.welcome.owner,2);await until(resumed,s=>s?.phase==='battle');assert.equal(resumed.state.players[2].heroClass,2);
 const invalid=await peer({type:'join',room,token:'wrong-token',faction:2,heroClass:0});assert.equal(invalid.welcome,null);assert.ok(invalid.errors.length);
 console.log(JSON.stringify({result:'PASS',checks:['4 real WebSocket clients','400 soldiers / 16 squads','400 stable soldier identities and compact body positions','5th player rejected','host-only start','ownership enforced','movement and soldier bodies replicated','formation replicated','hero state replicated','authenticated reconnect','invalid token rejected'],snapshots:[a,b,d,resumed].map(p=>p.snapshots)},null,2));
}finally{for(const p of peers)p.ws.close()}
