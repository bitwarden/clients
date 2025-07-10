import { Account, AccountKeys, AccountProfile } from "./account";

describe("Account", () => {
  describe("fromJSON", () => {
    it("should deserialize to an instance of itself", () => {
      expect(Account.fromJSON({})).toBeInstanceOf(Account);
    });

    it("should call all the sub-fromJSONs", () => {
      const keysSpy = jest.spyOn(AccountKeys, "fromJSON");
      const profileSpy = jest.spyOn(AccountProfile, "fromJSON");

      Account.fromJSON({});

      expect(keysSpy).toHaveBeenCalled();
      expect(profileSpy).toHaveBeenCalled();
    });
  });
});
