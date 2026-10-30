async (page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() => window.crowdLab?.characters.ready);
  await page.waitForTimeout(5000);
  return page.evaluate(async () => {
    const w = window.crowdLab,
      render = w.renderer.render.bind(w.renderer);
    const samples = [],
      frames = [],
      projectile = [];
    let last = performance.now(),
      phase = 0;
    w.renderer.render = (...args) => {
      const at = performance.now();
      render(...args);
      samples.push(performance.now() - at);
      frames.push(at - last);
      last = at;
    };
    const draw = w.drawProjectiles?.bind(w);
    if (draw)
      w.drawProjectiles = () => {
        const at = performance.now();
        draw();
        projectile.push(performance.now() - at);
        if (phase === 2) w.arrows.visible = false;
      };
    const stats = (a) => {
      a.sort((a, b) => a - b);
      return {
        median: a[Math.floor(a.length * 0.5)],
        p95: a[Math.floor(a.length * 0.95)],
      };
    };
    const results = [];
    const fire = () => {
      for (const s of w.state.squads) w.shoot(s);
    };
    let timer;
    try {
      for (phase = 0; phase < (draw ? 4 : 2); phase++) {
        if (phase === 1) {
          fire();
          timer = setInterval(fire, 750);
        }
        samples.length = frames.length = projectile.length = 0;
        last = performance.now();
        await new Promise((resolve) => setTimeout(resolve, 10000));
        results.push({
          phase,
          render: stats(samples),
          frame: stats(frames),
          arrows: stats(projectile),
          fps: frames.length / 10,
          drawCalls: w.drawCalls,
          projectileCount: w.projectiles.length,
        });
      }
    } finally {
      clearInterval(timer);
      w.renderer.render = render;
      if (draw) w.drawProjectiles = draw;
    }
    return { url: location.href, results };
  });
}
