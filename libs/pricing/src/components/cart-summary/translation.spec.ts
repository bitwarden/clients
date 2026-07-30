import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { PlanTier, PurchasableReference } from "../../types/cart-preview";

import { CartPreviewFlowContext } from "./cart-preview-flow-context";
import { getCartItemTranslationKey, getCreditTranslationKey } from "./translation";

describe("getCartItemTranslationKey", () => {
  let logService: LogService;

  beforeEach(() => {
    logService = mock<LogService>();
  });

  /**
   * Transcribed verbatim from the tech breakdown's reference-to-translation-key fan-out table.
   */
  const fanOut: Array<[PurchasableReference, CartPreviewFlowContext, PlanTier, string]> = [
    ["pm-seat", CartPreviewFlowContext.PremiumSubscriptionPage, "premium", "premiumMembership"],
    ["pm-seat", CartPreviewFlowContext.PersonalCheckout, "premium", "premiumMembership"],
    ["pm-seat", CartPreviewFlowContext.PersonalCheckout, "families", "familiesMembership"],
    ["pm-seat", CartPreviewFlowContext.PremiumOrgUpgrade, "families", "familiesMembership"],
    ["pm-seat", CartPreviewFlowContext.PremiumOrgUpgrade, "teams", "teamsMembership"],
    ["pm-seat", CartPreviewFlowContext.PremiumOrgUpgrade, "enterprise", "enterpriseMembership"],
    [
      "pm-seat",
      CartPreviewFlowContext.OrganizationCheckout,
      "families",
      "passwordManagerPlanPrice",
    ],
    ["pm-seat", CartPreviewFlowContext.OrganizationCheckout, "teams", "passwordManagerPlanPrice"],
    [
      "pm-seat",
      CartPreviewFlowContext.OrganizationCheckout,
      "enterprise",
      "passwordManagerPlanPrice",
    ],
    [
      "pm-seat",
      CartPreviewFlowContext.OrganizationSubscriptionPage,
      "families",
      "passwordManagerPlanPrice",
    ],
    [
      "pm-seat",
      CartPreviewFlowContext.OrganizationSubscriptionPage,
      "teams",
      "passwordManagerPlanPrice",
    ],
    [
      "pm-seat",
      CartPreviewFlowContext.OrganizationSubscriptionPage,
      "enterprise",
      "passwordManagerPlanPrice",
    ],
  ];

  it.each(fanOut)(
    "should map %s in %s for the %s tier to %s",
    (reference, flowContext, planTier, expected) => {
      expect(getCartItemTranslationKey(reference, planTier, flowContext, logService)).toBe(
        expected,
      );
      expect(logService.error).not.toHaveBeenCalled();
    },
  );

  const allFlowContexts = Object.values(CartPreviewFlowContext);
  const allTiers: PlanTier[] = ["families", "teams", "enterprise", "premium"];

  const tierAgnostic: Array<[PurchasableReference, string]> = [
    ["pm-storage", "additionalStorageGb"],
    ["sm-seat", "secretsManagerPlanPrice"],
    ["sm-service-account", "additionalServiceAccounts"],
  ];

  describe.each(tierAgnostic)("%s", (reference, expected) => {
    const combinations = allFlowContexts.flatMap((flowContext) =>
      allTiers.map((planTier): [CartPreviewFlowContext, PlanTier] => [flowContext, planTier]),
    );

    it.each(combinations)(
      `should map to ${expected} for every flow context and tier (%s / %s)`,
      (flowContext, planTier) => {
        expect(getCartItemTranslationKey(reference, planTier, flowContext, logService)).toBe(
          expected,
        );
        expect(logService.error).not.toHaveBeenCalled();
      },
    );
  });

  describe("combinations absent from the fan-out table", () => {
    // The table is intentionally partial: these combinations are legal to the type system but
    // cannot occur in practice, so they log and return "" rather than inventing a key.
    const unmapped: Array<[CartPreviewFlowContext, PlanTier]> = [
      [CartPreviewFlowContext.OrganizationCheckout, "premium"],
      [CartPreviewFlowContext.OrganizationSubscriptionPage, "premium"],
      [CartPreviewFlowContext.PremiumSubscriptionPage, "teams"],
      [CartPreviewFlowContext.PersonalCheckout, "enterprise"],
      [CartPreviewFlowContext.PremiumOrgUpgrade, "premium"],
      [CartPreviewFlowContext.OrganizationPlanChange, "teams"],
    ];

    it.each(unmapped)(
      "should log and return an empty string for pm-seat in %s for the %s tier",
      (flowContext, planTier) => {
        expect(getCartItemTranslationKey("pm-seat", planTier, flowContext, logService)).toBe("");
        expect(logService.error).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe("defensive handling of out-of-union references", () => {
    it("should log and return an empty string rather than throwing", () => {
      const outOfUnion = "pm-unknown" as PurchasableReference;

      expect(() =>
        getCartItemTranslationKey(
          outOfUnion,
          "teams",
          CartPreviewFlowContext.OrganizationCheckout,
          logService,
        ),
      ).not.toThrow();
      expect(
        getCartItemTranslationKey(
          outOfUnion,
          "teams",
          CartPreviewFlowContext.OrganizationCheckout,
          logService,
        ),
      ).toBe("");
      expect(logService.error).toHaveBeenCalled();
    });
  });
});

describe("getCreditTranslationKey", () => {
  it("should map premium-org-upgrade to premiumSubscriptionCredit", () => {
    expect(getCreditTranslationKey(CartPreviewFlowContext.PremiumOrgUpgrade)).toBe(
      "premiumSubscriptionCredit",
    );
  });

  it("should map organization-plan-change to appliedSubscriptionCredits", () => {
    expect(getCreditTranslationKey(CartPreviewFlowContext.OrganizationPlanChange)).toBe(
      "appliedSubscriptionCredits",
    );
  });

  const noCreditContexts = [
    CartPreviewFlowContext.PremiumSubscriptionPage,
    CartPreviewFlowContext.PersonalCheckout,
    CartPreviewFlowContext.OrganizationCheckout,
    CartPreviewFlowContext.OrganizationSubscriptionPage,
  ];

  it.each(noCreditContexts)("should return undefined for %s", (flowContext) => {
    expect(getCreditTranslationKey(flowContext)).toBeUndefined();
  });
});

/**
 * The guard asserting every key returned here exists in the web client's `messages.json` lives in
 * `apps/web/src/app/billing/cart-preview-translation-keys.spec.ts`. It cannot live in this file:
 * `libs/` must not import app-specific code, and the locale file belongs to the web app.
 */
