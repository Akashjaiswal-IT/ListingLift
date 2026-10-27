/**
 * A listing reads "uploaded" until startGeneration has claimed it on the server, so on the
 * progress step "uploaded" only means "this generation was never started" once no start
 * request is still in flight (e.g. a refreshed ?listing= link for a draft).
 */
export function isNeverStarted(status: string | undefined, startInFlight: boolean): boolean {
  return status === "uploaded" && !startInFlight;
}
