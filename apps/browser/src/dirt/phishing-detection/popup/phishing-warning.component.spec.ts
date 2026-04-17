import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { MessageSender } from "@bitwarden/messaging";

import { BrowserApi } from "../../../platform/browser/browser-api";
import {
  PHISHING_DETECTION_CANCEL_COMMAND,
  PHISHING_DETECTION_CONTINUE_COMMAND,
} from "../services/phishing-detection.service";

import { PhishingWarning } from "./phishing-warning.component";

describe("PhishingWarning", () => {
  const mockUserId = "test-user-id" as UserId;
  const mockPhishingUrl = "https://phishing.example.com";

  let fixture: ComponentFixture<PhishingWarning>;
  let component: PhishingWarning;
  let accountService: FakeAccountService;
  let organizationService: ReturnType<typeof mock<OrganizationService>>;
  let eventCollectionService: ReturnType<typeof mock<EventCollectionService>>;
  let messageSender: ReturnType<typeof mock<MessageSender>>;

  const orgWithEvents = { id: "org-1", useEvents: true, usePhishingBlocker: true } as Organization;
  const orgWithoutEvents = {
    id: "org-2",
    useEvents: false,
    usePhishingBlocker: false,
  } as Organization;

  beforeEach(async () => {
    accountService = mockAccountServiceWith(mockUserId);
    organizationService = mock<OrganizationService>();
    eventCollectionService = mock<EventCollectionService>();
    messageSender = mock<MessageSender>();

    organizationService.organizations$.mockImplementation(() =>
      of([orgWithEvents, orgWithoutEvents]),
    );
    eventCollectionService.collect.mockResolvedValue(undefined);

    jest.spyOn(BrowserApi, "getCurrentTab").mockResolvedValue({ id: 42 } as chrome.tabs.Tab);

    await TestBed.configureTestingModule({
      imports: [PhishingWarning],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({ phishingUrl: mockPhishingUrl })),
          },
        },
        { provide: MessageSender, useValue: messageSender },
        { provide: EventCollectionService, useValue: eventCollectionService },
        { provide: OrganizationService, useValue: organizationService },
        { provide: AccountService, useValue: accountService },
        { provide: I18nService, useValue: { t: jest.fn((key: string) => key) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PhishingWarning);
    component = fixture.componentInstance;
  });

  describe("ngOnInit", () => {
    it("collects PhishingBlocker_SiteAccessed for each org with useEvents", async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      expect(eventCollectionService.collect).toHaveBeenCalledWith(
        EventType.PhishingBlocker_SiteAccessed,
        undefined,
        false,
        "org-1",
      );
      expect(eventCollectionService.collect).not.toHaveBeenCalledWith(
        EventType.PhishingBlocker_SiteAccessed,
        undefined,
        false,
        "org-2",
      );
      expect(eventCollectionService.collect).toHaveBeenCalledTimes(1);
    });

    it("does not collect events when no orgs have useEvents", async () => {
      organizationService.organizations$.mockImplementation(() => of([orgWithoutEvents]));

      fixture.detectChanges();
      await fixture.whenStable();

      expect(eventCollectionService.collect).not.toHaveBeenCalled();
    });
  });

  describe("closeTab", () => {
    it("collects PhishingBlocker_SiteExited for each org with useEvents before closing", async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      eventCollectionService.collect.mockClear();

      await component.closeTab();

      expect(eventCollectionService.collect).toHaveBeenCalledWith(
        EventType.PhishingBlocker_SiteExited,
        undefined,
        false,
        "org-1",
      );
      expect(eventCollectionService.collect).not.toHaveBeenCalledWith(
        EventType.PhishingBlocker_SiteExited,
        undefined,
        false,
        "org-2",
      );
      expect(eventCollectionService.collect).toHaveBeenCalledTimes(1);
      expect(messageSender.send).toHaveBeenCalledWith(PHISHING_DETECTION_CANCEL_COMMAND, {
        tabId: 42,
      });
    });
  });

  describe("continueAnyway", () => {
    it("collects PhishingBlocker_Bypassed for each org with useEvents", async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      eventCollectionService.collect.mockClear();

      await component.continueAnyway();

      expect(eventCollectionService.collect).toHaveBeenCalledWith(
        EventType.PhishingBlocker_Bypassed,
        undefined,
        true,
        "org-1",
      );
      expect(eventCollectionService.collect).not.toHaveBeenCalledWith(
        EventType.PhishingBlocker_Bypassed,
        undefined,
        true,
        "org-2",
      );
      expect(eventCollectionService.collect).toHaveBeenCalledTimes(1);
      expect(messageSender.send).toHaveBeenCalledWith(PHISHING_DETECTION_CONTINUE_COMMAND, {
        tabId: 42,
        url: mockPhishingUrl,
      });
    });
  });
  describe("getOrgsToNotify", () => {
    it("filters organizations by useEvents and usePhishingBlocker", async () => {
      const orgWithBoth = {
        id: "org-1",
        useEvents: true,
        usePhishingBlocker: true,
      } as Organization;
      const orgWithoutEvents = {
        id: "org-2",
        useEvents: false,
        usePhishingBlocker: true,
      } as Organization;
      const orgWithoutPhishingBlocker = {
        id: "org-3",
        useEvents: true,
        usePhishingBlocker: false,
      } as Organization;
      const orgWithNeither = {
        id: "org-4",
        useEvents: false,
        usePhishingBlocker: false,
      } as Organization;

      organizationService.organizations$.mockImplementation(() =>
        of([orgWithBoth, orgWithoutEvents, orgWithoutPhishingBlocker, orgWithNeither]),
      );

      fixture.detectChanges();
      const result = await fixture.componentInstance["getOrgsToNotify"]();

      expect(result).toEqual([orgWithBoth]);
    });

    it("returns empty array when no orgs have both useEvents and usePhishingBlocker", async () => {
      const orgWithOnlyEvents = {
        id: "org-1",
        useEvents: true,
        usePhishingBlocker: false,
      } as Organization;
      const orgWithOnlyPhishingBlocker = {
        id: "org-2",
        useEvents: false,
        usePhishingBlocker: true,
      } as Organization;

      organizationService.organizations$.mockImplementation(() =>
        of([orgWithOnlyEvents, orgWithOnlyPhishingBlocker]),
      );

      fixture.detectChanges();
      const result = await fixture.componentInstance["getOrgsToNotify"]();

      expect(result).toEqual([]);
    });

    it("returns all orgs when all have useEvents and usePhishingBlocker", async () => {
      const orgs = [
        { id: "org-1", useEvents: true, usePhishingBlocker: true } as Organization,
        { id: "org-2", useEvents: true, usePhishingBlocker: true } as Organization,
      ];

      organizationService.organizations$.mockImplementation(() => of(orgs));

      fixture.detectChanges();
      const result = await fixture.componentInstance["getOrgsToNotify"]();

      expect(result).toEqual(orgs);
    });
  });
});
