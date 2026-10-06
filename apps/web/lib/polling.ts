/**
 * Adaptive polling interval for status queries.
 *
 * Why not a flat interval? Two competing goals:
 *  - Responsiveness: when a job finishes quickly, we want to notice almost
 *    immediately, so the UI shouldn't sit on a long fixed delay.
 *  - Efficiency: a job that takes a minute shouldn't be polled every 1.5s the
 *    whole time — that's ~40 pointless requests.
 *
 * So we poll fast at first and gradually back off. React Query's refetchInterval
 * callback receives the query, whose `state.dataUpdateCount` increments on each
 * successful fetch — a convenient "how many times have we polled" counter.
 *
 *   polls 0–5  -> 1500ms  (first ~9s feel instant)
 *   polls 6–15 -> 3000ms  (steady middle)
 *   polls 16+  -> 5000ms  (long-running jobs, light load)
 */
export function adaptiveStatusInterval(updateCount: number): number {
  if (updateCount <= 5) return 1500;
  if (updateCount <= 15) return 3000;
  return 5000;
}
