/**
 * Shared between the listener and its worker.
 *
 * It lives on its own so the main thread can read the sample rate without
 * importing the worker module — importing it would drag the whole model
 * runtime into the main bundle, which is the one place it must never be.
 */

/** Whisper is trained on 16kHz mono; anything else has to be resampled. */
export const SAMPLE_RATE = 16000;
