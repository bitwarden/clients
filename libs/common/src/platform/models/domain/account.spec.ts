import { Account, AccountProfile } from "./account";

describe("Account", () => {
  describe("fromJSON", () => {
    it("should deserialize to an instance of itself", () => {
      expect(Account.fromJSON({})).toBeInstanceOf(Account);
    });

    it("should call all the sub-fromJSONs", () => {
      const profileSpy = jest.spyOn(AccountProfile, "fromJSON");

      Account.fromJSON({});

      expect(profileSpy).toHaveBeenCalled();
    });
  });
});
