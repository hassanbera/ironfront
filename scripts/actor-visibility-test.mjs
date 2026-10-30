import assert from "node:assert/strict";
import {
  PerspectiveCamera,
  Vector3,
} from "../frontend/node_modules/three/build/three.module.js";
import { ActorVisibility } from "../frontend/src/actor-visibility.ts";
const camera = new PerspectiveCamera(44, 16 / 9, 0.1, 650),
  visible = new ActorVisibility();
camera.position.set(0, 2, 0);
camera.lookAt(0, 2, 10);
camera.updateMatrixWorld();
visible.update(camera);
assert.ok(visible.visible(0, 2, 20), "visible fighter");
assert.ok(!visible.visible(0, 2, -20), "behind camera");
assert.ok(!visible.visible(100, 2, 20), "outside horizontal view");
assert.ok(visible.visible(2, 2, -1), "near-plane mount/weapon must not pop");
const edge = new Vector3(1, 0, 0.99).unproject(camera);
assert.ok(visible.visible(edge.x, edge.y, edge.z), "on screen edge");
camera.lookAt(0, 2, -10);
camera.updateMatrixWorld();
visible.update(camera);
assert.ok(visible.visible(0, 2, -20), "turning camera restores actor");
assert.ok(!visible.visible(0, 2, 20), "old forward view culled");
console.log("PASS: front, behind, edge, near-plane bounds and camera reversal");
