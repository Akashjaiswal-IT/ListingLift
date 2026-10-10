/**
 * Maps a listing's (status, generationStage) to the state of the four progress
 * rows shown while generating. The worker records generationStage at the start
 * of each phase (see apps/worker image-generation.processor.ts).
 */

export type StepState = "done" | "active" | "failed" | "pending";

const STAGE_ORDER = ["preparing", "enhancing_prompt", "rendering_images", "rendering_cards"] as const;
export const GENERATION_STEP_COUNT = STAGE_ORDER.length;

export function getStepStates(status: string | undefined, stage: string | null | undefined): StepState[] {
  if (status === "completed") {
    return STAGE_ORDER.map(() => "done" as const);
  }

  const stageIndex = stage === "done" ? STAGE_ORDER.length : STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);

  if (status === "failed") {
    // The row of the last known stage failed; unknown stage -> first row. Never "active".
    const failedAt = stageIndex < 0 ? 0 : Math.min(stageIndex, STAGE_ORDER.length - 1);
    return STAGE_ORDER.map((_, i) => (i < failedAt ? "done" : i === failedAt ? "failed" : "pending"));
  }

  // queued / processing / not loaded yet
  const activeAt = stageIndex < 0 ? 0 : stageIndex;
  return STAGE_ORDER.map((_, i) => (i < activeAt ? "done" : i === activeAt ? "active" : "pending"));
}
