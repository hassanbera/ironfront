import { World } from "./world";
import { previewState, rules, type Hero } from "./types";
const world = new World(document.querySelector("#scene")!);
world.setQuality("high");
// Explicit diagnostic surface on this isolated lab page only.
Object.assign(window, { crowdLab: world });
const state = previewState(0);
state.room = "LOCAL-LAB";
state.phase = "battle";
for (const [i, s] of state.squads.entries()) {
  s.x = ((i % 4) - 1.5) * 10;
  s.z = 30 + Math.floor(i / 4) * 10;
  s.facing = Math.PI;
  s.formation = 1;
}
state.heroes = [
  {
    owner: 0,
    class: 0,
    x: 0,
    z: 22,
    y: 0,
    facing: 0,
    hp: rules.heroes[0].hp,
    stamina: 100,
    active: true,
    block: false,
    respawn: 0,
    attackAt: 0,
    dodgeUntil: 0,
    skillReady: 0,
    guardUntil: 0,
  } as Hero,
];
world.update(state, 0);
world.heroMode = true;
world.heroYaw = 0;
const start = performance.now();
document.querySelector("#occlusion")!.addEventListener("click", () => {
  state.heroes[0].x = -5;
  state.heroes[0].z = 36;
  world.heroYaw = 0;
  world.heroPitch = -0.15;
});
setInterval(() => {
  state.time = (performance.now() - start) / 1000;
  for (const s of state.squads) {
    s.z += Math.sin(state.time * 0.8) * 0.025;
  }
  world.update(structuredClone(state), 0);
}, 100);
document.querySelector("#measure")!.addEventListener("click", async () => {
  state.heroes[0].x = 0;
  state.heroes[0].z = 22;
  world.heroYaw = 0;
  world.heroPitch = 0.24;
  const button = document.querySelector<HTMLButtonElement>("#measure")!;
  button.disabled = true;
  const samples: number[] = [];
  let last = performance.now();
  const until = last + 10000;
  const frame = (now: number) => {
    samples.push(now - last);
    last = now;
    if (now < until) {
      requestAnimationFrame(frame);
      return;
    }
    samples.sort((a, b) => a - b);
    const result = {
      frames: samples.length,
      fps:
        Math.round(
          (samples.length / samples.reduce((a, b) => a + b, 0)) * 10000,
        ) / 10,
      p50ms: samples[Math.floor(samples.length * 0.5)],
      p95ms: samples[Math.floor(samples.length * 0.95)],
      over50ms: samples.filter((n) => n > 50).length,
      calls: world.renderer.info.render.calls,
      triangles: world.renderer.info.render.triangles,
    };
    document.querySelector("#result")!.textContent = JSON.stringify(
      result,
      null,
      2,
    );
    button.disabled = false;
  };
  requestAnimationFrame(frame);
});
setTimeout(
  () =>
    (document.querySelector("#result")!.textContent = "Hazır · ölçümü başlat"),
  2500,
);
