import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { UserAsymmetricKeysRegenerationService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { LoginEmailService } from "../login-email/login-email.service";

import { DefaultLoginSuccessHandlerService } from "./default-login-success-handler.service";

describe("DefaultLoginSuccessHandlerService", () => {
  let service: DefaultLoginSuccessHandlerService;

  let configService: MockProxy<ConfigService>;
  let loginEmailService: MockProxy<LoginEmailService>;
  let policyService: MockProxy<PolicyService>;
  let ssoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  let syncService: MockProxy<SyncService>;
  let userAsymmetricKeysRegenerationService: MockProxy<UserAsymmetricKeysRegenerationService>;
  let logService: MockProxy<LogService>;

  const userId = "USER_ID" as UserId;
  const testEmail = "test@bitwarden.com";

  beforeEach(() => {
    configService = mock<ConfigService>();
    loginEmailService = mock<LoginEmailService>();
    policyService = mock<PolicyService>();
    ssoLoginService = mock<SsoLoginServiceAbstraction>();
    syncService = mock<SyncService>();
    userAsymmetricKeysRegenerationService = mock<UserAsymmetricKeysRegenerationService>();
    logService = mock<LogService>();

    service = new DefaultLoginSuccessHandlerService(
      configService,
      loginEmailService,
      policyService,
      ssoLoginService,
      syncService,
      userAsymmetricKeysRegenerationService,
      logService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("run", () => {
    describe("when PM22110_DisableAlternateLoginMethods flag is disabled", () => {
      beforeEach(() => {
        configService.getFeatureFlag.mockResolvedValue(false);
      });

      it("should not check SSO requirements", async () => {
        await service.run(userId);

        expect(ssoLoginService.getSsoEmail).not.toHaveBeenCalled();
        expect(policyService.policyAppliesToUser$).not.toHaveBeenCalled();
      });
    });

    describe("given PM22110_DisableAlternateLoginMethods flag is enabled", () => {
      beforeEach(() => {
        configService.getFeatureFlag.mockResolvedValue(true);
      });

      it("should check feature flag", async () => {
        await service.run(userId);

        expect(configService.getFeatureFlag).toHaveBeenCalledWith(
          FeatureFlag.PM22110_DisableAlternateLoginMethods,
        );
      });

      it("should get SSO email", async () => {
        await service.run(userId);

        expect(ssoLoginService.getSsoEmail).toHaveBeenCalled();
      });

      describe("given SSO email is not found", () => {
        beforeEach(() => {
          ssoLoginService.getSsoEmail.mockResolvedValue(null);
        });

        it("should log error and return early", async () => {
          await service.run(userId);

          expect(logService.error).toHaveBeenCalledWith("SSO login email not found.");
          expect(policyService.policyAppliesToUser$).not.toHaveBeenCalled();
        });
      });

      describe("given SSO email is found", () => {
        beforeEach(() => {
          ssoLoginService.getSsoEmail.mockResolvedValue(testEmail);
          policyService.policyAppliesToUser$.mockReturnValue(of(false));
        });

        it("should check if SSO is required for user", async () => {
          await service.run(userId);

          expect(policyService.policyAppliesToUser$).toHaveBeenCalledWith(
            PolicyType.RequireSso,
            userId,
          );
        });

        describe("given SSO is required", () => {
          beforeEach(() => {
            policyService.policyAppliesToUser$.mockReturnValue(of(true));
          });

          it("should add email to SSO required cache", async () => {
            await service.run(userId);

            expect(ssoLoginService.addToSsoRequiredCache).toHaveBeenCalledWith(testEmail);
            expect(ssoLoginService.removeFromSsoRequiredCacheIfPresent).not.toHaveBeenCalled();
          });
        });

        describe("given SSO is not required", () => {
          beforeEach(() => {
            policyService.policyAppliesToUser$.mockReturnValue(of(false));
          });

          it("should remove email from SSO required cache if present", async () => {
            await service.run(userId);

            expect(ssoLoginService.removeFromSsoRequiredCacheIfPresent).toHaveBeenCalledWith(
              testEmail,
            );
            expect(ssoLoginService.addToSsoRequiredCache).not.toHaveBeenCalled();
          });
        });
      });
    });
  });
});
