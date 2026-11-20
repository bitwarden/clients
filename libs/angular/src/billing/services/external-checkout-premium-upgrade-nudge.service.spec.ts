import { TestBed } from "@angular/core/testing";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of, throwError } from "rxjs";

import { ClientType } from "@bitwarden/client-type";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { PremiumCheckoutPendingService } from "@bitwarden/common/billing/abstractions/account/premium-checkout-pending.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { PremiumUpgradeNudgeOptions } from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";
import { PremiumCheckoutSessionResponse } from "@bitwarden/common/billing/models/response/premium-checkout-session.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  PremiumUpgradeNudgeComponent,
  PremiumUpgradeNudgeDialogData,
} from "../components/premium-upgrade-nudge/premium-upgrade-nudge.component";

import { ExternalCheckoutPremiumUpgradeNudgeService } from "./external-checkout-premium-upgrade-nudge.service";

describe("ExternalCheckoutPremiumUpgradeNudgeService", () => {
  let service: ExternalCheckoutPremiumUpgradeNudgeService;
  let accountService: MockProxy<AccountService>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let dialogService: MockProxy<DialogService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let environmentService: MockProxy<EnvironmentService>;
  let configService: MockProxy<ConfigService>;
  let billingApiService: MockProxy<BillingApiServiceAbstraction>;
  let premiumCheckoutPendingService: MockProxy<PremiumCheckoutPendingService>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;
  let logService: MockProxy<LogService>;

  let activeAccount$: BehaviorSubject<Account | null>;
  let environment: MockProxy<Environment>;
  let flags: Partial<Record<FeatureFlag, boolean>>;
  let openSpy: jest.SpyInstance;

  const userId = "user-id" as UserId;
  const account = { id: userId } as Account;
  const checkoutSessionUrl = "https://checkout.stripe.com/session";
  const webVaultUrl = "https://vault.bitwarden.com";
  const webVaultSubscriptionUrl =
    webVaultUrl + "/#/settings/subscription/premium?callToAction=upgradeToPremium";
  const options: PremiumUpgradeNudgeOptions = {
    titleKey: "title",
    descriptionKey: "description",
    image: "totp",
    checkoutFeatureNameKey: "authenticatorFeature",
  };

  const openedData = (): PremiumUpgradeNudgeDialogData => openSpy.mock.calls[0][1].data;

  const openNudgeAndUpgrade = async (nudgeOptions = options): Promise<void> => {
    await service.hasPremiumOrShowUpgradeNudge(nudgeOptions);
    await openedData().upgrade();
  };

  beforeEach(() => {
    accountService = mock<AccountService>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    dialogService = mock<DialogService>();
    platformUtilsService = mock<PlatformUtilsService>();
    environmentService = mock<EnvironmentService>();
    configService = mock<ConfigService>();
    billingApiService = mock<BillingApiServiceAbstraction>();
    premiumCheckoutPendingService = mock<PremiumCheckoutPendingService>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    logService = mock<LogService>();

    activeAccount$ = new BehaviorSubject<Account | null>(account);
    accountService.activeAccount$ = activeAccount$;
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(false));
    platformUtilsService.getClientType.mockReturnValue(ClientType.Browser);

    environment = mock<Environment>();
    environment.isCloud.mockReturnValue(true);
    environment.getWebVaultUrl.mockReturnValue(webVaultUrl);
    environmentService.environment$ = new BehaviorSubject<Environment>(environment);

    flags = {};
    configService.getFeatureFlag.mockImplementation(async (flag) => flags[flag] ?? false);

    billingApiService.createPremiumCheckoutSession.mockResolvedValue(
      new PremiumCheckoutSessionResponse({ CheckoutSessionUrl: checkoutSessionUrl }),
    );
    premiumCheckoutPendingService.markCheckoutLaunched.mockResolvedValue();
    i18nService.t.mockImplementation((key: string) => key);

    openSpy = jest.spyOn(PremiumUpgradeNudgeComponent, "open").mockReturnValue(mock());

    TestBed.configureTestingModule({
      providers: [
        ExternalCheckoutPremiumUpgradeNudgeService,
        { provide: AccountService, useValue: accountService },
        {
          provide: BillingAccountProfileStateService,
          useValue: billingAccountProfileStateService,
        },
        { provide: DialogService, useValue: dialogService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: ConfigService, useValue: configService },
        { provide: BillingApiServiceAbstraction, useValue: billingApiService },
        { provide: PremiumCheckoutPendingService, useValue: premiumCheckoutPendingService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
        { provide: LogService, useValue: logService },
      ],
    });

    service = TestBed.inject(ExternalCheckoutPremiumUpgradeNudgeService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("hasPremiumOrShowUpgradeNudge", () => {
    it("resolves true and opens nothing for a premium user", async () => {
      billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));

      await expect(service.hasPremiumOrShowUpgradeNudge(options)).resolves.toBe(true);

      expect(billingAccountProfileStateService.hasPremiumFromAnySource$).toHaveBeenCalledWith(
        userId,
      );
      expect(openSpy).not.toHaveBeenCalled();
    });

    it("resolves false and opens the nudge with the given options for a free user", async () => {
      await expect(service.hasPremiumOrShowUpgradeNudge(options)).resolves.toBe(false);

      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy.mock.calls[0][0]).toBe(dialogService);
      expect(openedData().options).toBe(options);
    });

    it("rejects and opens nothing when the premium read errors", async () => {
      const error = new Error("state read failed");
      billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(
        throwError(() => error),
      );

      await expect(service.hasPremiumOrShowUpgradeNudge(options)).rejects.toBe(error);

      expect(openSpy).not.toHaveBeenCalled();
    });

    it("rejects without reading premium when there is no active account", async () => {
      activeAccount$.next(null);

      await expect(service.hasPremiumOrShowUpgradeNudge(options)).rejects.toThrow(
        "Null or undefined account",
      );

      expect(billingAccountProfileStateService.hasPremiumFromAnySource$).not.toHaveBeenCalled();
      expect(openSpy).not.toHaveBeenCalled();
    });

    it("opens the nudge with disableClose on the browser extension", async () => {
      await service.hasPremiumOrShowUpgradeNudge(options);

      expect(openSpy.mock.calls[0][1].disableClose).toBe(true);
    });

    it("opens the nudge without disableClose on desktop", async () => {
      platformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);

      await service.hasPremiumOrShowUpgradeNudge(options);

      expect(openSpy.mock.calls[0][1].disableClose).toBe(false);
    });
  });

  describe("upgrade handler", () => {
    describe("when external checkout is enabled on cloud", () => {
      beforeEach(() => {
        flags[FeatureFlag.PM34515_BrowserDesktopCheckout] = true;
      });

      it("creates a browser checkout session, launches it and marks checkout launched with the feature", async () => {
        await openNudgeAndUpgrade();

        expect(billingApiService.createPremiumCheckoutSession).toHaveBeenCalledWith({
          platform: "browser",
        });
        expect(platformUtilsService.launchUri).toHaveBeenCalledWith(checkoutSessionUrl);
        expect(premiumCheckoutPendingService.markCheckoutLaunched).toHaveBeenCalledWith(userId, {
          featureNameKey: "authenticatorFeature",
        });
        expect(toastService.showToast).not.toHaveBeenCalled();
      });

      it("marks checkout launched with an undefined feature when none is given", async () => {
        await openNudgeAndUpgrade({
          titleKey: "title",
          descriptionKey: "description",
          image: "totp",
        });

        expect(premiumCheckoutPendingService.markCheckoutLaunched).toHaveBeenCalledWith(userId, {
          featureNameKey: undefined,
        });
      });

      it("launches checkout before marking it launched", async () => {
        await openNudgeAndUpgrade();

        expect(platformUtilsService.launchUri.mock.invocationCallOrder[0]).toBeLessThan(
          premiumCheckoutPendingService.markCheckoutLaunched.mock.invocationCallOrder[0],
        );
      });

      it("creates a desktop checkout session on desktop", async () => {
        platformUtilsService.getClientType.mockReturnValue(ClientType.Desktop);

        await openNudgeAndUpgrade();

        expect(billingApiService.createPremiumCheckoutSession).toHaveBeenCalledWith({
          platform: "desktop",
        });
      });

      it("launches checkout but skips marking when there is no active account at click time", async () => {
        await service.hasPremiumOrShowUpgradeNudge(options);
        activeAccount$.next(null);

        await openedData().upgrade();

        expect(platformUtilsService.launchUri).toHaveBeenCalledWith(checkoutSessionUrl);
        expect(premiumCheckoutPendingService.markCheckoutLaunched).not.toHaveBeenCalled();
      });

      it("resolves and logs without a toast when marking checkout launched fails", async () => {
        const error = new Error("state write failed");
        premiumCheckoutPendingService.markCheckoutLaunched.mockRejectedValue(error);

        await expect(openNudgeAndUpgrade()).resolves.toBeUndefined();

        expect(platformUtilsService.launchUri).toHaveBeenCalledWith(checkoutSessionUrl);
        expect(logService.error).toHaveBeenCalledTimes(1);
        expect(logService.error).toHaveBeenCalledWith(
          "Failed to mark premium checkout as pending",
          error,
        );
        expect(toastService.showToast).not.toHaveBeenCalled();
      });

      it("resolves, shows an error toast and logs when creating the session fails", async () => {
        const error = new Error("api failed");
        billingApiService.createPremiumCheckoutSession.mockRejectedValue(error);

        await expect(openNudgeAndUpgrade()).resolves.toBeUndefined();

        expect(toastService.showToast).toHaveBeenCalledWith({
          variant: "error",
          title: "error",
          message: "unexpectedError",
        });
        expect(logService.error).toHaveBeenCalledTimes(1);
        expect(logService.error).toHaveBeenCalledWith("Failed to start premium upgrade", error);
        expect(platformUtilsService.launchUri).not.toHaveBeenCalled();
        expect(premiumCheckoutPendingService.markCheckoutLaunched).not.toHaveBeenCalled();
      });

      it("launches the web vault subscription page on a client without external checkout", async () => {
        platformUtilsService.getClientType.mockReturnValue(ClientType.Web);

        await openNudgeAndUpgrade();

        expect(platformUtilsService.launchUri).toHaveBeenCalledWith(webVaultSubscriptionUrl);
        expect(billingApiService.createPremiumCheckoutSession).not.toHaveBeenCalled();
        expect(premiumCheckoutPendingService.markCheckoutLaunched).not.toHaveBeenCalled();
      });

      it("stays pending until the checkout session is created", async () => {
        let resolveSession!: (response: PremiumCheckoutSessionResponse) => void;
        billingApiService.createPremiumCheckoutSession.mockReturnValue(
          new Promise((resolve) => {
            resolveSession = resolve;
          }),
        );
        await service.hasPremiumOrShowUpgradeNudge(options);

        let settled = false;
        const upgrade = openedData()
          .upgrade()
          .then(() => {
            settled = true;
          });
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(settled).toBe(false);
        expect(platformUtilsService.launchUri).not.toHaveBeenCalled();

        resolveSession(
          new PremiumCheckoutSessionResponse({ CheckoutSessionUrl: checkoutSessionUrl }),
        );
        await upgrade;

        expect(settled).toBe(true);
        expect(platformUtilsService.launchUri).toHaveBeenCalledWith(checkoutSessionUrl);
      });
    });

    it("launches the web vault subscription page when external checkout is disabled", async () => {
      await openNudgeAndUpgrade();

      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(webVaultSubscriptionUrl);
      expect(billingApiService.createPremiumCheckoutSession).not.toHaveBeenCalled();
      expect(premiumCheckoutPendingService.markCheckoutLaunched).not.toHaveBeenCalled();
    });

    describe("when self-hosted", () => {
      const selfHostedVaultUrl = "https://bitwarden.example.com";

      beforeEach(() => {
        flags[FeatureFlag.PM34515_BrowserDesktopCheckout] = true;
        environment.isCloud.mockReturnValue(false);
        environment.getWebVaultUrl.mockReturnValue(selfHostedVaultUrl);
      });

      it("launches the self-hosted web vault subscription page", async () => {
        await openNudgeAndUpgrade();

        expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
          selfHostedVaultUrl + "/#/settings/subscription/premium?callToAction=upgradeToPremium",
        );
        expect(billingApiService.createPremiumCheckoutSession).not.toHaveBeenCalled();
        expect(premiumCheckoutPendingService.markCheckoutLaunched).not.toHaveBeenCalled();
      });

      it("creates a checkout session when the self-host check is bypassed", async () => {
        flags[FeatureFlag.DebugDisableSelfHostPremiumCheck] = true;

        await openNudgeAndUpgrade();

        expect(billingApiService.createPremiumCheckoutSession).toHaveBeenCalledWith({
          platform: "browser",
        });
        expect(platformUtilsService.launchUri).toHaveBeenCalledWith(checkoutSessionUrl);
      });
    });

    it("resolves, shows an error toast and logs when reading the environment fails", async () => {
      const error = new Error("environment failed");
      environmentService.environment$ = throwError(() => error);

      await expect(openNudgeAndUpgrade()).resolves.toBeUndefined();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "error",
        message: "unexpectedError",
      });
      expect(logService.error).toHaveBeenCalledTimes(1);
      expect(logService.error).toHaveBeenCalledWith("Failed to start premium upgrade", error);
      expect(platformUtilsService.launchUri).not.toHaveBeenCalled();
    });

    it("resolves, shows an error toast and logs when reading a feature flag fails", async () => {
      const error = new Error("config failed");
      configService.getFeatureFlag.mockRejectedValue(error);

      await expect(openNudgeAndUpgrade()).resolves.toBeUndefined();

      expect(toastService.showToast).toHaveBeenCalledWith({
        variant: "error",
        title: "error",
        message: "unexpectedError",
      });
      expect(logService.error).toHaveBeenCalledTimes(1);
      expect(logService.error).toHaveBeenCalledWith("Failed to start premium upgrade", error);
      expect(platformUtilsService.launchUri).not.toHaveBeenCalled();
    });
  });
});
