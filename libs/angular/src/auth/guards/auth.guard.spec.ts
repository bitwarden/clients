import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { EmptyComponent } from "@bitwarden/angular/platform/guard/feature-flag.guard.spec";
import {
  Account,
  AccountInfo,
  AccountService,
} from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";

import { authGuard } from "./auth.guard";

describe("AuthGuard", () => {
  const setup = (
    authStatus: AuthenticationStatus,
    forceSetPasswordReason: ForceSetPasswordReason,
    keyConnectorServiceRequiresAccountConversion: boolean = false,
    featureFlag: FeatureFlag | null = null,
  ) => {
    const authService: MockProxy<AuthService> = mock<AuthService>();
    authService.getAuthStatus.mockResolvedValue(authStatus);
    const messagingService: MockProxy<MessagingService> = mock<MessagingService>();
    const keyConnectorService: MockProxy<KeyConnectorService> = mock<KeyConnectorService>();
    keyConnectorService.convertAccountRequired$ = of(keyConnectorServiceRequiresAccountConversion);
    const configService: MockProxy<ConfigService> = mock<ConfigService>();
    const accountService: MockProxy<AccountService> = mock<AccountService>();
    const activeAccountSubject = new BehaviorSubject<Account | null>(null);
    accountService.activeAccount$ = activeAccountSubject;
    activeAccountSubject.next(
      Object.assign(
        {
          name: "Test User 1",
          email: "test@email.com",
          emailVerified: true,
        } as AccountInfo,
        { id: "test-id" as UserId },
      ),
    );

    if (featureFlag) {
      configService.getFeatureFlag.mockResolvedValue(true);
    } else {
      configService.getFeatureFlag.mockResolvedValue(false);
    }

    const forceSetPasswordReasonSubject = new BehaviorSubject<ForceSetPasswordReason>(
      forceSetPasswordReason,
    );
    const masterPasswordService: MockProxy<MasterPasswordServiceAbstraction> =
      mock<MasterPasswordServiceAbstraction>();
    masterPasswordService.forceSetPasswordReason$.mockReturnValue(forceSetPasswordReasonSubject);

    const testBed = TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([
          { path: "", component: EmptyComponent },
          { path: "guarded-route", component: EmptyComponent, canActivate: [authGuard] },
          { path: "lock", component: EmptyComponent },
          { path: "set-password", component: EmptyComponent },
          { path: "set-password-jit", component: EmptyComponent },
          { path: "set-initial-password", component: EmptyComponent, canActivate: [authGuard] },
          { path: "update-temp-password", component: EmptyComponent, canActivate: [authGuard] },
          { path: "change-password", component: EmptyComponent },
          { path: "remove-password", component: EmptyComponent, canActivate: [authGuard] },
        ]),
      ],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: MessagingService, useValue: messagingService },
        { provide: KeyConnectorService, useValue: keyConnectorService },
        { provide: AccountService, useValue: accountService },
        { provide: MasterPasswordServiceAbstraction, useValue: masterPasswordService },
        { provide: ConfigService, useValue: configService },
      ],
    });

    return {
      router: testBed.inject(Router),
    };
  };

  it("should be created", () => {
    const { router } = setup(AuthenticationStatus.LoggedOut, ForceSetPasswordReason.None);
    expect(router).toBeTruthy();
  });

  it("should return allow access to the guarded route when user is logged in & unlocked", async () => {
    const { router } = setup(AuthenticationStatus.Unlocked, ForceSetPasswordReason.None);

    await router.navigate(["guarded-route"]);
    expect(router.url).toBe("/guarded-route");
  });

  it("should redirect to /lock when user is locked", async () => {
    const { router } = setup(AuthenticationStatus.Locked, ForceSetPasswordReason.None);

    await router.navigate(["guarded-route"]);
    expect(router.url).toContain("/lock");
  });

  it("should redirect to / when user is logged out", async () => {
    const { router } = setup(AuthenticationStatus.LoggedOut, ForceSetPasswordReason.None);

    await router.navigate(["guarded-route"]);
    expect(router.url).toBe("/");
  });

  it("should redirect to /remove-password if keyconnector service requires account conversion", async () => {
    const { router } = setup(AuthenticationStatus.Unlocked, ForceSetPasswordReason.None, true);

    await router.navigate(["guarded-route"]);
    expect(router.url).toBe("/remove-password");
  });

  describe("given user is Locked", () => {
    describe("given the PM16117_SetInitialPasswordRefactor feature flag is ON", () => {
      it("should redirect to /set-initial-password when the user has ForceSetPasswordReaason.TdeOffboardingUntrustedDevice", async () => {
        const { router } = setup(
          AuthenticationStatus.Locked,
          ForceSetPasswordReason.TdeOffboardingUntrustedDevice,
          false,
          FeatureFlag.PM16117_SetInitialPasswordRefactor,
        );

        await router.navigate(["guarded-route"]);
        expect(router.url).toBe("/set-initial-password");
      });

      it("should allow navigation to continue to /set-initial-password when the user has ForceSetPasswordReason.TdeOffboardingUntrustedDevice", async () => {
        const { router } = setup(
          AuthenticationStatus.Unlocked,
          ForceSetPasswordReason.TdeOffboardingUntrustedDevice,
          false,
          FeatureFlag.PM16117_SetInitialPasswordRefactor,
        );

        await router.navigate(["/set-initial-password"]);
        expect(router.url).toContain("/set-initial-password");
      });
    });
  });

  describe("given user is Unlocked", () => {
    describe("given the PM16117_SetInitialPasswordRefactor feature flag is ON", () => {
      const tests = [
        ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
        ForceSetPasswordReason.TdeOffboarding,
      ];

      describe("given user attempts to navigate to an auth guarded route", () => {
        tests.forEach((reason) => {
          it(`should redirect to /set-initial-password when the user has ForceSetPasswordReason.${ForceSetPasswordReason[reason]}`, async () => {
            const { router } = setup(
              AuthenticationStatus.Unlocked,
              reason,
              false,
              FeatureFlag.PM16117_SetInitialPasswordRefactor,
            );

            await router.navigate(["guarded-route"]);
            expect(router.url).toContain("/set-initial-password");
          });
        });
      });

      describe("given user attempts to navigate to /set-initial-password", () => {
        tests.forEach((reason) => {
          it(`should allow navigation to continue to /set-initial-password when the user has ForceSetPasswordReason.${ForceSetPasswordReason[reason]}`, async () => {
            const { router } = setup(
              AuthenticationStatus.Unlocked,
              reason,
              false,
              FeatureFlag.PM16117_SetInitialPasswordRefactor,
            );

            await router.navigate(["/set-initial-password"]);
            expect(router.url).toContain("/set-initial-password");
          });
        });
      });
    });

    describe("given the PM16117_SetInitialPasswordRefactor feature flag is OFF", () => {
      const tests = [
        {
          reason: ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
          url: "/set-password",
        },
        {
          reason: ForceSetPasswordReason.TdeOffboarding,
          url: "/update-temp-password",
        },
      ];

      describe("given user attempts to navigate to an auth guarded route", () => {
        tests.forEach(({ reason, url }) => {
          it(`should redirect to ${url} when user has ForceSetPasswordReason.${ForceSetPasswordReason[reason]}`, async () => {
            const { router } = setup(AuthenticationStatus.Unlocked, reason);

            await router.navigate(["/guarded-route"]);
            expect(router.url).toContain(url);
          });
        });
      });

      describe("given user attempts to navigate to the set- or update- password route itself", () => {
        tests.forEach(({ reason, url }) => {
          it(`should allow navigation to continue to ${url} when user has ForceSetPasswordReason.${ForceSetPasswordReason[reason]}`, async () => {
            const { router } = setup(AuthenticationStatus.Unlocked, reason);

            await router.navigate([url]);
            expect(router.url).toContain(url);
          });
        });
      });
    });

    describe("given the PM16117_ChangeExistingPasswordRefactor feature flag is ON", () => {
      const tests = [
        ForceSetPasswordReason.AdminForcePasswordReset,
        ForceSetPasswordReason.WeakMasterPassword,
      ];

      describe("given user attempts to navigate to an auth guarded route", () => {
        tests.forEach((reason) => {
          it(`should redirect to /change-password when user has ForceSetPasswordReason.${ForceSetPasswordReason[reason]}`, async () => {
            const { router } = setup(
              AuthenticationStatus.Unlocked,
              reason,
              false,
              FeatureFlag.PM16117_ChangeExistingPasswordRefactor,
            );

            await router.navigate(["guarded-route"]);
            expect(router.url).toContain("/change-password");
          });
        });
      });

      describe("given user attempts to navigate to /change-password", () => {
        tests.forEach((reason) => {
          it(`should allow navigation to /change-password when user has ForceSetPasswordReason.${ForceSetPasswordReason[reason]}`, async () => {
            const { router } = setup(
              AuthenticationStatus.Unlocked,
              ForceSetPasswordReason.AdminForcePasswordReset,
              false,
              FeatureFlag.PM16117_ChangeExistingPasswordRefactor,
            );

            await router.navigate(["/change-password"]);
            expect(router.url).toContain("/change-password");
          });
        });
      });
    });

    describe("given the PM16117_ChangeExistingPasswordRefactor feature flag is OFF", () => {
      const tests = [
        ForceSetPasswordReason.AdminForcePasswordReset,
        ForceSetPasswordReason.WeakMasterPassword,
      ];

      describe("given user attempts to navigate to an auth guarded route", () => {
        tests.forEach((reason) => {
          it(`should redirect to /update-temp-password when user has ForceSetPasswordReason.${ForceSetPasswordReason[reason]}`, async () => {
            const { router } = setup(AuthenticationStatus.Unlocked, reason);

            await router.navigate(["guarded-route"]);
            expect(router.url).toContain("/update-temp-password");
          });
        });
      });

      describe("given user attempts to navigate to /update-temp-password", () => {
        tests.forEach((reason) => {
          it(`should allow navigation to continue to /update-temp-password when user has ForceSetPasswordReason.${ForceSetPasswordReason[reason]}`, async () => {
            const { router } = setup(AuthenticationStatus.Unlocked, reason);

            await router.navigate(["/update-temp-password"]);
            expect(router.url).toContain("/update-temp-password");
          });
        });
      });
    });
  });
});
