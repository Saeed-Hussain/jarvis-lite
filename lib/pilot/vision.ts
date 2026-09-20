/**
 * The vision seam — deliberately empty.
 *
 * The accessibility tree answers most grounding questions and answers them in
 * milliseconds. It does not answer all of them: a canvas-rendered app, a
 * remote desktop window, a game, or an Electron app that never set an
 * accessible name all present a tree with nothing addressable in it. That is
 * the case a local vision model has to arbitrate, and it is the open problem
 * Pilot's second phase exists to attack — a small model that can say *where*
 * the Save button is, on this machine's GPU, in under a second.
 *
 * Nothing here pretends to do that yet. `groundByVision` reports that it is
 * unavailable, the runner says so plainly, and the step fails honestly rather
 * than clicking a guess. When a real implementation exists it registers here
 * and the runner needs no changes.
 *
 * What a real implementation owes the caller:
 *   - a point, in physical screen pixels, matching the coordinate space UI
 *     Automation and SendInput already use (see SetProcessDPIAware in host.ps1)
 *   - a calibrated confidence — one that is actually low when the model is
 *     guessing, since the runner's refusal threshold is only as good as this
 *   - a latency budget it respects, because a grounder that takes eight
 *     seconds per step is a toy
 */

import type { GroundResult, TargetDescriptor } from './types';

export interface VisionRequest {
  target: TargetDescriptor;
  /** Full-resolution screen capture as a PNG data URL. */
  image: string;
  /** Physical pixel size of that capture. */
  width: number;
  height: number;
  /** Give up past this and return `ok: false` rather than run long. */
  budgetMs: number;
}

export type VisionGrounder = (request: VisionRequest) => Promise<GroundResult>;

let grounder: VisionGrounder | null = null;

/**
 * Install a local vision grounder. Phase 2 calls this once at startup with a
 * WebGPU-backed model; until then nothing does, and that is the honest state
 * of the project rather than a bug.
 */
export function registerVisionGrounder(fn: VisionGrounder | null): void {
  grounder = fn;
}

export function visionAvailable(): boolean {
  return grounder !== null;
}

export async function groundByVision(request: VisionRequest): Promise<GroundResult> {
  if (!grounder) {
    return {
      ok: false,
      x: 0,
      y: 0,
      confidence: 0,
      source: 'vision',
      candidates: [],
      ms: 0,
      reason:
        'the accessibility tree could not identify it and no local vision grounder is installed — this is the part Pilot has not built yet',
    };
  }
  const started = Date.now();
  const result = await grounder(request);
  return { ...result, source: 'vision', ms: result.ms || Date.now() - started };
}
