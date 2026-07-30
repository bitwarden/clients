// `export type` is REQUIRED (not `export`) for the shapes below — these are type-only
// re-exports of the wasm SDK's interfaces/type-aliases. Because they carry no runtime
// value, the lines are erased by the compiler, so jest never resolves the wasm package
// while running this directory's unit tests. `isLeasingError` is the one exception: it's
// a real function exported by the SDK, so it needs a plain `export` to keep working at
// runtime (callers actually invoke it as a type guard).
export type {
  AccessDeciderKind,
  AccessDecisionVerdict,
  AccessLeaseExtensionRequest,
  AccessLeaseId,
  AccessLeaseRevokeRequest,
  AccessLeaseStatus,
  AccessLeaseView,
  AccessRequestDecisionView,
  AccessRequestId,
  AccessRequestStatus,
  AccessRequestView,
  LeasingError,
} from "@bitwarden/sdk-internal";
export { isLeasingError } from "@bitwarden/sdk-internal";
