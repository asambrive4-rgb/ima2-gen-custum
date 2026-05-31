import type { ImaErrorCode } from "../lib/errorCodes";
import type { GenerateItem, EmbeddedGenerationMetadata } from "../types";
import type { CustomSizeAdjustmentReason } from "../lib/size";
import type { ClientNodeId } from "../lib/graph";

export type ToastEntry = { message: string; error: boolean; id: number; createdAt: number };
export type ToastState = ToastEntry | null;

export type ErrorCardEntry = { code: ImaErrorCode; fallbackMessage?: string; id: number; createdAt: number };

export type ComposeSheetTab = "prompt" | "controls" | "library";

export type TrashPendingState = {
  filename: string;
  trashId: string;
  item: GenerateItem;
  expiresAt: number;
} | null;

export type CustomSizeConfirmState = {
  requestedW: number;
  requestedH: number;
  adjustedW: number;
  adjustedH: number;
  reasons: CustomSizeAdjustmentReason[];
  continuation:
    | { kind: "classic" }
    | { kind: "multimode" }
    | { kind: "node"; clientId: ClientNodeId }
    | { kind: "node-in-place"; clientId: ClientNodeId }
    | { kind: "node-variation"; clientId: ClientNodeId };
} | null;

export type MetadataRestoreState = {
  filename: string;
  image: string;
  metadata: EmbeddedGenerationMetadata;
  source: "xmp" | "png-comment" | string;
  targetNodeId?: ClientNodeId | null;
} | null;
