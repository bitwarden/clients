import { mock, MockProxy } from "jest-mock-extended";
import { Observable, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { MessageListener } from "@bitwarden/messaging";

import { PhishingDataService } from "./phishing-data.service";
import { PhishingDetectionService } from "./phishing-detection.service";

describe("PhishingDetectionService", () => {
  let accountService: AccountService;
  let billingAccountProfileStateService: BillingAccountProfileStateService;
  let configService: ConfigService;
  let logService: LogService;
  let phishingDataService: MockProxy<PhishingDataService>;
  let messageListener: MockProxy<MessageListener>;
  let globalStateProvider: FakeGlobalStateProvider;

  beforeEach(() => {
    accountService = { getAccount$: jest.fn(() => of(null)) } as any;
    billingAccountProfileStateService = {} as any;
    configService = { getFeatureFlag$: jest.fn(() => of(false)) } as any;
    logService = { info: jest.fn(), debug: jest.fn(), warning: jest.fn(), error: jest.fn() } as any;
    phishingDataService = mock();
    messageListener = mock<MessageListener>({
      messages$(_commandDefinition) {
        return new Observable();
      },
    });
    globalStateProvider = new FakeGlobalStateProvider();
  });

  it("should initialize without errors", () => {
    expect(() => {
      PhishingDetectionService.initialize(
        accountService,
        billingAccountProfileStateService,
        configService,
        logService,
        phishingDataService,
        messageListener,
        globalStateProvider,
      );
    }).not.toThrow();
  });

  // TODO
  // it("should enable phishing detection for premium account", (done) => {
  //   const premiumAccount = { id: "user1" };
  //   accountService = { activeAccount$: of(premiumAccount) } as any;
  //   configService = { getFeatureFlag$: jest.fn(() => of(true)) } as any;
  //   billingAccountProfileStateService = {
  //     hasPremiumFromAnySource$: jest.fn(() => of(true)),
  //   } as any;

  //   // Run the initialization
  //   PhishingDetectionService.initialize(
  //     accountService,
  //     billingAccountProfileStateService,
  //     configService,
  //     logService,
  //     phishingDataService,
  //     messageListener,
  //   );
  // });

  // TODO
  // it("should not enable phishing detection for non-premium account", (done) => {
  //   const nonPremiumAccount = { id: "user2" };
  //   accountService = { activeAccount$: of(nonPremiumAccount) } as any;
  //   configService = { getFeatureFlag$: jest.fn(() => of(true)) } as any;
  //   billingAccountProfileStateService = {
  //     hasPremiumFromAnySource$: jest.fn(() => of(false)),
  //   } as any;

  //   // Run the initialization
  //   PhishingDetectionService.initialize(
  //     accountService,
  //     billingAccountProfileStateService,
  //     configService,
  //     logService,
  //     phishingDataService,
  //     messageListener,
  //   );
  // });
});
