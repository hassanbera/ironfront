async(page)=>{
 await page.setViewportSize({width:1280,height:720});
 return await page.evaluate(async()=>{
  const w=window.crowdLab;if(!w)throw Error('Lab not loaded');
  const original=w.update.bind(w),start=performance.now()/1000;
  w.update=(state,owner)=>{const t=performance.now()/1000-start;state.heroes[0].x=-15+t*6.5;state.heroes[0].z=60;state.heroes[0].y=0;state.heroes[0].facing=Math.PI/2;w.heroYaw=Math.PI/2;original(state,owner);};
  const point=w.camera.position.clone(),samples=[];
  await new Promise(resolve=>{const sample=()=>{
   const age=performance.now()/1000-start;
   if(age>1&&w.characters.ready){const batch=w.characters.models.get('knight').batches.get('body'),a=batch.mesh.instanceMatrix.array,i=(batch.count-1)*16;point.set(a[i+12],a[i+13]+1.5,a[i+14]).project(w.camera);samples.push({x:point.x*640,y:point.y*360});}
   if(age<5)requestAnimationFrame(sample);else resolve();
  };requestAnimationFrame(sample);});
  w.update=original;
  const range=k=>Math.max(...samples.map(s=>s[k]))-Math.min(...samples.map(s=>s[k]));
  const result={frames:samples.length,screenTravelX:range('x'),screenTravelY:range('y'),finite:samples.every(s=>Number.isFinite(s.x+s.y))};
  if(result.frames<30||!result.finite||result.screenTravelX>1||result.screenTravelY>1)throw Error('Hero camera follow regression: '+JSON.stringify(result));
  return result;
 });
}
