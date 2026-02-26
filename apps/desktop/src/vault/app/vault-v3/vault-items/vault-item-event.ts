import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { VaultItemEvent as BaseVaultItemEvent } from "@bitwarden/vault";

// Extend base events with desktop-specific events
export type VaultItemEvent<C extends CipherViewLike> =
  | BaseVaultItemEvent<C>
  | { type: "viewCipher"; item: C };
