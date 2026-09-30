import { SendItemApi } from "./send-item.api";

describe("SendItemApi", () => {
  it("parses metadata", () => {
    const api = new SendItemApi({
      EncryptionVersion: 1,
      Data: "sealed",
      Metadata: { ItemId: "5d4fbf2b-7a36-4b3c-9f2e-1a6d8c0e9b71" },
    });

    expect(api.metadata?.itemId).toBe("5d4fbf2b-7a36-4b3c-9f2e-1a6d8c0e9b71");
  });

  it("leaves metadata undefined when absent", () => {
    const api = new SendItemApi({ EncryptionVersion: 1, Data: "sealed" });

    expect(api.metadata).toBeUndefined();
  });
});
