import { AccountProfile } from "./account";

describe("AccountProfile", () => {
  describe("fromJSON", () => {
    it("should deserialize to an instance of itself", () => {
      expect(AccountProfile.fromJSON({})).toBeInstanceOf(AccountProfile);
    });
  });
});
