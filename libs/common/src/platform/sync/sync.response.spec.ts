import { SyncResponse } from "./sync.response";

describe("SyncResponse", () => {
  it("should create response when user decryption is not provided", () => {
    const response = new SyncResponse({
      UserDecryption: undefined,
    });
    expect(response.userDecryption).toBeUndefined();
  });

  it("should create response when user decryption is provided", () => {
    const response = new SyncResponse({
      UserDecryption: {},
    });
    expect(response.userDecryption).toBeDefined();
    expect(response.userDecryption!.masterPasswordUnlock).toBeUndefined();
  });
});
