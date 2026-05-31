import type { ClientNodeId } from "../lib/graph";
import type { SessionFull } from "../lib/api";
import { deriveParentServerNodeIds } from "../lib/nodeGraph";
import { loadNodeRefs } from "../lib/nodeRefStorage";
import type { GraphNode, GraphEdge, ImageNodeStatus, ImageNodeData } from "./graphTypes";

export const DEFAULT_CHILD_SOURCE_HANDLE = "source-right";
export const DEFAULT_CHILD_TARGET_HANDLE = "target-left";

export function newGraphEdgeId(
  sourceClientId: ClientNodeId,
  targetClientId: ClientNodeId,
  sourceHandle?: string | null,
  targetHandle?: string | null,
): string {
  const sourceAnchor = sourceHandle ?? "auto";
  const targetAnchor = targetHandle ?? "auto";
  return `${sourceClientId}:${sourceAnchor}->${targetClientId}:${targetAnchor}`;
}

export function normalizeNodeHandleId(
  handleId: string | null | undefined,
  type: "source" | "target",
): string | null {
  if (!handleId) return null;
  return handleId.startsWith(`${type}-`) ? handleId : null;
}

export function getOppositeTargetHandle(sourceHandle?: string | null): string | null {
  switch (sourceHandle) {
    case "source-top":
      return "target-bottom";
    case "source-right":
      return "target-left";
    case "source-bottom":
      return "target-top";
    case "source-left":
      return "target-right";
    default:
      return null;
  }
}

export function mapSessionToGraph(session: SessionFull): {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  graphVersion: number;
} {
  const graphNodes: GraphNode[] = session.nodes.map((n) => {
    const d = (n.data ?? {}) as Partial<ImageNodeData>;
    const explicitImageUrl =
      typeof d.imageUrl === "string" && d.imageUrl.length > 0 ? d.imageUrl : null;
    const fallbackImageUrl =
      typeof d.serverNodeId === "string" && d.serverNodeId.length > 0
        ? `/generated/${d.serverNodeId}.png`
        : null;
    const imageUrl = explicitImageUrl ?? fallbackImageUrl;
    const data: ImageNodeData = {
      clientId: n.id as ClientNodeId,
      serverNodeId: (d.serverNodeId ?? null) as string | null,
      parentServerNodeId: (d.parentServerNodeId ?? null) as string | null,
      prompt: typeof d.prompt === "string" ? d.prompt : "",
      imageUrl,
      status: (d.status ?? (imageUrl ? "ready" : "empty")) as ImageNodeStatus,
      pendingRequestId: (d.pendingRequestId ?? null) as string | null,
      recoveryRequestId: (d.recoveryRequestId ?? null) as string | null,
      pendingPhase: (d.pendingPhase ?? null) as string | null,
      pendingStartedAt:
        typeof d.pendingStartedAt === "number" ? d.pendingStartedAt : null,
      partialImageUrl: null,
      error: d.error as string | undefined,
      elapsed: d.elapsed as number | undefined,
      reasoningEffort: d.reasoningEffort as ImageNodeData["reasoningEffort"] | undefined,
      webSearchCalls: d.webSearchCalls as number | undefined,
      model: (d.model ?? null) as string | null,
      size: (d.size ?? null) as string | null,
      referenceImages: loadNodeRefs(session.id, n.id),
    };
    return {
      id: n.id,
      type: "imageNode",
      position: { x: n.x, y: n.y },
      data,
    };
  });
  const graphEdges: GraphEdge[] = session.edges.map((e) => {
    const data = (e.data ?? {}) as Record<string, unknown>;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: typeof data.sourceHandle === "string" ? data.sourceHandle : null,
      targetHandle: typeof data.targetHandle === "string" ? data.targetHandle : null,
    };
  });
  return {
    graphNodes: deriveParentServerNodeIds(graphNodes, graphEdges),
    graphEdges,
    graphVersion: session.graphVersion,
  };
}
