import type { GenerateItem, MultimodeSequenceStatus } from "../types";

export type MultimodeSequenceState = {
  sequenceId: string;
  requestId: string;
  requested: number;
  returned: number;
  images: GenerateItem[];
  partials: Array<{ image: string; index?: number | null }>;
  status: MultimodeSequenceStatus;
  elapsed?: string;
  error?: string | null;
};
