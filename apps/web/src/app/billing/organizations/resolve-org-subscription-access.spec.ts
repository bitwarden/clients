import { OrganizationUserType, ProviderType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";

import {
  OrgSubscriptionAccess,
  resolveOrgSubscriptionAccess,
} from "./resolve-org-subscription-access";

describe("resolveOrgSubscriptionAccess", () => {
  describe("showSubscription", () => {
    it("returns true for an independent organization owner", () => {
      const org = createOrganization({
        isOwner: true,
        hasProvider: false,
      });

      expect(resolveOrgSubscriptionAccess(org).showSubscription).toBe(true);
    });

    it("returns false for a resold organization owner", () => {
      const org = createOrganization({
        isOwner: true,
        hasReseller: true,
      });

      expect(resolveOrgSubscriptionAccess(org).showSubscription).toBe(false);
    });

    it("returns false for a resold organization provider user", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasReseller: true,
      });

      expect(resolveOrgSubscriptionAccess(org).showSubscription).toBe(false);
    });

    it("returns false for an MSP provider user", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        hasBillableProvider: false,
      });

      expect(resolveOrgSubscriptionAccess(org).showSubscription).toBe(false);
    });

    it("returns false for a non-owner member", () => {
      const org = createOrganization({
        type: OrganizationUserType.User,
        isProviderUser: false,
        hasProvider: false,
      });

      expect(resolveOrgSubscriptionAccess(org).showSubscription).toBe(false);
    });

    it("returns false for a member of an organization with a provider", () => {
      const org = createOrganization({
        type: OrganizationUserType.User,
        isProviderUser: false,
        hasProvider: true,
      });

      expect(resolveOrgSubscriptionAccess(org).showSubscription).toBe(false);
    });
  });

  describe("canEditSubscription", () => {
    it("returns true for an editor of a non-MSP-managed organization", () => {
      const org = createOrganization({ isOwner: true, hasProvider: false });

      expect(resolveOrgSubscriptionAccess(org).canEditSubscription).toBe(true);
    });

    it("returns false for a member who cannot edit the subscription", () => {
      const org = createOrganization({ type: OrganizationUserType.User, hasProvider: false });

      expect(resolveOrgSubscriptionAccess(org).canEditSubscription).toBe(false);
    });

    it("returns false for a billable-MSP provider user even though they can edit", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        hasBillableProvider: true,
      });

      expect(resolveOrgSubscriptionAccess(org).canEditSubscription).toBe(false);
    });
  });

  describe("showSelfHost", () => {
    it("returns true for owner when organization can export self-hosted license", () => {
      const org = createOrganization({
        isOwner: true,
        hasProvider: false,
        selfHost: true,
      });

      expect(resolveOrgSubscriptionAccess(org).showSelfHost).toBe(true);
    });

    it("returns false for owner when organization cannot export self-hosted license", () => {
      const org = createOrganization({
        isOwner: true,
        hasProvider: false,
        selfHost: false,
      });

      expect(resolveOrgSubscriptionAccess(org).showSelfHost).toBe(false);
    });

    it("returns true for provider user when organization can export self-hosted license", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        selfHost: true,
      });

      expect(resolveOrgSubscriptionAccess(org).showSelfHost).toBe(true);
    });

    it("returns false for provider user when organization cannot export self-hosted license", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        selfHost: false,
      });

      expect(resolveOrgSubscriptionAccess(org).showSelfHost).toBe(false);
    });

    it("tracks the organization's self-host flag regardless of role", () => {
      const org = createOrganization({
        type: OrganizationUserType.User,
        isProviderUser: false,
        hasProvider: false,
        selfHost: true,
      });

      expect(resolveOrgSubscriptionAccess(org).showSelfHost).toBe(true);
    });
  });

  describe("canUseBillingSync", () => {
    it("returns true for an Enterprise organization", () => {
      const org = createOrganization({ productTierType: ProductTierType.Enterprise });

      expect(resolveOrgSubscriptionAccess(org).canUseBillingSync).toBe(true);
    });

    it("returns false for a non-Enterprise organization", () => {
      const org = createOrganization({ productTierType: ProductTierType.Teams });

      expect(resolveOrgSubscriptionAccess(org).canUseBillingSync).toBe(false);
    });
  });

  describe("showProviderManagedBilling", () => {
    it("returns false for a resold organization owner", () => {
      const org = createOrganization({ isOwner: true, hasReseller: true });

      expect(resolveOrgSubscriptionAccess(org).showProviderManagedBilling).toBe(false);
    });

    it("returns false for a non-billable provider user", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        hasBillableProvider: false,
      });

      expect(resolveOrgSubscriptionAccess(org).showProviderManagedBilling).toBe(false);
    });

    it("returns true for a billable-MSP provider user", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        hasBillableProvider: true,
      });

      expect(resolveOrgSubscriptionAccess(org).showProviderManagedBilling).toBe(true);
    });

    it("returns false for an independent owner whose subscription is visible", () => {
      const org = createOrganization({ isOwner: true, hasProvider: false });

      expect(resolveOrgSubscriptionAccess(org).showProviderManagedBilling).toBe(false);
    });

    it("returns false for an independent member without a provider", () => {
      const org = createOrganization({ type: OrganizationUserType.User, hasProvider: false });

      expect(resolveOrgSubscriptionAccess(org).showProviderManagedBilling).toBe(false);
    });
  });

  describe("showSubscriptionStatus", () => {
    it("returns true for an independent organization owner", () => {
      const org = createOrganization({ isOwner: true, hasProvider: false });

      expect(resolveOrgSubscriptionAccess(org).showSubscriptionStatus).toBe(true);
    });

    it("returns true for the owner of a resold organization", () => {
      const org = createOrganization({ isOwner: true, hasReseller: true });

      expect(resolveOrgSubscriptionAccess(org).showSubscriptionStatus).toBe(true);
    });

    it("returns true for a provider user of a resold organization", () => {
      const org = createOrganization({ isProviderUser: true, hasReseller: true });

      expect(resolveOrgSubscriptionAccess(org).showSubscriptionStatus).toBe(true);
    });

    it("returns false for a non-owner member of a resold organization", () => {
      const org = createOrganization({ type: OrganizationUserType.User, hasReseller: true });

      expect(resolveOrgSubscriptionAccess(org).showSubscriptionStatus).toBe(false);
    });

    it("returns false for a billable-MSP provider user", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        hasBillableProvider: true,
      });

      expect(resolveOrgSubscriptionAccess(org).showSubscriptionStatus).toBe(false);
    });

    it("returns false for a regular member", () => {
      const org = createOrganization({ type: OrganizationUserType.User, hasProvider: false });

      expect(resolveOrgSubscriptionAccess(org).showSubscriptionStatus).toBe(false);
    });
  });

  describe("isFreeOrg", () => {
    it("returns true for a free organization", () => {
      const org = createOrganization({ isOwner: true, isFreeOrg: true });

      expect(resolveOrgSubscriptionAccess(org).isFreeOrg).toBe(true);
    });

    it("returns false for a paid organization", () => {
      const org = createOrganization({ isOwner: true, isFreeOrg: false });

      expect(resolveOrgSubscriptionAccess(org).isFreeOrg).toBe(false);
    });
  });

  describe("visibility combinations", () => {
    it("independent owner with self-hosted export enabled", () => {
      const org = createOrganization({
        isOwner: true,
        hasProvider: false,
        selfHost: true,
      });

      const result: OrgSubscriptionAccess = resolveOrgSubscriptionAccess(org);

      expect(result).toEqual({
        showSubscription: true,
        showSubscriptionStatus: true,
        canEditSubscription: true,
        showSelfHost: true,
        isFreeOrg: false,
        canUseBillingSync: false,
        showProviderManagedBilling: false,
      });
    });

    it("resold organization owner sees the status without the provider-managed section", () => {
      const org = createOrganization({
        isOwner: true,
        hasReseller: true,
        selfHost: true,
      });

      const result: OrgSubscriptionAccess = resolveOrgSubscriptionAccess(org);

      expect(result).toEqual({
        showSubscription: false,
        showSubscriptionStatus: true,
        canEditSubscription: false,
        showSelfHost: true,
        isFreeOrg: false,
        canUseBillingSync: false,
        showProviderManagedBilling: false,
      });
    });

    it("non-billable provider user sees the empty provider state without edit actions", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        hasBillableProvider: false,
        selfHost: false,
      });

      const result: OrgSubscriptionAccess = resolveOrgSubscriptionAccess(org);

      expect(result).toEqual({
        showSubscription: false,
        showSubscriptionStatus: false,
        canEditSubscription: false,
        showSelfHost: false,
        isFreeOrg: false,
        canUseBillingSync: false,
        showProviderManagedBilling: false,
      });
    });

    it("billable MSP provider user sees only the provider portal", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        hasBillableProvider: true,
        selfHost: true,
      });

      const result: OrgSubscriptionAccess = resolveOrgSubscriptionAccess(org);

      expect(result).toEqual({
        showSubscription: false,
        showSubscriptionStatus: false,
        canEditSubscription: false,
        showSelfHost: true,
        isFreeOrg: false,
        canUseBillingSync: false,
        showProviderManagedBilling: true,
      });
    });

    it("regular member has minimal access", () => {
      const org = createOrganization({
        type: OrganizationUserType.User,
        isProviderUser: false,
        hasProvider: false,
        selfHost: false,
      });

      const result: OrgSubscriptionAccess = resolveOrgSubscriptionAccess(org);

      expect(result).toEqual({
        showSubscription: false,
        showSubscriptionStatus: false,
        canEditSubscription: false,
        showSelfHost: false,
        isFreeOrg: false,
        canUseBillingSync: false,
        showProviderManagedBilling: false,
      });
    });

    it("enterprise independent owner can use billing sync", () => {
      const org = createOrganization({
        isOwner: true,
        hasProvider: false,
        productTierType: ProductTierType.Enterprise,
      });

      const result: OrgSubscriptionAccess = resolveOrgSubscriptionAccess(org);

      expect(result).toEqual({
        showSubscription: true,
        showSubscriptionStatus: true,
        canEditSubscription: true,
        showSelfHost: false,
        isFreeOrg: false,
        canUseBillingSync: true,
        showProviderManagedBilling: false,
      });
    });
  });
});

/**
 * Test helper to create an Organization with specified properties.
 * Maps test properties to underlying Organization fields since many properties are computed getters.
 */
function createOrganization(
  config: {
    type?: OrganizationUserType;
    isProviderUser?: boolean;
    isMember?: boolean;
    productTierType?: ProductTierType;
    selfHost?: boolean;
    providerId?: string;
    providerName?: string;
    providerType?: ProviderType;
    isOwner?: boolean;
    hasProvider?: boolean;
    hasBillableProvider?: boolean;
    hasReseller?: boolean;
    isFreeOrg?: boolean;
  } = {},
): Organization {
  const org = new Organization();

  // Set raw properties
  org.id = "test-org-id" as any;
  org.name = "Test Organization";
  org.type = config.type ?? OrganizationUserType.User;
  org.isProviderUser = config.isProviderUser ?? false;
  org.isMember = config.isMember ?? true;
  org.productTierType = config.productTierType ?? ProductTierType.Teams;
  org.selfHost = config.selfHost ?? false;
  // `isFreeOrg` is a getter (`!useTotp`), so drive it through its backing flag. Default to a paid
  // org so existing tests keep asserting the non-free path.
  org.useTotp = !(config.isFreeOrg ?? false);

  // Set provider properties to drive hasProvider, hasBillableProvider, hasReseller
  const needsProvider = config.hasProvider || config.hasBillableProvider || config.hasReseller;
  if (needsProvider) {
    org.providerId = config.providerId ?? "provider-id";
    org.providerName = config.providerName ?? "Provider";
  } else {
    org.providerId = config.providerId ?? undefined;
    org.providerName = config.providerName ?? undefined;
  }

  // Set provider type to drive hasBillableProvider/hasReseller
  if (config.hasBillableProvider) {
    org.providerType = config.providerType ?? ProviderType.Msp;
  } else if (config.hasReseller) {
    org.providerType = ProviderType.Reseller;
  } else {
    org.providerType = config.providerType;
  }

  // If isOwner is specified directly, set type accordingly
  if (config.isOwner && !config.isProviderUser) {
    org.type = OrganizationUserType.Owner;
  }

  // Set permissions to null (required by Organization)
  org.permissions = null as any;

  return org;
}
