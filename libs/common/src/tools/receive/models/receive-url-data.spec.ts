import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { ReceiveId } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";

import { buildReceiveUrl } from "./receive-url-data";
import { ReceiveView } from "./view/receive.view";

describe("buildReceiveUrl", () => {
  const mockId = newGuid() as ReceiveId;
  const mockSecret = "my-secret";
  const mockScek = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray);
  const baseUrl = "https://vault.bitwarden.com/#/receive";

  const mockView: ReceiveView = {
    id: mockId,
    secret: mockSecret,
    expirationDate: new Date(),
    name: "Test Receive",
    publicKey: new Uint8Array(32),
    sharedContentEncryptionKey: mockScek,
  };

  it("builds a URL with the correct structure", () => {
    const url = buildReceiveUrl(mockView, baseUrl);

    expect(url).toMatch(/^https:\/\/vault\.bitwarden\.com\/#\/receive\/.+\/.+\/.+$/);

    const parts = url.split("/");
    expect(parts[parts.length - 3]).toBe(mockId);

    const secretB64Part = parts[parts.length - 2];
    expect(secretB64Part).toBe(Utils.fromUtf8ToUrlB64(mockSecret));
    expect(secretB64Part).not.toContain("+");
    expect(secretB64Part).not.toContain("/");
    expect(secretB64Part).not.toContain("=");

    const scekB64Part = parts[parts.length - 1];
    expect(scekB64Part).toBe(Utils.fromArrayToUrlB64(mockScek.toEncoded()));
    expect(scekB64Part).not.toContain("+");
    expect(scekB64Part).not.toContain("/");
    expect(scekB64Part).not.toContain("=");
  });

  it("uses the provided base URL as the prefix", () => {
    const customBaseUrl = "https://custom.example.com/#/receive";
    const url = buildReceiveUrl(mockView, customBaseUrl);

    expect(url.startsWith(customBaseUrl + "/")).toBe(true);
  });
});
