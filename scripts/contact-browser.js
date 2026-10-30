// playwright-cli run-code --filename=scripts/contact-browser.js
// Open /crowd-lab.html in an isolated browser before running.
async (page) => {
  await page.waitForFunction(()=>window.crowdLab?.characters.ready);
  return page.evaluate(async()=>{
    const w=window.crowdLab;
    const update=w.update.bind(w);
    w.update=()=>{}; // Stop the lab's periodic fixture updates only.
    const state=structuredClone(w.state);
    state.room='CONTACT-QA'; state.time=10;
    state.heroes=[];
    const a=state.squads.find(s=>s.owner===0 && s.class===3);
    const b=state.squads.find(s=>s.owner===1 && s.class===1);
    state.squads=[a,b];
    for(const s of state.squads) {
      s.alive=2;s.slots=[0,1];s.attackAt=0;s.attackSlots=0;s.hitSlots=0;s.engaged=false;
      s.x=0;s.z=30;s.facing=0;
    }
    a.attackAt=9.85;a.attackSlots=1;
    state.crowd=[[a.id*32,0,3000],[a.id*32+1,0,2000],[b.id*32,0,3210],[b.id*32+1,1000,4500]];
    const seen=new Map();
    const draw=w.characters.draw.bind(w.characters);
    w.characters.draw=actor=>{seen.set(actor.id,{motion:actor.motion,hit:actor.hit});draw(actor)};
    update(state,0);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const front=seen.get(`${a.id}:0`),rear=seen.get(`${a.id}:1`);
    if(!front || !rear || front.motion===rear.motion || /slash|attack|stab|bow/.test(rear.motion))
      throw Error('Contact mask did not restrict attacking soldiers: '+JSON.stringify({front,rear}));
    const hitState=structuredClone(state); hitState.time=10.05;
    hitState.squads[1].hp-=4;hitState.squads[1].flash=10.05;hitState.squads[1].hitSlots=1;
    update(hitState,0);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    if(!seen.get(`${b.id}:0`)?.hit || seen.get(`${b.id}:1`)?.hit)
      throw Error('Impact mask highlighted the wrong soldier');
    w.characters.draw=draw;
    return {front,rear,exactImpact:true};
  });
}
