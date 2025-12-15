import { mock, MockProxy } from "jest-mock-extended";
import { Observable, of } from "rxjs";

import { PhishingDetectionSettingsServiceAbstraction } from "@bitwarden/common/dirt/services/abstractions/phishing-detection-settings.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageListener } from "@bitwarden/messaging";

import { PhishingDataService } from "./phishing-data.service";
import { PhishingDetectionService } from "./phishing-detection.service";

describe("PhishingDetectionService", () => {
  let logService: LogService;
  let phishingDataService: MockProxy<PhishingDataService>;
  let messageListener: MockProxy<MessageListener>;
  let phishingDetectionSettingsService: MockProxy<PhishingDetectionSettingsServiceAbstraction>;

  beforeEach(() => {
    logService = { info: jest.fn(), debug: jest.fn(), warning: jest.fn(), error: jest.fn() } as any;
    phishingDataService = mock();
    messageListener = mock<MessageListener>({
      messages$(_commandDefinition) {
        return new Observable();
      },
    });
    phishingDetectionSettingsService = mock<PhishingDetectionSettingsServiceAbstraction>({
      on$: of(true),
    });
  });

  it("should initialize without errors", () => {
    expect(() => {
      PhishingDetectionService.initialize(
        logService,
        phishingDataService,
        phishingDetectionSettingsService,
        messageListener,
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
  //     phishingDetectionSettingsService,
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
  //     phishingDetectionSettingsService,
  //   );
  // });
});
