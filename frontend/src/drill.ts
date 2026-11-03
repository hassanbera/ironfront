import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Characters, outfit } from "./characters";
import { rules } from "./types";
import { swordLabels, swordMotion, swordPhase, swordSteps } from "./sword-chain";
const duel = new URLSearchParams(location.search).has("duel");

document.head.insertAdjacentHTML(
  "beforeend",
  `<style>
*{box-sizing:border-box}body{margin:0;background:#17201d;color:#eee9dc;font:16px Barlow,Arial,sans-serif}canvas{display:block;width:100vw;height:100vh}header{position:absolute;left:34px;top:28px;z-index:1}header a{color:#a9b5a6;text-decoration:none;font-size:13px;letter-spacing:2px}h1{font:600 42px 'Barlow Condensed',sans-serif;margin:12px 0 8px}p{color:#b7bdb0;margin:0;font-size:14px}.tools{position:absolute;right:28px;top:30px;display:flex;gap:8px}select,button{background:#243029;border:1px solid #52604e;border-radius:4px;color:#eee9dc;padding:11px 14px;font:500 15px Barlow,Arial;cursor:pointer}nav{position:absolute;bottom:28px;left:50%;transform:translateX(-50%);display:flex;gap:7px;padding:12px;background:#17201ded;border:1px solid #52604e;border-radius:7px;max-width:94vw;flex-wrap:wrap;justify-content:center;width:max-content}button.active{background:#c6ae74;border-color:#c6ae74;color:#17201d}.unit-label{position:absolute;transform:translate(-50%,-50%);font:600 13px Barlow,sans-serif;letter-spacing:1px;color:#d4d9cd;pointer-events:none;text-shadow:0 2px 4px #000}.status{position:absolute;left:34px;bottom:132px;font-size:13px;color:#a9b5a6}#pose-name{color:#e1c789;margin-top:8px;font-weight:600}#error{color:#ffae91}@media(max-width:800px){header{left:18px;top:18px}h1{font-size:29px}.tools{top:150px;right:18px}nav{bottom:16px}button{padding:8px}}
</style>`,
);
document.querySelector("#drill")!.innerHTML =
  `<header><a href="/">← IRONFRONT</a><h1>BİRLİK TALİMİ</h1><p>Fareyle çevir · Tekerlekle yakınlaş · Hareket seç</p><p id="pose-name">Hazır duruş</p></header><div class="tools"><select id="faction" aria-label="Faction">${rules.factions.map((f, i) => `<option value="${i}">${f.name}</option>`).join("")}</select><button id="pause">Duraklat</button><button id="crowd">400 asker</button></div><div class="status"><span id="load">Karakterler hazırlanıyor…</span><span id="error"></span></div><nav id="motions"></nav>`;
const motions: [string, string][] = [
  ["idle", "Hazır"],
  ["walk", "Yürü"],
  ["run", "Koş"],
  ["back", "Geri yürü"],
  ["strafeLeft", "Sol adım"],
  ["strafeRight", "Sağ adım"],
  ["attack", "Saldır"],
  ["block", "Blok"],
  ["hit", "Darbe"],
  ["dodge", "Kaçın"],
  ["dodgeBack", "Geri kaçın"],
  ["dodgeLeft", "Sola kaçın"],
  ["dodgeRight", "Sağa kaçın"],
  ["jump", "Zıpla"],
  ["death", "Düş"],
];
const studyLink = document.createElement("a");
studyLink.href = duel ? "/drill.html" : "/drill.html?duel";
studyLink.textContent = duel ? "← Tüm birlikler" : "Turks ve Knights · İkili talim";
document.querySelector("header")!.append(studyLink);
if (duel) {
  document.querySelector("h1")!.textContent = "KILIÇ VE KALKAN";
  document.querySelector<HTMLElement>("#faction")!.hidden = true;
  document.querySelector<HTMLElement>("#crowd")!.hidden = true;
  motions.push(["doubleCut", "Çift kesiş"], ["swordChain", "Üçlü seri"], ["blockHit", "Kalkan darbesi"]);
}
const nav = document.querySelector("#motions")!;
const poseLabel = document.querySelector<HTMLElement>("#pose-name")!;
let motion = "idle",
  faction = 0,
  paused = false,
  crowd = false,
  time = 0,
  started = 0;
function buttons() {
  nav.innerHTML = motions
    .map(
      ([key, label]) =>
        `<button data-motion="${key}" class="${motion === key ? "active" : ""}">${label}</button>`,
    )
    .join("");
}
buttons();
nav.addEventListener("click", (e) => {
  const key = (e.target as HTMLElement).dataset.motion;
  if (!key) return;
  motion = key;
  started = time;
  if (paused && (key === "doubleCut" || key === "swordChain")) {
    paused = false;
    document.querySelector("#pause")!.textContent = "Duraklat";
  }
  buttons();
  poseLabel.textContent = motions.find(
    (m) => m[0] === key,
  )![1];
});
document
  .querySelector("#faction")!
  .addEventListener(
    "change",
    (e) => (faction = Number((e.target as HTMLSelectElement).value)),
  );
document.querySelector("#pause")!.addEventListener("click", (e) => {
  paused = !paused;
  (e.target as HTMLElement).textContent = paused ? "Devam et" : "Duraklat";
});
const renderer = new T.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
document.body.append(renderer.domElement);
const scene = new T.Scene();
scene.background = new T.Color("#28362f");
scene.fog = new T.Fog("#28362f", 30, 95);
const camera = new T.PerspectiveCamera(40, 1, 0.1, 160);
camera.position.set(6, 5.4, 14.5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
// An elevated, centered view shows the return arc without favoring either fighter.
if (duel) camera.position.set(0, 3.30, 5.80);
controls.minDistance = 3;
controls.maxDistance = 65;
controls.maxPolarAngle = Math.PI * 0.48;
controls.enableDamping = true;
scene.add(new T.HemisphereLight("#f4eede", "#526457", 2.1));
const sun = new T.DirectionalLight("#ffebc5", 3);
sun.position.set(-5, 14, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -25;
sun.shadow.camera.right = 25;
sun.shadow.camera.top = 25;
sun.shadow.camera.bottom = -25;
sun.shadow.normalBias = 0.035;
scene.add(sun);
const floor = new T.Mesh(
  new T.PlaneGeometry(120, 120),
  new T.MeshStandardMaterial({ color: "#64715f", roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new T.GridHelper(80, 40, "#76816b", "#65705f");
grid.position.y = 0.003;
scene.add(grid);
const chars = new Characters();
scene.add(chars.group);
let loaded = false;
chars
  .load()
  .then(() => {
    loaded = true;
    document.querySelector("#load")!.textContent = "Hazır";
    renderer.domElement.dataset.characters = "rigged";
  })
  .catch((e) => {
    document.querySelector("#error")!.textContent = String(e);
    console.error(e);
  });
const nodes = rules.factions[0].units.map((unit) => {
  const el = document.createElement("div");
  el.className = "unit-label";
  el.textContent = unit.name;
  document.body.append(el);
  return el;
});
if (duel) {
  nodes[0].textContent = "TURKS · MUHAFIZ";
  nodes[1].textContent = "KNIGHTS · AĞIR PİYADE";
  nodes.slice(2).forEach((node) => (node.hidden = true));
}
document.querySelector("#crowd")!.addEventListener("click", (e) => {
  crowd = !crowd;
  (e.target as HTMLElement).textContent = crowd ? "Yakın incele" : "400 asker";
  camera.position.set(
    ...((crowd ? [18, 25, 38] : [6, 5.4, 14.5]) as [number, number, number]),
  );
  controls.target.set(0, 1, 0);
  nodes.forEach((n) => (n.hidden = crowd));
});
const colors = rules.factions.map((f) => new T.Color(f.color));
let last = performance.now(),
  frames = 0,
  sum = 0;
function animate(now: number) {
  const elapsed = (now - last) / 1000;
  const dt = Math.min(0.1, elapsed);
  last = now;
  if (!paused) time += dt;
  chars.begin(time, camera.position);
  const combo = duel && (motion === "doubleCut" || motion === "swordChain");
  const beats = motion === "doubleCut" ? 2 : 3;
  const cutsEnd = swordSteps[0].duration + swordSteps[1].duration;
  const chainLength = cutsEnd + (beats === 3 ? swordSteps[2].duration : 0);
  const round = chainLength + .66;
  const seriesTime = time - started;
  const attacker = Math.floor(seriesTime / round) % 2;
  const age = seriesTime % round;
  const step = age < swordSteps[0].duration ? 0 : age < cutsEnd ? 1 : beats-1;
  const beat = swordSteps[step];
  const beatAge = age - (step === 0 ? 0 : step === 1 ? swordSteps[0].duration : cutsEnd);
  const progress = beatAge / beat.duration;
  if (combo) {
    const title = age < chainLength
      ? `${attacker === 0 ? "Muhafız" : "Ağır piyade"} · ${step+1}/${beats} · ${swordLabels[step]}`
      : "Garda dönüş";
    if (poseLabel.textContent !== title) poseLabel.textContent = title;
  }
  if (loaded)
    for (let i = 0; i < (duel ? 2 : crowd ? 400 : 4); i++) {
      const owner = duel ? (i === 0 ? 3 : 0) : crowd ? Math.floor(i / 100) : faction,
        unit = rules.factions[owner].units[i % 4],
        kind = duel ? "sword" : unit.kind,
        gear = outfit(owner, kind, duel && i === 0 ? 0 : -1),
        action = motion === "attack" ? gear.attack : motion;
      const duration = chars.duration(gear.model, action),
        once =
          ["attack", "hit", "death", "blockHit"].includes(motion) ||
          motion.startsWith("dodge"),
        cycle = duration + 0.7;
      const phase = once
        ? (time - started) % cycle
        : time + (crowd ? i * 0.173 : 0);
      let shownAction = action, shownPhase = phase, loop = !once;
      let approach = 0;
      const sparring = duel && motion === "attack";
      if (sparring) {
        const elapsed = time - started;
        const attacker = Math.floor(elapsed / 1.35) % 2;
        const age = elapsed % 1.35;
        const duration = attacker === 0 ? .62 : rules.combat.meleeDuration;
        const impact = duration * (attacker === 0 ? .42 : rules.combat.impactFraction);
        shownAction = "block";
        shownPhase = 0;
        if (attacker === i && age < duration) {
          shownAction = "slash";
          shownPhase = age / duration * chars.duration(gear.model, shownAction);
        } else if (attacker !== i && age >= impact && age < impact + .32) {
          shownAction = "blockHit";
          shownPhase = (age-impact) / .32 * chars.duration(gear.model, shownAction);
        }
        loop = false;
      }
      if (combo) {
        const sinceContact = beatAge - beat.duration * beat.impact;
        shownAction = "block";
        shownPhase = 0;
        loop = false;
        if (i === attacker && age < chainLength) {
          shownAction = swordMotion(step, true);
          shownPhase = swordPhase(step, progress, gear.model, true) * chars.duration(gear.model, shownAction);
          approach = (step === 2 ? .08 : .10) * Math.sin(Math.PI * progress) ** 2;
        } else if (i !== attacker && step === 2 && sinceContact < 0) {
          shownAction = "idle";
          approach = -.13 * Math.sin(Math.PI * progress) ** 2;
        } else if (i !== attacker && sinceContact >= 0 && sinceContact < .24) {
          shownAction = step === 2 ? "hit" : "blockHit";
          shownPhase = sinceContact / .24 * chars.duration(gear.model, shownAction);
          approach = -(step === 2 ? .13 : 0) - .09 * Math.sin(Math.PI * sinceContact / .24);
        }
      }
      const spacing = combo ? 1.74 - 2 * approach : 2.15;
      const x = duel ? (i - .5) * spacing : crowd ? ((i % 20) - 9.5) * 1.45 : (i - 1.5) * 2.35,
        z = crowd ? (Math.floor(i / 20) - 9.5) * 1.45 : 0;
      chars.draw({
        id: String(i),
        ...gear,
        x,
        y: 0,
        z,
        facing: duel ? (i === 0 ? 1 : -1) * (sparring || combo ? Math.PI/2 : .80) : 0,
        color: colors[owner],
        motion: shownAction,
        phase: shownPhase,
        blendSeconds: combo ? .08 : undefined,
        loop,
      });
      if (!crowd) {
        if (!duel && nodes[i].textContent !== unit.name) nodes[i].textContent = unit.name;
        const point = new T.Vector3(x, 2.7, z).project(camera);
        nodes[i].style.left = (point.x * 0.5 + 0.5) * innerWidth + "px";
        nodes[i].style.top = (-point.y * 0.5 + 0.5) * innerHeight + "px";
      }
    }
  chars.end();
  controls.update();
  renderer.render(scene, camera);
  frames++;
  sum += elapsed;
  if (frames >= 30) {
    document.querySelector("#load")!.textContent = loaded
      ? `${chars.count} asker · ${Math.round(frames / sum)} FPS · ${renderer.info.render.calls} çizim`
      : "Karakterler hazırlanıyor…";
    renderer.domElement.dataset.triangles = String(
      renderer.info.render.triangles,
    );
    renderer.domElement.dataset.fps = String(Math.round(frames / sum));
    frames = 0;
    sum = 0;
  }
  requestAnimationFrame(animate);
}
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
requestAnimationFrame(animate);
