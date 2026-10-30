type AttackState = {
  attackAt: number;
  attackDuration?: number;
  attackSlots?: number;
};

/** -1 means this soldier is not participating. No per-frame object allocation. */
export function attackProgress(
  s: AttackState,
  slot: number,
  serverTime: number,
): number {
  const duration = s.attackDuration || 0.82;
  const age =
    serverTime - s.attackAt - (s.attackDuration ? 0 : (slot % 5) * 0.045);
  if (
    s.attackAt <= 0 ||
    age < 0 ||
    age >= duration ||
    (s.attackSlots !== undefined && !(s.attackSlots & (1 << slot)))
  )
    return -1;
  return age / duration;
}
