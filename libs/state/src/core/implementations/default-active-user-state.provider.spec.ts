import { mock } from "jest-mock-extended";

import { mockAccountServiceWith, trackEmissions } from "../../../../spec";
import { UserId } from "../../../types/guid";
import { SingleUserStateProvider } from "../user-state.provider";

import { DefaultActiveUserStateProvider } from "./default-active-user-state.provider";

describe("DefaultActiveUserStateProvider", () => {
  const singleUserStateProvider = mock<SingleUserStateProvider>();
  const userId = "userId" as UserId;
  const accountInfo = {
    id: userId,
    name: "name",
    email: "email",
    emailVerified: false,
  };
  const accountService = mockAccountServiceWith(userId, accountInfo);
  let sut: DefaultActiveUserStateProvider;

  beforeEach(() => {
    sut = new DefaultActiveUserStateProvider(accountService, singleUserStateProvider);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should track the active User id from account service", () => {
    const emissions = trackEmissions(sut.activeUserId$);

    accountService.activeAccountSubject.next(undefined);
    accountService.activeAccountSubject.next(accountInfo);

    expect(emissions).toEqual([userId, undefined, userId]);
  });
});
