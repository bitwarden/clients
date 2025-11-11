import { VaultTimeoutAction } from "../enums/vault-timeout-action.enum";

export interface MaximumVaultTimeoutPolicyData {
  minutes: number;
  action?: VaultTimeoutAction;
}
