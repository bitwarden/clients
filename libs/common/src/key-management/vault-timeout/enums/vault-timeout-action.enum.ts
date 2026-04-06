import { UnionOfValues } from "../../../vault/types/union-of-values";

export const VaultTimeoutAction = {
  Lock: "lock",
  LogOut: "logOut",
} as const;

export type VaultTimeoutAction = UnionOfValues<typeof VaultTimeoutAction>;
