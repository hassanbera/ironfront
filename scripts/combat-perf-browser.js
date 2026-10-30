// Open /crowd-lab.html. Samples idle and a repeatable representative volley load.
async (page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() => window.crowdLab?.characters.ready);
  await page.waitForTimeout(5000);
  return page.evaluate(async () => {
    const w = window.crowdLab;
    let timer;
    const results = [];
    try {
      for (const volley of [false, true]) {
        if (volley) {
          const fire = () => {
            for (const s of w.state.squads) w.shoot(s);
          };
          fire();
          timer = setInterval(fire, 750);
        }
        const result = await new Promise((resolve) => {
          const frames = [],
            calls = [];
          let last = performance.now();
          const start = last;
          const frame = (now) => {
            frames.push(now - last);
            calls.push(w.drawCalls);
            last = now;
            if (now - start < 10000) {
              requestAnimationFrame(frame);
              return;
            }
            frames.sort((a, b) => a - b);
            calls.sort((a, b) => a - b);
            resolve({
              fps: Math.round((frames.length / (now - start)) * 10000) / 10,
              p95ms:
                Math.round(frames[Math.floor(frames.length * 0.95)] * 10) / 10,
              medianCalls: calls[Math.floor(calls.length * 0.5)],
              triangles: w.renderer.info.render.triangles,
            });
          };
          requestAnimationFrame(frame);
        });
        results.push({ mode: volley ? "volley" : "idle", ...result });
      }
      const gl = w.renderer.getContext(),
        ext = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        url: location.href,
        viewport: [innerWidth, innerHeight],
        gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unavailable",
        results,
      };
    } finally {
      clearInterval(timer);
    }
  });
}
