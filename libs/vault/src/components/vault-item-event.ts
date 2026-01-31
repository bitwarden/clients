import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { VaultItem } from "@bitwarden/vault";

export type VaultItemEvent<C extends CipherViewLike> =
  | { type: "viewAttachments"; item: C }
  | { type: "viewEvents"; item: C }
  | { type: "clone"; item: C }
  | { type: "restore"; items: C[] }
  | { type: "delete"; items: VaultItem<C>[] }
  | { type: "moveToFolder"; items: C[] }
  | { type: "assignToCollections"; items: C[] }
  | { type: "archive"; items: C[] }
  | { type: "unarchive"; items: C[] }
  | { type: "toggleFavorite"; item: C }
  | { type: "editCipher"; item: C };
