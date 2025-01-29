import { mock, MockProxy } from "jest-mock-extended";

import { SsoLoginService } from "@bitwarden/common/auth/services/sso-login.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../spec";

describe("SSOLoginService ", () => {
  let ssoLoginService: SsoLoginService;

  let accountService: FakeAccountService;
  let singleUserStateProvider: FakeStateProvider;
  let logService: MockProxy<LogService>;

  beforeEach(() => {
    jest.clearAllMocks();

    const mockUserId = Utils.newGuid() as UserId;
    accountService = mockAccountServiceWith(mockUserId);
    singleUserStateProvider = new FakeStateProvider(accountService);
    logService = mock<LogService>();

    ssoLoginService = createSsoLoginService();
  });

  it("instantiates", () => {
    expect(ssoLoginService).not.toBeFalsy();
  });

  // Helpers
  function createSsoLoginService() {
    return new SsoLoginService(singleUserStateProvider, logService);
  }
});
