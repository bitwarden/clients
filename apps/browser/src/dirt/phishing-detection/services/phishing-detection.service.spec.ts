import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { PhishingDataService } from "./phishing-data.service";
import { PhishingDetectionService } from "./phishing-detection.service";

describe("PhishingDetectionService", () => {
  let accountService: AccountService;
  let billingAccountProfileStateService: BillingAccountProfileStateService;
  let configService: ConfigService;
  let logService: LogService;
  let phishingDataService: PhishingDataService;

  beforeEach(() => {
    accountService = { getAccount$: jest.fn(() => of(null)) } as any;
    billingAccountProfileStateService = {} as any;
    configService = { getFeatureFlag$: jest.fn(() => of(false)) } as any;
    logService = { info: jest.fn(), debug: jest.fn(), warning: jest.fn(), error: jest.fn() } as any;
    phishingDataService = {} as any;
  });

  it("should initialize without errors", () => {
    expect(() => {
      PhishingDetectionService.initialize(
        accountService,
        billingAccountProfileStateService,
        configService,
        logService,
        phishingDataService,
      );
    }).not.toThrow();
  });

  it("should enable phishing detection for premium account", (done) => {
    const premiumAccount = { id: "user1" };
    accountService = { activeAccount$: of(premiumAccount) } as any;
    configService = { getFeatureFlag$: jest.fn(() => of(true)) } as any;
    billingAccountProfileStateService = {
      hasPremiumFromAnySource$: jest.fn(() => of(true)),
    } as any;

    // Patch _setup to call done
    const setupSpy = jest
      .spyOn(PhishingDetectionService as any, "_setup")
      .mockImplementation(async () => {
        expect(setupSpy).toHaveBeenCalled();
        done();
      });

    // Run the initialization
    PhishingDetectionService.initialize(
      accountService,
      billingAccountProfileStateService,
      configService,
      logService,
      phishingDataService,
    );
  });

  it("should not enable phishing detection for non-premium account", (done) => {
    const nonPremiumAccount = { id: "user2" };
    accountService = { activeAccount$: of(nonPremiumAccount) } as any;
    configService = { getFeatureFlag$: jest.fn(() => of(true)) } as any;
    billingAccountProfileStateService = {
      hasPremiumFromAnySource$: jest.fn(() => of(false)),
    } as any;

    // Patch _setup to fail if called
    // [FIXME] This test needs to check if the setupSpy fails or is called
    // Refactor initialize in PhishingDetectionService to return a Promise or Observable that resolves/completes when initialization is done
    // So that spy setups can be properly verified after initialization
    // const setupSpy = jest
    //   .spyOn(PhishingDetectionService as any, "_setup")
    //   .mockImplementation(async () => {
    //     throw new Error("Should not call _setup");
    //   });

    // Patch _cleanup to call done
    const cleanupSpy = jest
      .spyOn(PhishingDetectionService as any, "_cleanup")
      .mockImplementation(() => {
        expect(cleanupSpy).toHaveBeenCalled();
        done();
      });

    // Run the initialization
    PhishingDetectionService.initialize(
      accountService,
      billingAccountProfileStateService,
      configService,
      logService,
      phishingDataService,
    );
  });
});
