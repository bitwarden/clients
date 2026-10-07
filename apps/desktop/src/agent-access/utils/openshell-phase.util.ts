export type OpenShellPhaseKind = "ready" | "stopped" | "error" | "other";

/** Buckets a gateway-reported phase. `other` covers every phase still on its way somewhere. */
export function openShellPhaseKind(phase: string): OpenShellPhaseKind {
  switch (phase?.trim().toLowerCase()) {
    case "ready":
      return "ready";
    case "stopped":
      return "stopped";
    case "error":
    case "failed":
      return "error";
    default:
      return "other";
  }
}
