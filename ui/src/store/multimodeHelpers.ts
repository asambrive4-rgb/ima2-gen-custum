import type { MultimodeSequenceState } from "./multimodeTypes";

export function removeImageFromMultimodeSequences(
  sequences: Record<string, MultimodeSequenceState>,
  filename: string,
): Record<string, MultimodeSequenceState> {
  let changed = false;
  const next: Record<string, MultimodeSequenceState> = {};
  for (const [id, sequence] of Object.entries(sequences)) {
    const images = sequence.images.filter((image) => image.filename !== filename);
    if (images.length === sequence.images.length) {
      next[id] = sequence;
      continue;
    }
    changed = true;
    if (images.length === 0) continue;
    next[id] = {
      ...sequence,
      images,
      returned: images.length,
      status:
        sequence.status === "complete" && images.length < sequence.requested
          ? "partial"
          : sequence.status,
    };
  }
  return changed ? next : sequences;
}

export function getActiveSidebarSequenceId(
  state: {
    multimodePreviewFlightId: string | null;
    multimodeSequences: Record<string, MultimodeSequenceState>;
  },
): string | null {
  const id = state.multimodePreviewFlightId;
  if (!id) return null;
  if (id.startsWith("history:")) return id.slice("history:".length);
  return state.multimodeSequences[id]?.sequenceId ?? null;
}
