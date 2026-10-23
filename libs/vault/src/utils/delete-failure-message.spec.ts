import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { deleteFailureMessageKey } from "./delete-failure-message";

function cipher(overrides: Record<string, unknown> = {}): CipherView {
  return { id: "cipher-id", collectionIds: [], ...overrides } as unknown as CipherView;
}

describe("deleteFailureMessageKey", () => {
  it("explains the refusal for a restricted cipher", () => {
    expect(deleteFailureMessageKey(cipher({ partial: true }))).toBe("restrictedItemChangeRefused");
  });

  it("falls back to the plain error for a full cipher", () => {
    expect(deleteFailureMessageKey(cipher({ partial: false, collectionIds: ["c1"] }))).toBe(
      "deleteItemError",
    );
  });

  it("treats a cipher with no partial field as not restricted", () => {
    expect(deleteFailureMessageKey(cipher())).toBe("deleteItemError");
  });
});
