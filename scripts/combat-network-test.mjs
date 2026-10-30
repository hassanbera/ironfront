import assert from "node:assert/strict";
const url = process.env.TEST_WS_URL || "ws://127.0.0.1:8794/ws";
const peers = [];
function send(p, c) {
  p.ws.send(JSON.stringify(c));
}
function until(p, fn, ms = 15000) {
  return new Promise((resolve, reject) => {
    if (fn(p.state)) return resolve(p.state);
    const timer = setTimeout(() => {
      p.waiters.delete(check);
      reject(Error("Combat state timeout"));
    }, ms);
    const check = (s) => {
      if (fn(s)) {
        clearTimeout(timer);
        p.waiters.delete(check);
        resolve(s);
      }
    };
    p.waiters.add(check);
  });
}
async function connect(hello) {
  const p = {
    ws: new WebSocket(url),
    state: null,
    welcome: null,
    waiters: new Set(),
    states: [],
  };
  peers.push(p);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("Welcome timeout")), 5000);
    p.ws.onopen = () => send(p, hello);
    p.ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === "welcome") {
        p.welcome = m;
        clearTimeout(timer);
        resolve();
      } else if (m.type === "state") {
        p.state = m;
        p.states.push(m);
        for (const fn of p.waiters) fn(m);
      } else if (m.type === "error") reject(Error(m.message));
    };
  });
  return p;
}
let heartbeat;
try {
  const a = await connect({
    type: "create",
    name: "Timing A",
    faction: 0,
    heroClass: 2,
    map: 0,
  });
  const b = await connect({
    type: "join",
    room: a.welcome.room,
    name: "Timing B",
    faction: 1,
    heroClass: 0,
  });
  send(a, { type: "start", bots: false });
  await until(a, (s) => s?.phase === "battle");
  for (const p of [a, b]) send(p, { type: "hero", active: true });
  let moving = true;
  heartbeat = setInterval(() => {
    const hs = a.state?.heroes;
    if (!hs?.length) return;
    const h0 = hs.find((h) => h.owner === 0),
      h1 = hs.find((h) => h.owner === 1);
    const dx = h1.x - h0.x,
      dz = h1.z - h0.z,
      d = Math.hypot(dx, dz);
    if (d < 20) moving = false;
    send(a, {
      type: "input",
      input: {
        x: moving ? dx / d : 0,
        z: moving ? dz / d : 0,
        facing: Math.atan2(dx, dz),
        block: false,
      },
    });
    send(b, {
      type: "input",
      input: {
        x: moving ? -dx / d : 0,
        z: moving ? -dz / d : 0,
        facing: Math.atan2(-dx, -dz),
        block: false,
      },
    });
  }, 50);
  await until(a, (s) => s && !moving && s.heroes.every((h) => h.active));
  const victim = () => a.state.heroes.find((h) => h.owner === 1);
  const shooter = (s) => s.heroes.find((h) => h.owner === 0);
  const hp = victim().hp;
  a.states = [];
  send(a, { type: "action", action: "attack" });
  await until(a, (s) => shooter(s).volley?.length);
  const first = shooter(a.state).volley[0];
  assert.equal(victim().hp, hp, "release applied immediate damage");
  await until(
    a,
    (s) => s.time >= first.land && s.heroes.find((h) => h.owner === 1).hp < hp,
  );
  for (const s of a.states.filter((s) => s.time < first.land - 1e-6))
    assert.equal(
      s.heroes.find((h) => h.owner === 1).hp,
      hp,
      "pre-arrival damage",
    );
  assert.ok(
    shooter(a.state).hitTargets.some((h) => h.kind === "hero" && h.id === 1),
    "wrong confirmed target",
  );
  const shotAt = first.at;
  await until(a, (s) => s.time > shotAt + 1);
  const hp2 = victim().hp;
  send(a, { type: "action", action: "attack" });
  await until(a, (s) => shooter(s).volley?.[0]?.at > shotAt);
  const second = shooter(a.state).volley[0];
  await until(a, (s) => s.time >= second.land - 0.2);
  send(b, { type: "action", action: "dodge" });
  await until(a, (s) => s.time > second.land + 0.25);
  assert.equal(victim().hp, hp2, "dodge did not prevent projectile damage");
  console.log(
    JSON.stringify(
      {
        result: "PASS",
        checks: [
          "two real hero clients",
          "no damage during windup or flight",
          "arrival names the correct target",
          "dodge at arrival prevents damage",
        ],
        flightSeconds: first.land - first.at,
      },
      null,
      2,
    ),
  );
} finally {
  clearInterval(heartbeat);
  for (const p of peers) p.ws.close();
}
