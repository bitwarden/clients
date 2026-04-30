import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { MessageSender } from "@bitwarden/messaging";

import { BrowserApi } from "../../../platform/browser/browser-api";
import {
  PHISHING_DETECTION_CANCEL_COMMAND,
  PHISHING_DETECTION_CONTINUE_COMMAND,
} from "../services/phishing-detection.service";

import { PhishingWarningComponent } from "./phishing-warning.component";

describe("PhishingWarningComponent", () => {
  const mockUserId = "test-user-id" as UserId;
  const mockPhishingUrl = "https://phishing.example.com";

  let fixture: ComponentFixture<PhishingWarningComponent>;
  let component: PhishingWarningComponent;
  let accountService: FakeAccountService;
  let messageSender: ReturnType<typeof mock<MessageSender>>;

  beforeEach(async () => {
    accountService = mockAccountServiceWith(mockUserId);
    messageSender = mock<MessageSender>();

    jest.spyOn(BrowserApi, "getCurrentTab").mockResolvedValue({ id: 42 } as chrome.tabs.Tab);

    await TestBed.configureTestingModule({
      imports: [PhishingWarningComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({ phishingUrl: mockPhishingUrl })),
          },
        },
        { provide: MessageSender, useValue: messageSender },
        { provide: AccountService, useValue: accountService },
        { provide: I18nService, useValue: { t: jest.fn((key: string) => key) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PhishingWarningComponent);
    component = fixture.componentInstance;
  });

  describe("closeTab", () => {
    it("sends phishing detection cancel command", async () => {
      await component.closeTab();

      expect(messageSender.send).toHaveBeenCalledWith(PHISHING_DETECTION_CANCEL_COMMAND, {
        tabId: 42,
      });
    });
  });

  describe("continueAnyway", () => {
    it("sends phishing detection continue command with url", async () => {
      await component.continueAnyway();

      expect(messageSender.send).toHaveBeenCalledWith(PHISHING_DETECTION_CONTINUE_COMMAND, {
        tabId: 42,
        url: mockPhishingUrl,
      });
    });
  });
});
