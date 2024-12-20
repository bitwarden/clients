/**
 * This barrel file should only contain Angular exports
 */

export { LockV2Component } from "./lock/components/lock.component";
export {
  LockComponentService,
  BiometricsDisableReason,
  UnlockOptions,
} from "./lock/services/lock-component.service";

export { VaultTimeoutInputComponent } from "./vault-timeout-input/vault-timeout-input.component";
