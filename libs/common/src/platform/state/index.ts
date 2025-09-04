import { StateUpdateOptions as RequiredStateUpdateOptions } from "@bitwarden/state";

export * from "@bitwarden/state";
export { ActiveUserAccessor } from "@bitwarden/state-internal";

export type StateUpdateOptions<T, TCombine> = Partial<RequiredStateUpdateOptions<T, TCombine>>;
