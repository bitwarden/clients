import { PolicyRequest } from "./policy.request";

export interface VNextSavePolicyRequest<TMetadata = Record<string, unknown>> {
  policy: PolicyRequest;
  metadata: TMetadata | null;
}
