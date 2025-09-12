import { mock, MockProxy } from "jest-mock-extended";

import {
  CODE_VERIFIER,
  GLOBAL_ORGANIZATION_SSO_IDENTIFIER,
  SSO_EMAIL,
  SSO_REQUIRED_CACHE,
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
  let mockStateProvider: FakeStateProvider;
  let mockLogService: MockProxy<LogService>;
  let userId: UserId;

  beforeEach(() => {
    jest.clearAllMocks();

    userId = Utils.newGuid() as UserId;
    accountService = mockAccountServiceWith(userId);
    mockStateProvider = new FakeStateProvider(accountService);
    mockLogService = mock<LogService>();

    sut = new SsoLoginService(mockStateProvider, mockLogService);
  });

  it("instantiates", () => {
    expect(sut).not.toBeFalsy();
  });

  it("gets and sets code verifier", async () => {
    const codeVerifier = "test-code-verifier";
    await sut.setCodeVerifier(codeVerifier);
    mockStateProvider.getGlobal(CODE_VERIFIER);

    const result = await sut.getCodeVerifier();
    expect(result).toBe(codeVerifier);
  });

  it("gets and sets SSO state", async () => {
    const ssoState = "test-sso-state";
    await sut.setSsoState(ssoState);
    mockStateProvider.getGlobal(SSO_STATE);

    const result = await sut.getSsoState();
    expect(result).toBe(ssoState);
  });

  it("gets and sets organization SSO identifier", async () => {
    const orgIdentifier = "test-org-identifier";
    await sut.setOrganizationSsoIdentifier(orgIdentifier);
    mockStateProvider.getGlobal(GLOBAL_ORGANIZATION_SSO_IDENTIFIER);

    const result = await sut.getOrganizationSsoIdentifier();
    expect(result).toBe(orgIdentifier);
  });

  it("gets and sets SSO email", async () => {
    const email = "test@example.com";
    await sut.setSsoEmail(email);
    mockStateProvider.getGlobal(SSO_EMAIL);

    const result = await sut.getSsoEmail();
    expect(result).toBe(email);
  });

  it("gets and sets active user organization SSO identifier", async () => {
    const userId = Utils.newGuid() as UserId;
    const orgIdentifier = "test-active-org-identifier";
    await sut.setActiveUserOrganizationSsoIdentifier(orgIdentifier, userId);
    mockStateProvider.getUser(userId, USER_ORGANIZATION_SSO_IDENTIFIER);

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

  describe("addToSsoRequiredCache()", () => {
    it("should add an email to an empty cache", async () => {
      const email = "test@example.com";
      mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([]);

      await sut.addToSsoRequiredCache(email);

      const cacheState = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cacheState.nextMock).toHaveBeenCalledWith([email]);
    });

    it("should add an email to an existing cache when that email is not already present", async () => {
      const existingEmail = "existing@example.com";
      const newEmail = "new@example.com";

      mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([existingEmail]);

      await sut.addToSsoRequiredCache(newEmail);

      const cacheState = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cacheState.nextMock).toHaveBeenCalledWith([existingEmail, newEmail]);
    });

    it("should not add a duplicate email to cache", async () => {
      const duplicateEmail = "duplicate@example.com";

      mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([duplicateEmail]);

      await sut.addToSsoRequiredCache(duplicateEmail);

      const cacheState = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cacheState.nextMock).not.toHaveBeenCalled();
    });

    it("should initialize a new cache with an email when no cache exists", async () => {
      const email = "test@example.com";

      mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next(null);

      await sut.addToSsoRequiredCache(email);

      const cacheState = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cacheState.nextMock).toHaveBeenCalledWith([email]);
    });
  });

  describe("removeFromSsoRequiredCacheIfPresent()", () => {
    it("should remove email from cache when present", async () => {
      const emailToRemove = "remove@example.com";
      const remainingEmail = "keep@example.com";

      mockStateProvider.global
        .getFake(SSO_REQUIRED_CACHE)
        .stateSubject.next([emailToRemove, remainingEmail]);

      await sut.removeFromSsoRequiredCacheIfPresent(emailToRemove);

      const cacheState = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cacheState.nextMock).toHaveBeenCalledWith([remainingEmail]);
    });

    it("should not update cache when email is not present", async () => {
      const existingEmail = "existing@example.com";
      const nonExistentEmail = "nonexistent@example.com";

      mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([existingEmail]);

      await sut.removeFromSsoRequiredCacheIfPresent(nonExistentEmail);

      const cacheState = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cacheState.nextMock).not.toHaveBeenCalled();
    });

    it("should not update cache when cache is already null", async () => {
      const email = "test@example.com";

      mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next(null);

      await sut.removeFromSsoRequiredCacheIfPresent(email);

      const cacheState = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cacheState.nextMock).not.toHaveBeenCalled();
    });

    it("should result in an empty array when removing last email", async () => {
      const email = "test@example.com";

      mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([email]);

      await sut.removeFromSsoRequiredCacheIfPresent(email);

      const cacheState = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cacheState.nextMock).toHaveBeenCalledWith([]);
    });
  });
});
