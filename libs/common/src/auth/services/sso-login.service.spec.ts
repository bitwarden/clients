import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
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
  let mockPolicyService: MockProxy<PolicyService>;
  let userId: UserId;

  beforeEach(() => {
    jest.clearAllMocks();

    userId = Utils.newGuid() as UserId;
    accountService = mockAccountServiceWith(userId);
    mockStateProvider = new FakeStateProvider(accountService);
    mockLogService = mock<LogService>();
    mockPolicyService = mock<PolicyService>();

    sut = new SsoLoginService(mockStateProvider, mockLogService, mockPolicyService);
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

  describe("updateSsoRequiredCache()", () => {
    it("should add email to cache when SSO is required", async () => {
      const email = "test@example.com";

      mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([]);
      mockStateProvider.global.getFake(SSO_EMAIL).stateSubject.next(email);
      mockPolicyService.policyAppliesToUser$.mockReturnValue(of(true));

      await sut.updateSsoRequiredCache(email, userId);

      const cacheState = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cacheState.nextMock).toHaveBeenCalledWith([email.toLowerCase()]);

      const emailState = mockStateProvider.global.getFake(SSO_EMAIL);
      expect(emailState.nextMock).toHaveBeenCalledWith(null);
    });

    it("should add email to existing cache when SSO is required and email is not already present", async () => {
      const existingEmail = "existing@example.com";
      const newEmail = "new@example.com";

      mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([existingEmail]);
      mockStateProvider.global.getFake(SSO_EMAIL).stateSubject.next(newEmail);
      mockPolicyService.policyAppliesToUser$.mockReturnValue(of(true));

      await sut.updateSsoRequiredCache(newEmail, userId);

      const cacheState = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cacheState.nextMock).toHaveBeenCalledWith([existingEmail, newEmail.toLowerCase()]);

      const emailState = mockStateProvider.global.getFake(SSO_EMAIL);
      expect(emailState.nextMock).toHaveBeenCalledWith(null);
    });

    it("should not add duplicate email to cache when SSO is required", async () => {
      const duplicateEmail = "duplicate@example.com";

      mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([duplicateEmail]);
      mockStateProvider.global.getFake(SSO_EMAIL).stateSubject.next(duplicateEmail);
      mockPolicyService.policyAppliesToUser$.mockReturnValue(of(true));

      await sut.updateSsoRequiredCache(duplicateEmail, userId);

      const cacheState = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cacheState.nextMock).not.toHaveBeenCalled();

      const emailState = mockStateProvider.global.getFake(SSO_EMAIL);
      expect(emailState.nextMock).toHaveBeenCalledWith(null);
    });

    it("should initialize new cache with email when SSO is required and no cache exists", async () => {
      const email = "test@example.com";

      mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next(null);
      mockStateProvider.global.getFake(SSO_EMAIL).stateSubject.next(email);
      mockPolicyService.policyAppliesToUser$.mockReturnValue(of(true));

      await sut.updateSsoRequiredCache(email, userId);

      const cacheState = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cacheState.nextMock).toHaveBeenCalledWith([email.toLowerCase()]);

      const emailState = mockStateProvider.global.getFake(SSO_EMAIL);
      expect(emailState.nextMock).toHaveBeenCalledWith(null);
    });

    it("should remove email from cache when SSO is not required", async () => {
      const emailToRemove = "remove@example.com";
      const remainingEmail = "keep@example.com";

      mockStateProvider.global
        .getFake(SSO_REQUIRED_CACHE)
        .stateSubject.next([emailToRemove, remainingEmail]);
      mockStateProvider.global.getFake(SSO_EMAIL).stateSubject.next(emailToRemove);
      mockPolicyService.policyAppliesToUser$.mockReturnValue(of(false));

      await sut.updateSsoRequiredCache(emailToRemove, userId);

      const cacheState = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cacheState.nextMock).toHaveBeenCalledWith([remainingEmail]);

      const emailState = mockStateProvider.global.getFake(SSO_EMAIL);
      expect(emailState.nextMock).toHaveBeenCalledWith(null);
    });

    it("should not update cache when SSO is not required and email is not present", async () => {
      const existingEmail = "existing@example.com";
      const nonExistentEmail = "nonexistent@example.com";

      mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([existingEmail]);
      mockStateProvider.global.getFake(SSO_EMAIL).stateSubject.next(nonExistentEmail);
      mockPolicyService.policyAppliesToUser$.mockReturnValue(of(false));

      await sut.updateSsoRequiredCache(nonExistentEmail, userId);

      const cacheState = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cacheState.nextMock).not.toHaveBeenCalled();

      const emailState = mockStateProvider.global.getFake(SSO_EMAIL);
      expect(emailState.nextMock).toHaveBeenCalledWith(null);
    });

    it("should check policy for correct PolicyType and userId", async () => {
      const email = "test@example.com";

      mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([]);
      mockPolicyService.policyAppliesToUser$.mockReturnValue(of(true));

      await sut.updateSsoRequiredCache(email, userId);

      expect(mockPolicyService.policyAppliesToUser$).toHaveBeenCalledWith(
        PolicyType.RequireSso,
        userId,
      );
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
