import { PolicyRequest } from "./policy.request";

export interface SavePolicyRequest<TMetadata = Record<string, unknown>> {
  policy: PolicyRequest;
  metadata: TMetadata | null;
}
