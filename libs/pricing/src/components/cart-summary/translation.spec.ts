import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { PlanTier, PurchasableReference } from "../../types/invoice-preview";

import { InvoicePreviewFlowContext } from "./invoice-preview-flow-context";
import { getCartItemTranslationKey, getCreditTranslationKey } from "./translation";

describe("getCartItemTranslationKey", () => {
  let logService: LogService;

  beforeEach(() => {
    logService = mock<LogService>();
  });

  /**
   * Transcribed verbatim from the tech breakdown's reference-to-translation-key fan-out table.
   */
  const fanOut: Array<[PurchasableReference, InvoicePreviewFlowContext, PlanTier, string]> = [
    ["pm-seat", InvoicePreviewFlowContext.PremiumSubscriptionPage, "premium", "premiumMembership"],
    ["pm-seat", InvoicePreviewFlowContext.PersonalCheckout, "premium", "premiumMembership"],
    ["pm-seat", InvoicePreviewFlowContext.PersonalCheckout, "families", "familiesMembership"],
    ["pm-seat", InvoicePreviewFlowContext.PremiumOrgUpgrade, "families", "familiesMembership"],
    ["pm-seat", InvoicePreviewFlowContext.PremiumOrgUpgrade, "teams", "teamsMembership"],
    ["pm-seat", InvoicePreviewFlowContext.PremiumOrgUpgrade, "enterprise", "enterpriseMembership"],
    [
      "pm-seat",
      InvoicePreviewFlowContext.OrganizationCheckout,
      "families",
      "passwordManagerPlanPrice",
    ],
    [
      "pm-seat",
      InvoicePreviewFlowContext.OrganizationCheckout,
      "teams",
      "passwordManagerPlanPrice",
    ],
    [
      "pm-seat",
      InvoicePreviewFlowContext.OrganizationCheckout,
      "enterprise",
      "passwordManagerPlanPrice",
    ],
    [
      "pm-seat",
      InvoicePreviewFlowContext.OrganizationSubscriptionPage,
      "families",
      "passwordManagerPlanPrice",
    ],
    [
      "pm-seat",
      InvoicePreviewFlowContext.OrganizationSubscriptionPage,
      "teams",
      "passwordManagerPlanPrice",
    ],
    [
      "pm-seat",
      InvoicePreviewFlowContext.OrganizationSubscriptionPage,
      "enterprise",
      "passwordManagerPlanPrice",
    ],
    // Plan-change follows the other org-scoped surfaces; rationale in translation.ts.
    [
      "pm-seat",
      InvoicePreviewFlowContext.OrganizationPlanChange,
      "families",
      "passwordManagerPlanPrice",
    ],
    [
      "pm-seat",
      InvoicePreviewFlowContext.OrganizationPlanChange,
      "teams",
      "passwordManagerPlanPrice",
    ],
    [
      "pm-seat",
      InvoicePreviewFlowContext.OrganizationPlanChange,
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

  const allFlowContexts = Object.values(InvoicePreviewFlowContext);
  const allTiers: PlanTier[] = ["families", "teams", "enterprise", "premium"];

  const tierAgnostic: Array<[PurchasableReference, string]> = [
    ["pm-storage", "additionalStorageGb"],
    ["sm-seat", "secretsManagerPlanPrice"],
    ["sm-service-account", "additionalServiceAccounts"],
  ];

  describe.each(tierAgnostic)("%s", (reference, expected) => {
    const combinations = allFlowContexts.flatMap((flowContext) =>
      allTiers.map((planTier): [InvoicePreviewFlowContext, PlanTier] => [flowContext, planTier]),
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
    const unmapped: Array<[InvoicePreviewFlowContext, PlanTier]> = [
      [InvoicePreviewFlowContext.OrganizationCheckout, "premium"],
      [InvoicePreviewFlowContext.OrganizationSubscriptionPage, "premium"],
      [InvoicePreviewFlowContext.PremiumSubscriptionPage, "teams"],
      [InvoicePreviewFlowContext.PersonalCheckout, "enterprise"],
      [InvoicePreviewFlowContext.PremiumOrgUpgrade, "premium"],
      [InvoicePreviewFlowContext.OrganizationPlanChange, "premium"],
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
          InvoicePreviewFlowContext.OrganizationCheckout,
          logService,
        ),
      ).not.toThrow();
      expect(
        getCartItemTranslationKey(
          outOfUnion,
          "teams",
          InvoicePreviewFlowContext.OrganizationCheckout,
          logService,
        ),
      ).toBe("");
      expect(logService.error).toHaveBeenCalled();
    });
  });
});

describe("getCreditTranslationKey", () => {
  it("should map premium-org-upgrade to premiumSubscriptionCredit", () => {
    expect(getCreditTranslationKey(InvoicePreviewFlowContext.PremiumOrgUpgrade)).toBe(
      "premiumSubscriptionCredit",
    );
  });

  it("should map organization-plan-change to appliedSubscriptionCredits", () => {
    expect(getCreditTranslationKey(InvoicePreviewFlowContext.OrganizationPlanChange)).toBe(
      "appliedSubscriptionCredits",
    );
  });

  const noCreditContexts = [
    InvoicePreviewFlowContext.PremiumSubscriptionPage,
    InvoicePreviewFlowContext.PersonalCheckout,
    InvoicePreviewFlowContext.OrganizationCheckout,
    InvoicePreviewFlowContext.OrganizationSubscriptionPage,
  ];

  it.each(noCreditContexts)("should return undefined for %s", (flowContext) => {
    expect(getCreditTranslationKey(flowContext)).toBeUndefined();
  });
});

/**
 * The guard asserting every key returned here exists in the web client's `messages.json` lives in
 * `apps/web/src/app/billing/invoice-preview-translation-keys.spec.ts`. It cannot live in this file:
 * `libs/` must not import app-specific code, and the locale file belongs to the web app.
 */
