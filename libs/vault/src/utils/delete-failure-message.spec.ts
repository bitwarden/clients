import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { CollectionId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { deleteFailureMessageKey } from "./delete-failure-message";

function cipher(overrides: Record<string, unknown> = {}): CipherView {
  return { id: "cipher-id", collectionIds: [], ...overrides } as unknown as CipherView;
}

function collection(id: string, hasEnabledAccessRule: boolean): CollectionView {
  return { id: id as CollectionId, hasEnabledAccessRule } as unknown as CollectionView;
}

describe("deleteFailureMessageKey", () => {
  it("explains the refusal for a partial (server-withheld) cipher", () => {
    expect(deleteFailureMessageKey(cipher({ partial: true }))).toBe("pamDeleteRequiresAccess");
  });

  // The reachable case: the lease lapsed after the last sync, so the cipher is still full.
  it("explains the refusal when every reachable collection gates", () => {
    const c = cipher({ collectionIds: ["c1", "c2"] });
    const collections = [collection("c1", true), collection("c2", true)];

    expect(deleteFailureMessageKey(c, collections)).toBe("pamDeleteRequiresAccess");
  });

  // The union rule: one ungated path is an escape, so the cipher was never gated.
  it("falls back to the plain error when any reachable collection does not gate", () => {
    const c = cipher({ collectionIds: ["c1", "c2"] });
    const collections = [collection("c1", true), collection("c2", false)];

    expect(deleteFailureMessageKey(c, collections)).toBe("deleteItemError");
  });

  it("falls back to the plain error when a collection cannot be resolved", () => {
    const c = cipher({ collectionIds: ["c1", "unknown"] });

    expect(deleteFailureMessageKey(c, [collection("c1", true)])).toBe("deleteItemError");
  });

  it("treats a cipher in no collection as never gated", () => {
    expect(deleteFailureMessageKey(cipher(), [collection("c1", true)])).toBe("deleteItemError");
  });

  it("treats a cipher with no partial field and no collections given as not gated", () => {
    expect(deleteFailureMessageKey(cipher({ collectionIds: ["c1"] }))).toBe("deleteItemError");
  });
});
