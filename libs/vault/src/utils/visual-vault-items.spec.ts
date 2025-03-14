import { generateWiFiQRCode } from "./visual-vault-items";

describe("generateWiFiQRCode", () => {
  it("returnsDataUri", () => {
    const qrCode = generateWiFiQRCode("foo", "bar");
    expect(qrCode).toBe("?");
  });
});
