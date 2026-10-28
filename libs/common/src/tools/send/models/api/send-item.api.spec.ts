import { SendItemApi } from "./send-item.api";

describe("SendItemApi", () => {
  it("parses the sealed data and its metadata", () => {
    const api = new SendItemApi({
      EncryptionVersion: 1,
      Data: "sealed",
      Metadata: { ItemId: "5d4fbf2b-7a36-4b3c-9f2e-1a6d8c0e9b71" },
    });

    expect(api.data).toBe("sealed");
    expect(api.metadata.itemId).toBe("5d4fbf2b-7a36-4b3c-9f2e-1a6d8c0e9b71");
  });

  it("parses camelCase metadata", () => {
    const api = new SendItemApi({
      encryptionVersion: 1,
      data: "sealed",
      metadata: { itemId: "5d4fbf2b-7a36-4b3c-9f2e-1a6d8c0e9b71" },
    });

    expect(api.metadata.itemId).toBe("5d4fbf2b-7a36-4b3c-9f2e-1a6d8c0e9b71");
  });
});
