import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { generateQRCodePath } from "./visual-vault-items";

const mockCipher = {
  id: "cipher1",
  name: "Cipher",
  type: CipherType.Login,
  login: { uris: [] },
  card: {},
} as CipherView;

describe("generateWiFiQRCode", () => {
  it("returnsDataUri", () => {
    const qrCode = generateQRCodePath("wifi", { ssid: "foo", password: "bar" }, mockCipher);
    expect(qrCode).toBeTruthy();
  });
});
