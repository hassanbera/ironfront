// Open /crowd-lab.html, then run with playwright-cli run-code --filename=...
async (page) => {
  await page.waitForFunction(() => window.crowdLab?.characters.ready);
  return page.evaluate(async () => {
    const w = window.crowdLab,
      update = w.update.bind(w);
    const state = structuredClone(w.state);
    state.room = "TIMING-QA";
    state.heroes = [];
    state.time = 10;
    const a = state.squads.find((s) => s.owner === 0 && s.class === 3);
    const b = state.squads.find((s) => s.owner === 1 && s.class === 1);
    state.squads = [a, b];
    for (const s of state.squads) {
      s.slots = [0, 1];
      s.alive = 2;
      s.x = 0;
      s.z = 30;
      s.facing = 0;
      s.attackAt = 0;
      s.attackSlots = 0;
      s.hitSlots = 0;
      s.volley = [];
    }
    state.crowd = [
      [a.id * 32, 0, 3000],
      [a.id * 32 + 1, 0, 2000],
      [b.id * 32, 0, 5000],
      [b.id * 32 + 1, 1000, 5000],
    ];
    w.update = () => {};
    w.serverNow = () => state.time;
    const seen = new Map(),
      draw = w.characters.draw.bind(w.characters);
    w.characters.draw = (actor) => {
      seen.set(actor.id, {
        motion: actor.motion,
        phase: actor.phase / w.characters.duration(actor.model, actor.motion),
        hit: actor.hit,
      });
      draw(actor);
    };
    async function frame(time) {
      state.time = time;
      update(structuredClone(state), 0);
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);
    }
    a.attackAt = 10;
    a.attackDuration = 0.82;
    a.attackSlots = 1;
    await frame(10.74);
    const lateSwing = seen.get(`${a.id}:0`);
    if (!lateSwing || lateSwing.phase < 0.89 || lateSwing.motion !== "slash")
      throw Error("Attack clip ended/restarted before recovery");
    await frame(10.83);
    if (seen.get(`${a.id}:0`)?.motion === "slash")
      throw Error("Clip did not finish");
    a.class = 1;
    a.attackAt = 12;
    a.attackDuration = 1.05;
    a.attackImpact = 12.63;
    await frame(12.4);
    if (w.arrows.count !== 0) throw Error("Arrow drawn during preparation");
    const shot = {
      at: 12.63,
      land: 13.2,
      fromX: 0,
      fromZ: 30,
      height: 2,
      x: 0,
      z: 50,
      kind: "soldier",
      id: b.id,
      slot: 0,
    };
    a.volley = [shot];
    await frame(12.8);
    if (w.arrows.count !== 1) throw Error("Released arrow missing");
    await frame(12.95);
    if (w.arrows.count !== 1) throw Error("Snapshot replay duplicated arrow");
    b.hp -= 5;
    b.flash = 13.2;
    b.hitSlots = 1;
    await frame(13.2);
    if (w.arrows.count !== 0 || !seen.get(`${b.id}:0`)?.hit)
      throw Error("Arrival and target impact did not coincide");
    const arrowGeometry = w.arrows.geometry;
    a.volley = Array.from({ length: 96 }, (_, i) => ({
      ...shot,
      at: 14,
      land: 16,
      fromX: (i % 8) - 4,
    }));
    await frame(14.2);
    // Isolate the arrow batch from asynchronous environment-asset uploads.
    const probe = w.scene.clone(false);
    probe.add(w.arrows);
    const geometryCount = w.renderer.info.memory.geometries;
    w.renderer.render(probe, w.camera);
    const calls = w.renderer.info.render.calls;
    w.scene.add(w.arrows);
    if (
      w.arrows.count !== 96 ||
      calls !== 1 ||
      w.arrows.geometry !== arrowGeometry ||
      w.renderer.info.memory.geometries !== geometryCount
    )
      throw Error(
        "Projectile batch regression: " +
          JSON.stringify({
            count: w.arrows.count,
            calls,
            geometryCount,
            after: w.renderer.info.memory.geometries,
          }),
      );
    w.characters.draw = draw;
    return {
      lateSwing,
      releaseAndArrival: true,
      deduplicated: true,
      projectiles: 96,
      extraDrawCalls: 1,
      extraGeometries: 0,
    };
  });
}
