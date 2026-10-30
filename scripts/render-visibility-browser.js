// Run in a fresh /crowd-lab.html on the optimized build.
async (page) => {
  await page.waitForFunction(() => window.crowdLab?.characters.ready);
  return page.evaluate(async () => {
    const w = window.crowdLab,
      update = w.update.bind(w),
      state = structuredClone(w.state);
    w.update = () => {};
    state.room = "VISIBILITY-QA";
    state.time = 100;
    state.squads = state.squads.slice(0, 1);
    const s = state.squads[0];
    s.alive = 2;
    s.slots = [0, 1];
    s.attackSlots = 0;
    s.attackAt = 0;
    const h = state.heroes[0];
    h.x = 0;
    h.z = 30;
    h.y = 0;
    h.facing = 0;
    state.crowd = [
      [s.id * 32, 0, 0],
      [s.id * 32 + 1, 0, 4500],
    ];
    const seen = new Set(),
      draw = w.characters.draw.bind(w.characters);
    w.characters.draw = (actor) => {
      seen.add(actor.id);
      draw(actor);
    };
    const frame = async () => {
      seen.clear();
      update(structuredClone(state), 0);
      for (let i = 0; i < 8; i++) await new Promise(requestAnimationFrame);
    };
    w.heroMode = true;
    w.heroYaw = 0;
    w.heroPitch = 0.12;
    await frame();
    if (seen.has(`${s.id}:0`) || !seen.has(`${s.id}:1`) || !seen.has("hero:0"))
      throw Error("Culling or local hero visibility failed");
    const oldX = w.bodies.get(s.id * 32).x;
    state.time += 0.1;
    state.crowd[0][1] = 200;
    await frame();
    if (w.bodies.get(s.id * 32).x <= oldX)
      throw Error("Culling froze body interpolation");
    w.heroYaw = Math.PI;
    h.facing = Math.PI;
    state.time += 0.1;
    await frame();
    if (!seen.has(`${s.id}:0`) || !seen.has("hero:0"))
      throw Error("Actor did not return after camera turn");
    for (const p of Object.values(w.parts)) p.count = 0;
    w.camera.position.set(0, 2, 0);
    w.drawMount(0, 5, 0, 0, false, true, 0);
    if (w.parts.horseLimb.count !== 8 || w.parts.horseLimbFar.count !== 0)
      throw Error("Nearby mount lost detailed gait");
    for (const p of Object.values(w.parts)) p.count = 0;
    for (let i = 0; i < 800; i++) w.drawMount(0, 50, 0, 0, false, true, i);
    if (w.parts.horseLimbFar.count !== 6400 || w.parts.horseHoof.count !== 3200)
      throw Error("Crowded mount limbs overflowed the instance buffer");
    for (const part of [
      "horseHeadFar",
      "horseNeckFar",
      "horseEarFar",
      "saddle",
    ])
      if (w.parts[part].count !== 1600)
        throw Error("Crowded mount part overflowed: " + part);
    const high = w.parts.horseLimb.mesh.geometry.index.count,
      low = w.parts.horseLimbFar.mesh.geometry.index.count;
    if (low >= high) throw Error("Distant mount detail not reduced");
    w.characters.draw = draw;
    return {
      offscreenDrawingCulled: true,
      bodyInterpolationContinues: true,
      cameraTurnRestores: true,
      localHeroVisible: true,
      nearMountLegs: 8,
      distantMountLegs: 6400,
      highLimbTriangles: high / 3,
      lowLimbTriangles: low / 3,
    };
  });
}
