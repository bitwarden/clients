import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom, Subject } from "rxjs";
import { filter } from "rxjs/operators";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { UserId } from "../../../types/guid";

import { PhishingDetectionSettingsService } from "./phishing-detection-settings.service";

describe("PhishingDetectionSettingsService", () => {
  // Mock services
  let mockAccountService: MockProxy<AccountService>;
  let mockBillingService: MockProxy<BillingAccountProfileStateService>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockOrganizationService: MockProxy<OrganizationService>;
  let mockPlatformService: MockProxy<PlatformUtilsService>;

  // RxJS Subjects we control in the tests
  let activeAccountSubject: BehaviorSubject<Account | null>;
  let featureFlagSubject: BehaviorSubject<boolean>;
  let premiumStatusSubject: BehaviorSubject<boolean>;
  let organizationsSubject: BehaviorSubject<Organization[]>;

  let service: PhishingDetectionSettingsService;
  let stateProvider: FakeStateProvider;

  // Constant mock data
  const familyOrg = mock<Organization>({
    canAccess: true,
    isMember: true,
    usersGetPremium: true,
    productTierType: ProductTierType.Families,
    usePhishingBlocker: true,
  });
  const teamOrg = mock<Organization>({
    canAccess: true,
    isMember: true,
    usersGetPremium: true,
    productTierType: ProductTierType.Teams,
    usePhishingBlocker: true,
  });
  const enterpriseOrg = mock<Organization>({
    canAccess: true,
    isMember: true,
    usersGetPremium: true,
    productTierType: ProductTierType.Enterprise,
    usePhishingBlocker: true,
  });

  const mockUserId = "mock-user-id" as UserId;
  const account = mock<Account>({ id: mockUserId });
  const accountService: FakeAccountService = mockAccountServiceWith(mockUserId);

  beforeEach(() => {
    // Initialize subjects
    activeAccountSubject = new BehaviorSubject<Account | null>(null);
    featureFlagSubject = new BehaviorSubject<boolean>(false);
    premiumStatusSubject = new BehaviorSubject<boolean>(false);
    organizationsSubject = new BehaviorSubject<Organization[]>([]);

    // Default implementations for required functions
    mockAccountService = mock<AccountService>();
    mockAccountService.activeAccount$ = activeAccountSubject.asObservable();

    mockBillingService = mock<BillingAccountProfileStateService>();
    mockBillingService.hasPremiumPersonally$.mockReturnValue(premiumStatusSubject.asObservable());

    mockConfigService = mock<ConfigService>();
    mockConfigService.getFeatureFlag$.mockReturnValue(featureFlagSubject.asObservable());

    mockOrganizationService = mock<OrganizationService>();
    mockOrganizationService.organizations$.mockReturnValue(organizationsSubject.asObservable());

    mockPlatformService = mock<PlatformUtilsService>();

    stateProvider = new FakeStateProvider(accountService);
    service = new PhishingDetectionSettingsService(
      mockAccountService,
      mockBillingService,
      mockConfigService,
      mockOrganizationService,
      mockPlatformService,
      stateProvider,
    );
  });

  // Helper to easily get the result of the observable we are testing
  const getAccess = () => firstValueFrom(service.available$);

  describe("enabled$", () => {
    it("should default to true if an account is logged in", async () => {
      activeAccountSubject.next(account);
      featureFlagSubject.next(true);
      premiumStatusSubject.next(true);
      organizationsSubject.next([]);
      const result = await firstValueFrom(service.enabled$);
      expect(result).toBe(true);
    });

    it("should return the stored value", async () => {
      activeAccountSubject.next(account);
      featureFlagSubject.next(true);
      premiumStatusSubject.next(true);
      organizationsSubject.next([]);

      // Wait for initial emission (startWith(true))
      await firstValueFrom(service.enabled$);

      await service.setEnabled(mockUserId, false);
      // Wait for the next emission after state update
      const resultDisabled = await firstValueFrom(
        service.enabled$.pipe(filter((v) => v === false)),
      );
      expect(resultDisabled).toBe(false);

      await service.setEnabled(mockUserId, true);
      // Wait for the next emission after state update
      const resultEnabled = await firstValueFrom(service.enabled$.pipe(filter((v) => v === true)));
      expect(resultEnabled).toBe(true);
    });
  });

  describe("setEnabled", () => {
    it("should update the stored value", async () => {
      activeAccountSubject.next(account);
      featureFlagSubject.next(true);
      premiumStatusSubject.next(true);
      organizationsSubject.next([]);

      // Wait for initial emission (startWith(true))
      await firstValueFrom(service.enabled$);

      await service.setEnabled(mockUserId, false);
      // Wait for the next emission after state update
      let result = await firstValueFrom(service.enabled$.pipe(filter((v) => v === false)));
      expect(result).toBe(false);

      await service.setEnabled(mockUserId, true);
      // Wait for the next emission after state update
      result = await firstValueFrom(service.enabled$.pipe(filter((v) => v === true)));
      expect(result).toBe(true);
    });
  });

  it("returns false immediately when the feature flag is disabled, regardless of other conditions", async () => {
    activeAccountSubject.next(account);
    premiumStatusSubject.next(true);
    organizationsSubject.next([familyOrg]);

    featureFlagSubject.next(false);

    await expect(getAccess()).resolves.toBe(false);
  });

  it("returns false if there is no active account present yet", async () => {
    activeAccountSubject.next(null); // No active account
    featureFlagSubject.next(true); // Flag is on

    await expect(getAccess()).resolves.toBe(false);
  });

  it("returns true when feature flag is enabled and user has premium personally", async () => {
    activeAccountSubject.next(account);
    featureFlagSubject.next(true);
    organizationsSubject.next([]);
    premiumStatusSubject.next(true);

    await expect(getAccess()).resolves.toBe(true);
  });

  it("returns true when feature flag is enabled and user is in a Family Organization", async () => {
    activeAccountSubject.next(account);
    featureFlagSubject.next(true);
    premiumStatusSubject.next(false); // User has no personal premium

    organizationsSubject.next([familyOrg]);

    await expect(getAccess()).resolves.toBe(true);
  });

  it("returns true when feature flag is enabled and user is in an Enterprise org with phishing blocker enabled", async () => {
    activeAccountSubject.next(account);
    featureFlagSubject.next(true);
    premiumStatusSubject.next(false);
    organizationsSubject.next([enterpriseOrg]);

    await expect(getAccess()).resolves.toBe(true);
  });

  it("returns false when user has no access through personal premium or organizations", async () => {
    activeAccountSubject.next(account);
    featureFlagSubject.next(true);
    premiumStatusSubject.next(false);
    organizationsSubject.next([teamOrg]); // Team org does not give access

    await expect(getAccess()).resolves.toBe(false);
  });

  it("shares/caches the available$ result between multiple subscribers", async () => {
    // Use a plain Subject for this test so we control when the premium observable emits
    // and avoid the BehaviorSubject's initial emission which can race with subscriptions.
    // Provide the Subject directly as the mock return value for the billing service
    const oneTimePremium = new Subject<boolean>();
    mockBillingService.hasPremiumPersonally$.mockReturnValueOnce(oneTimePremium.asObservable());

    activeAccountSubject.next(account);
    featureFlagSubject.next(true);
    organizationsSubject.next([]);

    const p1 = firstValueFrom(service.available$);
    const p2 = firstValueFrom(service.available$);

    // Trigger the pipeline
    oneTimePremium.next(true);

    const [first, second] = await Promise.all([p1, p2]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    // The billing function should have been called at most once due to caching
    expect(mockBillingService.hasPremiumPersonally$).toHaveBeenCalledTimes(1);
  });
});
