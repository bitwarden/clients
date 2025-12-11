import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/user-core";

import { PhishingDetectionAvailabilityService } from "./phishing-detection-availability.service";

describe("PhishingDetectionAvailabilityService", () => {
  // Mock services
  let mockAccountService: MockProxy<AccountService>;
  let mockBillingService: MockProxy<BillingAccountProfileStateService>;
  let mockConfigService: MockProxy<ConfigService>;
  let mockOrganizationService: MockProxy<OrganizationService>;
  let service: PhishingDetectionAvailabilityService;

  // Constant mock data
  const account = mock<Account>({ id: "user-1" as UserId });
  const validOrganization = mock<Organization>({
    canAccess: true,
    isMember: true,
    usersGetPremium: true,
    productTierType: ProductTierType.Families,
    usePhishingBlocker: true,
  });

  // RxJS Subjects we control in the tests
  let activeAccountSubject: BehaviorSubject<Account | null>;
  let featureFlagSubject: BehaviorSubject<boolean>;
  let premiumStatusSubject: BehaviorSubject<boolean>;
  let organizationsSubject: BehaviorSubject<Organization[]>;

  beforeEach(() => {
    // Initialize new BehaviorSubjects before each test runs
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

    // New instance of service under test
    service = new PhishingDetectionAvailabilityService(
      mockAccountService,
      mockBillingService,
      mockConfigService,
      mockOrganizationService,
    );
  });

  // Helper to easily get the result of the observable we are testing
  const getAccess = () => firstValueFrom(service.activeAccountHasAccess$());

  it("returns false immediately when the feature flag is disabled, regardless of other conditions", async () => {
    activeAccountSubject.next(account);
    premiumStatusSubject.next(true);
    organizationsSubject.next([validOrganization]);

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

    organizationsSubject.next([validOrganization]);

    await expect(getAccess()).resolves.toBe(true);
  });
});
