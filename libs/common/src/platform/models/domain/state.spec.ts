import { Account } from "./account";
import { State } from "./state";

describe("state", () => {
  describe("fromJSON", () => {
    it("should deserialize to an instance of itself", () => {
      expect(State.fromJSON({}, () => new Account({}))).toBeInstanceOf(State);
    });

    it("should always assign an object to accounts", () => {
      const state = State.fromJSON({}, () => new Account({}));
      expect(state.accounts).not.toBeNull();
      expect(state.accounts).toEqual({});
    });

    it("should build an account map", () => {
      const accountsSpy = jest.spyOn(Account, "fromJSON");
      const state = State.fromJSON(
        {
          accounts: {
            userId: {},
          },
        },
        Account.fromJSON,
      );

      expect(state.accounts["userId"]).toBeInstanceOf(Account);
      expect(accountsSpy).toHaveBeenCalled();
    });
  });
});
