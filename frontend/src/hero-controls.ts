/** Camera looks along (sin(yaw), cos(yaw)); its screen-right is (-cos, sin). */
export function heroMovement(keys: ReadonlySet<string>, yaw: number) {
  const has = (a: string, b: string) => keys.has(a) || keys.has(b);
  const forward =
    Number(has("KeyW", "ArrowUp")) - Number(has("KeyS", "ArrowDown"));
  const right =
    Number(has("KeyD", "ArrowRight")) - Number(has("KeyA", "ArrowLeft"));
  const length = Math.max(1, Math.hypot(right, forward));
  return {
    x: (-right * Math.cos(yaw) + forward * Math.sin(yaw)) / length,
    z: (right * Math.sin(yaw) + forward * Math.cos(yaw)) / length,
    facing: yaw,
    block: keys.has("Block"),
  };
}

export function movementClip(
  x: number,
  z: number,
  facing: number,
  dodge = false,
) {
  const forward = x * Math.sin(facing) + z * Math.cos(facing);
  const right = -x * Math.cos(facing) + z * Math.sin(facing);
  if (Math.abs(right) > Math.abs(forward) * 1.15)
    return dodge
      ? right > 0
        ? "dodgeRight"
        : "dodgeLeft"
      : right > 0
        ? "strafeRight"
        : "strafeLeft";
  return dodge
    ? forward < 0
      ? "dodgeBack"
      : "dodge"
    : forward < 0
      ? "back"
      : "run";
}
