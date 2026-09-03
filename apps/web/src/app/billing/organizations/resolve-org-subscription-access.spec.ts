import { OrganizationUserType, ProviderType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";

import { resolveOrgSubscriptionAccess } from "./resolve-org-subscription-access";

describe("resolveOrgSubscriptionAccess", () => {
  describe("showSubscription", () => {
    it("returns true for independent organization owner", () => {
      const org = createOrganization({
        isOwner: true,
        hasProvider: false,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result.showSubscription).toBe(true);
    });

    it("returns true for resold organization owner", () => {
      const org = createOrganization({
        isOwner: true,
        hasReseller: true,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result.showSubscription).toBe(true);
    });

    it("returns true for MSP provider user", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        hasBillableProvider: false,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result.showSubscription).toBe(true);
    });

    it("returns false for non-owner member", () => {
      const org = createOrganization({
        type: OrganizationUserType.User,
        isProviderUser: false,
        hasProvider: false,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result.showSubscription).toBe(false);
    });

    it("returns false for non-provider-user member with provider", () => {
      const org = createOrganization({
        type: OrganizationUserType.User,
        isProviderUser: false,
        hasProvider: true,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result.showSubscription).toBe(false);
    });
  });

  describe("showManagementActions", () => {
    it("returns true for an editor of a non-MSP-managed organization", () => {
      const org = createOrganization({ isOwner: true, hasProvider: false });

      expect(resolveOrgSubscriptionAccess(org).showManagementActions).toBe(true);
    });

    it("returns false for a member who cannot edit the subscription", () => {
      const org = createOrganization({ type: OrganizationUserType.User, hasProvider: false });

      expect(resolveOrgSubscriptionAccess(org).showManagementActions).toBe(false);
    });

    it("returns false for a billable-MSP provider user even though they can edit", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        hasBillableProvider: true,
      });

      expect(resolveOrgSubscriptionAccess(org).showManagementActions).toBe(false);
    });
  });

  describe("showSelfHost", () => {
    it("returns true for owner when organization can export self-hosted license", () => {
      const org = createOrganization({
        isOwner: true,
        hasProvider: false,
        selfHost: true,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result.showSelfHost).toBe(true);
    });

    it("returns false for owner when organization cannot export self-hosted license", () => {
      const org = createOrganization({
        isOwner: true,
        hasProvider: false,
        selfHost: false,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result.showSelfHost).toBe(false);
    });

    it("returns true for provider user when organization can export self-hosted license", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        selfHost: true,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result.showSelfHost).toBe(true);
    });

    it("returns false for provider user when organization cannot export self-hosted license", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        selfHost: false,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result.showSelfHost).toBe(false);
    });

    it("tracks the plan's self-host capability regardless of role", () => {
      const org = createOrganization({
        type: OrganizationUserType.User,
        isProviderUser: false,
        hasProvider: false,
        selfHost: true,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result.showSelfHost).toBe(true);
    });
  });

  describe("showConsolidatedBillingMsp", () => {
    it("returns true when organization has a provider", () => {
      const org = createOrganization({
        hasProvider: true,
        providerType: ProviderType.Msp,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result.showConsolidatedBillingMsp).toBe(true);
    });

    it("returns false when organization is independent", () => {
      const org = createOrganization({
        hasProvider: false,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result.showConsolidatedBillingMsp).toBe(false);
    });

    it("returns false when organization has a non-billable reseller provider", () => {
      const org = createOrganization({
        hasProvider: true,
        hasReseller: true,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result.showConsolidatedBillingMsp).toBe(false);
    });

    it("returns true when organization has billable provider", () => {
      const org = createOrganization({
        hasProvider: true,
        hasBillableProvider: true,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result.showConsolidatedBillingMsp).toBe(true);
    });
  });

  describe("visibility combinations", () => {
    it("independent owner with self-hosted export enabled", () => {
      const org = createOrganization({
        isOwner: true,
        hasProvider: false,
        selfHost: true,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result).toEqual({
        showSubscription: true,
        showManagementActions: true,
        showSelfHost: true,
        showConsolidatedBillingMsp: false,
        isFreeOrg: false,
      });
    });

    it("independent owner without self-hosted export", () => {
      const org = createOrganization({
        isOwner: true,
        hasProvider: false,
        selfHost: false,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result).toEqual({
        showSubscription: true,
        showManagementActions: true,
        showSelfHost: false,
        showConsolidatedBillingMsp: false,
        isFreeOrg: false,
      });
    });

    it("resold organization owner cannot edit billing", () => {
      const org = createOrganization({
        isOwner: true,
        hasReseller: true,
        selfHost: true,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result).toEqual({
        showSubscription: true,
        showManagementActions: false,
        showSelfHost: true,
        showConsolidatedBillingMsp: false,
        isFreeOrg: false,
      });
    });

    it("non-billable MSP provider user without self-hosted export", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        selfHost: false,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result).toEqual({
        showSubscription: true,
        showManagementActions: true,
        showSelfHost: false,
        showConsolidatedBillingMsp: false,
        isFreeOrg: false,
      });
    });

    it("billable MSP provider user with self-hosted export enabled", () => {
      const org = createOrganization({
        isProviderUser: true,
        hasProvider: true,
        hasBillableProvider: true,
        selfHost: true,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result).toEqual({
        showSubscription: false,
        showManagementActions: false,
        showSelfHost: true,
        showConsolidatedBillingMsp: true,
        isFreeOrg: false,
      });
    });

    it("regular member has minimal access", () => {
      const org = createOrganization({
        type: OrganizationUserType.User,
        isProviderUser: false,
        hasProvider: false,
        selfHost: false,
      });

      const result = resolveOrgSubscriptionAccess(org);

      expect(result).toEqual({
        showSubscription: false,
        showManagementActions: false,
        showSelfHost: false,
        showConsolidatedBillingMsp: false,
        isFreeOrg: false,
      });
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
    canViewSubscription?: boolean;
    canEditSubscription?: boolean;
    canManageBilling?: boolean;
    hasSelfHost?: boolean;
    isProviderManaged?: boolean;
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
