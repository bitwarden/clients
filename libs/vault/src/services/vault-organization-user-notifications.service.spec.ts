import { TestBed } from "@angular/core/testing";
import {
  FakeAccountService,
  mockAccountServiceWith,
} from "@bitwarden/common/../spec/fake-account-service";
import { FakeSingleUserState } from "@bitwarden/common/../spec/fake-state";
import { FakeStateProvider } from "@bitwarden/common/../spec/fake-state-provider";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of, ReplaySubject } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EventCollectionService, EventType } from "@bitwarden/common/dirt/event-logs";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { StateProvider } from "@bitwarden/common/platform/state";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import {
  NOTIFICATION_BANNER_DISMISSED_KEY,
  NOTIFICATION_BANNER_DISMISSED_SESSION_KEY,
  OrganizationUserNotificationBannerData,
  VaultOrganizationUserNotificationsService,
} from "./vault-organization-user-notifications.service";

const mockUserId = Utils.newGuid() as UserId;
const mockOrgId = Utils.newGuid() as OrganizationId;

function makePolicy(
  overrides: {
    enabled?: boolean;
    organizationId?: OrganizationId;
    revisionDate?: Date;
    data?: Partial<{
      header: string | null;
      description: string;
      buttonText: string | null;
      showAfterEveryLogin: boolean;
    }>;
  } = {},
): Policy {
  return {
    id: "policy-id",
    organizationId: overrides.organizationId ?? mockOrgId,
    type: PolicyType.OrganizationUserNotification,
    enabled: overrides.enabled ?? true,
    data: {
      header: "Test Header",
      description: "Test Description",
      buttonText: "Click Me",
      showAfterEveryLogin: false,
      ...overrides.data,
    },
    revisionDate: overrides.revisionDate ?? new Date("2024-01-01"),
  } as unknown as Policy;
}

describe("VaultOrganizationUserNotificationsService", () => {
  let service: VaultOrganizationUserNotificationsService;
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let policyService: MockProxy<PolicyService>;
  let configService: MockProxy<ConfigService>;
  let eventCollectionService: MockProxy<EventCollectionService>;

  let dismissedState: FakeSingleUserState<Date>;
  let dismissedSessionState: FakeSingleUserState<Date>;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);
    policyService = mock<PolicyService>();
    configService = mock<ConfigService>();
    eventCollectionService = mock<EventCollectionService>();

    TestBed.configureTestingModule({
      providers: [
        VaultOrganizationUserNotificationsService,
        { provide: AccountService, useValue: accountService },
        { provide: PolicyService, useValue: policyService },
        { provide: ConfigService, useValue: configService },
        { provide: StateProvider, useValue: stateProvider },
        { provide: EventCollectionService, useValue: eventCollectionService },
      ],
    });

    service = TestBed.inject(VaultOrganizationUserNotificationsService);

    dismissedState = stateProvider.singleUser.getFake(
      mockUserId,
      NOTIFICATION_BANNER_DISMISSED_KEY,
    );
    dismissedSessionState = stateProvider.singleUser.getFake(
      mockUserId,
      NOTIFICATION_BANNER_DISMISSED_SESSION_KEY,
    );
  });

  describe("notificationData$", () => {
    it("returns null when no policies exist", async () => {
      policyService.policiesByType$.mockReturnValue(of([]));

      const result = await firstValueFrom(service.notificationData$);

      expect(result).toBeNull();
    });

    it("returns null when policy is disabled", async () => {
      policyService.policiesByType$.mockReturnValue(of([makePolicy({ enabled: false })]));

      const result = await firstValueFrom(service.notificationData$);

      expect(result).toBeNull();
    });

    it("maps an enabled policy to notification banner data", async () => {
      policyService.policiesByType$.mockReturnValue(of([makePolicy()]));

      const result = await firstValueFrom(service.notificationData$);

      expect(result).toEqual({
        organizationId: mockOrgId,
        header: "Test Header",
        description: "Test Description",
        buttonText: "Click Me",
        showAfterEveryLogin: false,
        revisionDate: new Date("2024-01-01"),
      } satisfies OrganizationUserNotificationBannerData);
    });

    it("uses the policy with the latest revisionDate when multiple policies exist", async () => {
      const olderOrgId = Utils.newGuid() as OrganizationId;
      policyService.policiesByType$.mockReturnValue(
        of([
          makePolicy({ organizationId: olderOrgId, revisionDate: new Date("2023-01-01") }),
          makePolicy({ organizationId: mockOrgId, revisionDate: new Date("2024-01-01") }),
        ]),
      );

      const result = await firstValueFrom(service.notificationData$);

      expect(result?.organizationId).toBe(mockOrgId);
    });

    it("does not re-emit when consecutive policy emissions produce identical notification data", async () => {
      const policiesSubject = new ReplaySubject<Policy[]>(1);
      policyService.policiesByType$.mockReturnValue(policiesSubject.asObservable());

      const emissions: (OrganizationUserNotificationBannerData | null)[] = [];
      const sub = service.notificationData$.subscribe((v) => emissions.push(v));

      policiesSubject.next([makePolicy()]);
      policiesSubject.next([makePolicy()]);

      sub.unsubscribe();

      expect(emissions).toHaveLength(1);
    });

    it("re-emits when policy data changes", async () => {
      const policiesSubject = new ReplaySubject<Policy[]>(1);
      policyService.policiesByType$.mockReturnValue(policiesSubject.asObservable());

      const emissions: (OrganizationUserNotificationBannerData | null)[] = [];
      const sub = service.notificationData$.subscribe((v) => emissions.push(v));

      policiesSubject.next([makePolicy({ revisionDate: new Date("2024-01-01") })]);
      policiesSubject.next([makePolicy({ revisionDate: new Date("2024-06-01") })]);

      sub.unsubscribe();

      expect(emissions).toHaveLength(2);
    });
  });

  describe("showNotificationBanner$", () => {
    beforeEach(() => {
      policyService.policiesByType$.mockReturnValue(of([makePolicy()]));
      configService.getFeatureFlag$.mockReturnValue(of(true));
    });

    it("returns false when the feature flag is disabled", async () => {
      configService.getFeatureFlag$.mockReturnValue(of(false));

      const result = await firstValueFrom(service.showNotificationBanner$);

      expect(result).toBe(false);
    });

    it("returns false when there is no notification data", async () => {
      policyService.policiesByType$.mockReturnValue(of([]));

      const result = await firstValueFrom(service.showNotificationBanner$);

      expect(result).toBe(false);
    });

    it("returns true when the banner has never been dismissed", async () => {
      // state starts as null by default

      const result = await firstValueFrom(service.showNotificationBanner$);

      expect(result).toBe(true);
    });

    it("returns true when dismissed before the policy revision date", async () => {
      dismissedState.nextState(new Date("2023-01-01"));

      const result = await firstValueFrom(service.showNotificationBanner$);

      expect(result).toBe(true);
    });

    it("returns false when dismissed after revision date and showAfterEveryLogin is false", async () => {
      dismissedState.nextState(new Date("2025-01-01"));

      const result = await firstValueFrom(service.showNotificationBanner$);

      expect(result).toBe(false);
    });

    it("returns true when showAfterEveryLogin is true and not dismissed this session", async () => {
      policyService.policiesByType$.mockReturnValue(
        of([makePolicy({ data: { showAfterEveryLogin: true } })]),
      );
      dismissedState.nextState(new Date("2025-01-01"));
      // dismissedSessionState stays null

      const result = await firstValueFrom(service.showNotificationBanner$);

      expect(result).toBe(true);
    });

    it("returns false when showAfterEveryLogin is true but dismissed this session", async () => {
      policyService.policiesByType$.mockReturnValue(
        of([makePolicy({ data: { showAfterEveryLogin: true } })]),
      );
      dismissedState.nextState(new Date("2025-01-01"));
      dismissedSessionState.nextState(new Date("2025-01-01"));

      const result = await firstValueFrom(service.showNotificationBanner$);

      expect(result).toBe(false);
    });
  });

  describe("saveDismissalToState", () => {
    it("updates both dismissal and session dismissal state with the current date", async () => {
      jest.useFakeTimers();
      const fakeNow = new Date("2024-06-01T12:00:00Z");
      jest.setSystemTime(fakeNow);

      await service.saveDismissalToState();

      const dismissed = await firstValueFrom(dismissedState.state$);
      const dismissedSession = await firstValueFrom(dismissedSessionState.state$);

      expect(dismissed?.getTime()).toBe(fakeNow.getTime());
      expect(dismissedSession?.getTime()).toBe(fakeNow.getTime());

      jest.useRealTimers();
    });
  });

  describe("recordActionButtonClick", () => {
    it("collects a notification banner action event attributed to the organization", async () => {
      await service.recordActionButtonClick(mockOrgId);

      expect(eventCollectionService.collect).toHaveBeenCalledWith(
        EventType.OrganizationUser_NotificationBannerActionClicked,
        undefined,
        false,
        mockOrgId,
      );
    });

    it("also saves dismissal state so the banner does not reappear", async () => {
      jest.useFakeTimers();
      const fakeNow = new Date("2024-06-01T12:00:00Z");
      jest.setSystemTime(fakeNow);

      await service.recordActionButtonClick(mockOrgId);

      const dismissed = await firstValueFrom(dismissedState.state$);
      const dismissedSession = await firstValueFrom(dismissedSessionState.state$);

      expect(dismissed?.getTime()).toBe(fakeNow.getTime());
      expect(dismissedSession?.getTime()).toBe(fakeNow.getTime());

      jest.useRealTimers();
    });
  });
});
