// Run on /crowd-lab.html?scene=hero400|hero800|rts800. Same fixed-step replay on both builds.
async (page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(
    () =>
      window.crowdLab?.characters.ready && window.crowdLab.models.size === 12,
  );
  return page.evaluate(async () => {
    const w = window.crowdLab;
    const scene = new URL(location.href).searchParams.get("scene") || "hero400";
    const count = scene.endsWith("800") ? 800 : 400;
    const base = structuredClone(w.state);
    base.room = "RENDER-REPLAY";
    const initial = structuredClone(base.squads);
    if (count === 800)
      base.squads.push(...initial.map((s) => ({ ...s, id: s.id + 1000 })));
    const ranged = [[1], [2], [2, 3], [0, 3]];
    for (const [j, s] of base.squads.entries()) {
      s.x = ((j % 4) - 1.5) * 14;
      s.z = 25 + Math.floor(j / 4) * 12;
      s.facing = j % 2 ? Math.PI : 0;
      s.alive = 25;
      s.slots = Array.from({ length: 25 }, (_, i) => i);
      s.engaged = true;
      s.attackSlots = 0x1ffffff;
      s.hitSlots = 0;
      s.order = "hold";
      s.formation = 1;
    }
    base.heroes[0].x = 0;
    base.heroes[0].z = 32;
    base.heroes[0].y = 0;
    w.heroMode = scene.startsWith("hero");
    w.heroYaw = 0;
    w.heroPitch = 0.12;
    w.distance = 72;
    w.azimuth = 0.3;
    w.focus.set(0, 0, 50);
    const update = w.update.bind(w),
      animate = w.animate.bind(w);
    w.update = () => {}; // Ignore only the diagnostic page's wall-time fixture.
    cancelAnimationFrame(w.animation);
    const times = { army: [], labels: [], render: [], update: [] },
      calls = [],
      triangles = [],
      actors = [],
      frames = [],
      gpu = [];
    let measuring = false,
      fixtureChecksum = 2166136261;
    for (const [method, key] of [
      ["drawArmy", "army"],
      ["drawLabels", "labels"],
      ["update", "update"],
    ]) {
      if (method === "update") continue;
      const original = w[method].bind(w);
      w[method] = (...args) => {
        const start = performance.now();
        const result = original(...args);
        if (measuring) times[key].push(performance.now() - start);
        return result;
      };
    }
    const gl = w.renderer.getContext(),
      ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    const pending = [];
    const render = w.renderer.render.bind(w.renderer);
    w.renderer.render = (...args) => {
      while (
        pending.length &&
        gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)
      ) {
        const q = pending.shift();
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT))
          gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(q);
      }
      const q =
        measuring && ext && pending.length < 8 ? gl.createQuery() : null;
      if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      const start = performance.now();
      render(...args);
      if (measuring) times.render.push(performance.now() - start);
      if (q) {
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        pending.push(q);
      }
    };
    const replay = (tick) => {
      const t = tick / 60;
      const s = structuredClone(base);
      s.time = 100 + t;
      const h = s.heroes[0];
      h.x = Math.sin(t * 0.6) * 5;
      h.z = 32 + Math.sin(t * 0.35) * 9;
      h.facing = 0.35 * Math.sin(t * 0.4);
      w.heroYaw = h.facing;
      h.attackAt = 100 + Math.floor(t / 1.5) * 1.5;
      h.attackDuration = 0.62;
      h.attackKind = Math.floor(t / 1.5) % 3;
      s.crowd = [];
      for (const [j, u] of s.squads.entries()) {
        const isRanged = ranged[u.owner].includes(u.class);
        const cycle = isRanged ? 1.2 : 0.9,
          duration = isRanged ? 1.05 : 0.82;
        const at = 100 + Math.floor(t / cycle) * cycle;
        u.attackAt = at;
        u.attackDuration = duration;
        u.attackImpact = at + duration * (isRanged ? 0.6 : 0.45);
        u.flash = Math.floor(t * 2) / 2 + 100;
        u.hitSlots = 1 << ((Math.floor(t * 2) + j) % 25);
        u.hp = Math.max(1, u.hp - (Math.floor(t * 2) % 10) * 4);
        for (let i = 0; i < 25; i++) {
          const x = u.x + ((i % 5) - 2) * 2.15 + Math.sin(t * 0.8 + j) * 0.3;
          const z =
            u.z + (Math.floor(i / 5) - 2) * 2.15 + Math.cos(t * 0.7 + j) * 0.3;
          s.crowd.push([
            u.id * 32 + i,
            Math.round(x * 100),
            Math.round(z * 100),
          ]);
          for (const value of s.crowd[s.crowd.length - 1])
            fixtureChecksum =
              Math.imul(fixtureChecksum ^ value, 16777619) >>> 0;
        }
        const target = s.squads[(j + 1) % s.squads.length];
        u.volley =
          isRanged && s.time >= u.attackImpact
            ? Array.from({ length: 3 }, (_, i) => ({
                at: u.attackImpact,
                land: u.attackImpact + 0.8,
                fromX: u.x + i,
                fromZ: u.z,
                height: 2,
                x: target.x,
                z: target.z,
                kind: "soldier",
                id: target.id,
                slot: i,
              }))
            : [];
      }
      const start = performance.now();
      update(s, 0);
      if (measuring) times.update.push(performance.now() - start);
    };
    const summarize = (a) => {
      if (!a.length) return null;
      const sorted = a.slice().sort((a, b) => a - b);
      return {
        median: +sorted[Math.floor(sorted.length * 0.5)].toFixed(3),
        p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(3),
        max: +sorted[sorted.length - 1].toFixed(3),
      };
    };
    // Fixed animation timestamps and updates: slower renderers do not skip soldiers, attacks or poses.
    let last = 0,
      start = 0;
    const epoch = 1000;
    w.time = epoch;
    w.last = epoch * 1000;
    w.frame = 0;
    w.characters.blends.clear();
    for (let i = 0; i < 600; i++) {
      const now = await new Promise(requestAnimationFrame);
      measuring = i >= 180;
      if (i === 180) start = now;
      if (i > 180) frames.push(now - last);
      last = now;
      w.time = epoch + i / 60;
      if (i % 6 === 0) replay(i);
      animate((epoch + i / 60) * 1000);
      cancelAnimationFrame(w.animation);
      if (measuring) {
        calls.push(w.drawCalls);
        triangles.push(w.renderer.info.render.triangles);
        actors.push(w.characters.count);
      }
    }
    w.renderer.render = render;
    for (const q of pending) gl.deleteQuery(q);
    const gpuInfo = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      scene,
      fixtureChecksum,
      source: location.origin,
      viewport: [innerWidth, innerHeight],
      dpr: devicePixelRatio,
      quality: w.quality,
      soldiers: count,
      frames: frames.length,
      fps: +((frames.length / (last - start)) * 1000).toFixed(1),
      frame: summarize(frames),
      over33ms: frames.filter((t) => t > 33.4).length,
      over50ms: frames.filter((t) => t > 50).length,
      cpu: Object.fromEntries(
        Object.entries(times).map(([k, v]) => [k, summarize(v)]),
      ),
      gpuMs: summarize(gpu),
      gpu: gpuInfo ? gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL) : null,
      calls: summarize(calls),
      triangles: summarize(triangles),
      actors: summarize(actors),
    };
  });
}
