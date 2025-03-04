import { mock, MockProxy } from "jest-mock-extended";

import {
  CODE_VERIFIER,
  GLOBAL_ORGANIZATION_SSO_IDENTIFIER,
  SSO_EMAIL,
  SSO_STATE,
  SsoLoginService,
  USER_ORGANIZATION_SSO_IDENTIFIER,
} from "@bitwarden/common/auth/services/sso-login.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../spec";

describe("SSOLoginService ", () => {
  let sut: SsoLoginService;

  let accountService: FakeAccountService;
  let mockSingleUserStateProvider: FakeStateProvider;
  let mockLogService: MockProxy<LogService>;
  let userId: UserId;

  beforeEach(() => {
    jest.clearAllMocks();

    userId = Utils.newGuid() as UserId;
    accountService = mockAccountServiceWith(userId);
    mockSingleUserStateProvider = new FakeStateProvider(accountService);
    mockLogService = mock<LogService>();

    sut = new SsoLoginService(mockSingleUserStateProvider, mockLogService);
  });

  it("instantiates", () => {
    expect(sut).not.toBeFalsy();
  });

  it("gets and sets code verifier", async () => {
    const codeVerifier = "test-code-verifier";
    await sut.setCodeVerifier(codeVerifier);
    mockSingleUserStateProvider.getGlobal(CODE_VERIFIER);

    const result = await sut.getCodeVerifier();
    expect(result).toBe(codeVerifier);
  });

  it("gets and sets SSO state", async () => {
    const ssoState = "test-sso-state";
    await sut.setSsoState(ssoState);
    mockSingleUserStateProvider.getGlobal(SSO_STATE);

    const result = await sut.getSsoState();
    expect(result).toBe(ssoState);
  });

  it("gets and sets organization SSO identifier", async () => {
    const orgIdentifier = "test-org-identifier";
    await sut.setOrganizationSsoIdentifier(orgIdentifier);
    mockSingleUserStateProvider.getGlobal(GLOBAL_ORGANIZATION_SSO_IDENTIFIER);

    const result = await sut.getOrganizationSsoIdentifier();
    expect(result).toBe(orgIdentifier);
  });

  it("gets and sets SSO email", async () => {
    const email = "test@example.com";
    await sut.setSsoEmail(email);
    mockSingleUserStateProvider.getGlobal(SSO_EMAIL);

    const result = await sut.getSsoEmail();
    expect(result).toBe(email);
  });

  it("gets and sets active user organization SSO identifier", async () => {
    const userId = Utils.newGuid() as UserId;
    const orgIdentifier = "test-active-org-identifier";
    await sut.setActiveUserOrganizationSsoIdentifier(orgIdentifier, userId);
    mockSingleUserStateProvider.getUser(userId, USER_ORGANIZATION_SSO_IDENTIFIER);

    const result = await sut.getActiveUserOrganizationSsoIdentifier(userId);
    expect(result).toBe(orgIdentifier);
  });

  it("logs error when setting active user organization SSO identifier with undefined userId", async () => {
    const orgIdentifier = "test-active-org-identifier";
    await sut.setActiveUserOrganizationSsoIdentifier(orgIdentifier, undefined);

    expect(mockLogService.error).toHaveBeenCalledWith(
      "Tried to set a user organization sso identifier with an undefined user id.",
    );
  });
});
