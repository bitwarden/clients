import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { SsoLoginService } from "@bitwarden/common/auth/services/sso-login/sso-login.service";
import {
  CODE_VERIFIER,
  GLOBAL_ORGANIZATION_SSO_IDENTIFIER,
  SSO_EMAIL,
  SSO_REQUIRED_CACHE,
  SSO_STATE,
  USER_ORGANIZATION_SSO_IDENTIFIER,
} from "@bitwarden/common/auth/services/sso-login/sso-login.state";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { newGuid } from "@bitwarden/guid";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { SsoRequiredCacheEntry } from "../../abstractions/sso-login.service.abstraction";

const email = "user1@example.com";
const webVaultUrl = "https://vault.bitwarden.com";
const userId = newGuid() as UserId;

function entry(email: string, webVaultUrl: string): SsoRequiredCacheEntry {
  return { email, webVaultUrl };
}

describe("SSOLoginService ", () => {
  let sut: SsoLoginService;

  let accountService: FakeAccountService;
  let mockStateProvider: FakeStateProvider;
  let mockLogService: MockProxy<LogService>;
  let mockPolicyService: MockProxy<PolicyService>;
  let mockEnvironmentService: MockProxy<EnvironmentService>;

  beforeEach(() => {
    jest.clearAllMocks();

    accountService = mockAccountServiceWith(userId);
    mockStateProvider = new FakeStateProvider(accountService);
    mockLogService = mock<LogService>();
    mockPolicyService = mock<PolicyService>();
    mockEnvironmentService = mock<EnvironmentService>();

    mockEnvironmentService.getEnvironment$.mockReturnValue(
      of({ getWebVaultUrl: () => webVaultUrl } as Environment),
    );

    sut = new SsoLoginService(
      mockStateProvider,
      mockLogService,
      mockPolicyService,
      mockEnvironmentService,
    );
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
    describe("given SSO is required", () => {
      beforeEach(() => {
        mockPolicyService.policyAppliesToUser$.mockReturnValue(of(true));
      });

      it("should create the cache and add an entry to the cache upon successful SSO login", async () => {
        // Arrange
        mockStateProvider.global
          .getFake(SSO_REQUIRED_CACHE)
          .stateSubject.next(null as unknown as SsoRequiredCacheEntry[]);

        // Act
        await sut.updateSsoRequiredCache(email, userId);

        // Assert
        const cache = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
        expect(cache.nextMock).toHaveBeenCalledWith([entry(email, webVaultUrl)]);
      });

      it("should add an entry to the cache if that entry does not already exist in the cache", async () => {
        // Arrange
        mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([]);

        // Act
        await sut.updateSsoRequiredCache(email, userId);

        // Assert
        const cache = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
        expect(cache.nextMock).toHaveBeenCalledWith([entry(email, webVaultUrl)]);
      });

      it("should normalize email to lowercase before storing", async () => {
        // Arrange
        mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([]);

        // Act
        await sut.updateSsoRequiredCache("User1@Example.COM", userId);

        // Assert
        const cache = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
        expect(cache.nextMock).toHaveBeenCalledWith([entry("user1@example.com", webVaultUrl)]);
      });

      it("should NOT add a duplicate entry when the same email is passed with different casing", async () => {
        // Arrange
        mockStateProvider.global
          .getFake(SSO_REQUIRED_CACHE)
          .stateSubject.next([entry(email, webVaultUrl)]);

        // Act
        await sut.updateSsoRequiredCache("User1@Example.COM", userId);

        // Assert
        const cache = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
        expect(cache.nextMock).not.toHaveBeenCalled();
      });

      it("should NOT add an entry to the cache if that same entry already exists in the cache", async () => {
        // Arrange
        mockStateProvider.global
          .getFake(SSO_REQUIRED_CACHE)
          .stateSubject.next([entry(email, webVaultUrl)]);

        // Act
        await sut.updateSsoRequiredCache(email, userId);

        // Assert
        const cache = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
        expect(cache.nextMock).not.toHaveBeenCalled();
      });

      it("should add an entry to the cache when there already exists an entry in the cache that has the same email but a different webVaultUrl", async () => {
        // Arrange
        const euUrl = "https://vault.bitwarden.eu";
        mockStateProvider.global
          .getFake(SSO_REQUIRED_CACHE)
          .stateSubject.next([entry(email, euUrl)]);

        // Act
        await sut.updateSsoRequiredCache(email, userId);

        // Assert
        const cache = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
        expect(cache.nextMock).toHaveBeenCalledWith([
          entry(email, euUrl),
          entry(email, webVaultUrl),
        ]);
      });

      it("should get the environment using the correct userId", async () => {
        // Arrange
        mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([]);

        // Act
        await sut.updateSsoRequiredCache(email, userId);

        // Assert
        expect(mockEnvironmentService.getEnvironment$).toHaveBeenCalledWith(userId);
      });
    });

    describe("given SSO is not required", () => {
      beforeEach(() => {
        mockPolicyService.policyAppliesToUser$.mockReturnValue(of(false));
      });

      it("should remove an entry from the cache upon successful SSO login", async () => {
        // Arrange
        const otherEntry = entry("other@example.com", webVaultUrl);
        mockStateProvider.global
          .getFake(SSO_REQUIRED_CACHE)
          .stateSubject.next([entry(email, webVaultUrl), otherEntry]);

        // Act
        await sut.updateSsoRequiredCache(email, userId);

        // Assert
        const cache = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
        expect(cache.nextMock).toHaveBeenCalledWith([otherEntry]);
      });

      it("should NOT remove an entry from the cache (i.e. should not run update()) if that entry does not already exist in the cache", async () => {
        // Arrange
        const otherEntry = entry("other@example.com", webVaultUrl);
        mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([otherEntry]);

        // Act
        await sut.updateSsoRequiredCache(email, userId);

        // Assert
        const cache = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
        expect(cache.nextMock).not.toHaveBeenCalled();
      });

      it("should get the environment using the correct userId", async () => {
        // Arrange
        mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([]);

        // Act
        await sut.updateSsoRequiredCache(email, userId);

        // Assert
        expect(mockEnvironmentService.getEnvironment$).toHaveBeenCalledWith(userId);
      });
    });

    it("should check policy for correct PolicyType and userId", async () => {
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
    it("should remove an entry from the cache if present", async () => {
      // Arrange
      const otherEntry = entry("other@example.com", webVaultUrl);
      mockStateProvider.global
        .getFake(SSO_REQUIRED_CACHE)
        .stateSubject.next([entry(email, webVaultUrl), otherEntry]);

      // Act
      await sut.removeFromSsoRequiredCacheIfPresent(email, userId);

      // Assert
      const cache = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cache.nextMock).toHaveBeenCalledWith([otherEntry]);
    });

    it("should NOT remove from the cache when a matching entry is not present", async () => {
      // Arrange
      const otherEntry = entry("other@example.com", webVaultUrl);
      mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([otherEntry]);

      // Act
      await sut.removeFromSsoRequiredCacheIfPresent(email, userId);

      // Assert
      const cache = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cache.nextMock).not.toHaveBeenCalled();
    });

    it("should NOT remove from the cache (i.e. should not run update()) when the cache is null", async () => {
      // Arrange
      mockStateProvider.global
        .getFake(SSO_REQUIRED_CACHE)
        .stateSubject.next(null as unknown as SsoRequiredCacheEntry[]);

      // Act
      await sut.removeFromSsoRequiredCacheIfPresent(email, userId);

      // Assert
      const cache = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cache.nextMock).not.toHaveBeenCalled();
    });

    it("should result in an empty array after removing the last remaining entry", async () => {
      // Arrange
      mockStateProvider.global
        .getFake(SSO_REQUIRED_CACHE)
        .stateSubject.next([entry(email, webVaultUrl)]);

      // Act
      await sut.removeFromSsoRequiredCacheIfPresent(email, userId);

      // Assert
      const cache = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cache.nextMock).toHaveBeenCalledWith([]);
    });

    it("should normalize email to lowercase before matching and removing", async () => {
      // Arrange
      mockStateProvider.global
        .getFake(SSO_REQUIRED_CACHE)
        .stateSubject.next([entry(email, webVaultUrl)]);

      // Act
      await sut.removeFromSsoRequiredCacheIfPresent("User1@Example.COM", userId);

      // Assert
      const cache = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cache.nextMock).toHaveBeenCalledWith([]);
    });

    it("should get the environment using the correct userId", async () => {
      // Arrange
      mockStateProvider.global.getFake(SSO_REQUIRED_CACHE).stateSubject.next([]);

      // Act
      await sut.removeFromSsoRequiredCacheIfPresent(email, userId);

      // Assert
      expect(mockEnvironmentService.getEnvironment$).toHaveBeenCalledWith(userId);
    });

    it("should NOT remove an entry when the email matches but the resolved webVaultUrl differs", async () => {
      // Arrange
      const euUrl = "https://vault.bitwarden.eu";
      mockEnvironmentService.getEnvironment$.mockReturnValue(
        of({ getWebVaultUrl: () => euUrl } as Environment),
      );
      mockStateProvider.global
        .getFake(SSO_REQUIRED_CACHE)
        .stateSubject.next([entry(email, webVaultUrl)]);

      // Act
      await sut.removeFromSsoRequiredCacheIfPresent(email, userId);

      // Assert
      const cache = mockStateProvider.global.getFake(SSO_REQUIRED_CACHE);
      expect(cache.nextMock).not.toHaveBeenCalled();
    });
  });
});
