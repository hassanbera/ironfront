import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { attackProgress } from "../frontend/src/attack-motion.ts";
const { combat: c } = JSON.parse(
  readFileSync(new URL("../server/rules.json", import.meta.url), "utf8"),
);
for (const [duration, cycle, fraction] of [
  [c.meleeDuration, c.meleeCycle, c.impactFraction],
  [c.rangedDuration, c.rangedCycle, c.releaseFraction],
]) {
  assert.ok(duration <= cycle, "cooldown must permit full animation");
  const state = {
    attackAt: 10,
    attackDuration: duration,
    attackSlots: (1 << 0) | (1 << 24),
  };
  assert.equal(attackProgress(state, 0, 9.9), -1);
  assert.equal(attackProgress(state, 0, 10), 0);
  assert.equal(attackProgress(state, 1, 10.2), -1);
  assert.ok(
    Math.abs(attackProgress(state, 24, 10 + duration * fraction) - fraction) <
      1e-9,
  );
  assert.ok(
    attackProgress(state, 0, 10 + duration * 0.99) > 0.98,
    "last part of clip must be reachable",
  );
  assert.equal(attackProgress(state, 0, 10 + cycle + 0.0001), -1);
}
console.log(
  "PASS: full clip, shared impact/release phases, slot mask and recovery",
);
