import { V2UpgradeTokenResponse } from "./v2-upgrade-token.response";

describe("V2UpgradeTokenResponse", () => {
  const wrappedUserKey1 = "mockWrappedUserKey1";
  const wrappedUserKey2 = "mockWrappedUserKey2";

  it("throws when WrappedUserKey1 is missing", () => {
    expect(
      () =>
        new V2UpgradeTokenResponse({
          WrappedUserKey1: undefined,
          WrappedUserKey2: wrappedUserKey2,
        }),
    ).toThrow("V2UpgradeTokenResponse does not contain a valid wrappedUserKey1");
  });

  it("throws when WrappedUserKey2 is missing", () => {
    expect(
      () =>
        new V2UpgradeTokenResponse({
          WrappedUserKey1: wrappedUserKey1,
          WrappedUserKey2: undefined,
        }),
    ).toThrow("V2UpgradeTokenResponse does not contain a valid wrappedUserKey2");
  });

  it("throws when WrappedUserKey1 is not a string", () => {
    expect(
      () =>
        new V2UpgradeTokenResponse({
          WrappedUserKey1: 42,
          WrappedUserKey2: wrappedUserKey2,
        }),
    ).toThrow("V2UpgradeTokenResponse does not contain a valid wrappedUserKey1");
  });

  it("creates response from valid payload", () => {
    const response = new V2UpgradeTokenResponse({
      WrappedUserKey1: wrappedUserKey1,
      WrappedUserKey2: wrappedUserKey2,
    });

    expect(response.wrappedUserKey1).toBe(wrappedUserKey1);
    expect(response.wrappedUserKey2).toBe(wrappedUserKey2);
  });

  describe("toV2UpgradeToken", () => {
    it("returns SDK-shaped token", () => {
      const response = new V2UpgradeTokenResponse({
        WrappedUserKey1: wrappedUserKey1,
        WrappedUserKey2: wrappedUserKey2,
      });

      const token = response.toV2UpgradeToken();
      expect(token.wrapped_user_key_1).toBe(wrappedUserKey1);
      expect(token.wrapped_user_key_2).toBe(wrappedUserKey2);
    });
  });
});
