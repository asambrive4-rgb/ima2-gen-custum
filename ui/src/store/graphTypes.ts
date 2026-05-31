import type { Node as FlowNode, Edge as FlowEdge } from "@xyflow/react";
import type { ClientNodeId } from "../lib/graph";

export type ImageNodeStatus =
  | "empty"
  | "pending"
  | "reconciling"
  | "ready"
  | "stale"
  | "asset-missing"
  | "error";

export type ImageNodeData = {
  clientId: ClientNodeId;
  serverNodeId: string | null;
  parentServerNodeId: string | null;
  prompt: string;
  imageUrl: string | null;
  status: ImageNodeStatus;
  pendingRequestId: string | null;
  recoveryRequestId?: string | null;
  pendingPhase?: string | null;
  pendingStartedAt?: number | null;
  partialImageUrl?: string | null;
  error?: string;
  elapsed?: number;
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh";
  webSearchCalls?: number;
  model?: string | null;
  size?: string | null;
  referenceImages?: string[];
};

export type GraphNode = FlowNode<ImageNodeData>;
export type GraphEdge = FlowEdge;

export type GraphSaveReason =
  | "debounced"
  | "manual"
  | "switch-session"
  | "recovery"
  | "beforeunload"
  | "queued"
  | "edge-disconnect"
  | "node-complete";

export type GraphSaveResult = "saved" | "skipped" | "conflict" | "failed";
