import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  InvoicePreviewFlowContext,
  getCartItemTranslationKey,
  getCreditTranslationKey,
  PlanTier,
  PurchasableReference,
} from "@bitwarden/pricing";

// Namespace import: this workspace does not enable `esModuleInterop`, so a default import of a
// JSON module does not resolve to the whole document.
import * as messages from "../../locales/en/messages.json";

/**
 * Membership guard for the cart preview translation fan-out.
 *
 * `libs/pricing` owns the reference-to-key mapping but cannot assert those keys actually ship,
 * because libs must not import app-specific code. This test closes that gap from the app side:
 * every key the fan-out can return must exist in the web client's English locale, so a mapping
 * added without its copy fails here rather than rendering a raw key to a customer.
 */
describe("cart preview translation keys", () => {
  const logService = mock<LogService>();

  const allTiers: PlanTier[] = ["families", "teams", "enterprise", "premium"];
  const allReferences: PurchasableReference[] = [
    "pm-seat",
    "pm-storage",
    "sm-seat",
    "sm-service-account",
  ];

  const lineItemKeys = Object.values(InvoicePreviewFlowContext).flatMap((flowContext) =>
    allTiers.flatMap((planTier) =>
      allReferences.map((reference) =>
        getCartItemTranslationKey(reference, planTier, flowContext, logService),
      ),
    ),
  );

  const creditKeys = Object.values(InvoicePreviewFlowContext).map((flowContext) =>
    getCreditTranslationKey(flowContext),
  );

  // Unmapped combinations intentionally return "" and emit no row, so they carry no copy.
  const resolvedKeys = [...new Set([...lineItemKeys, ...creditKeys])].filter(
    (key): key is string => !!key,
  );

  const localeMessages = messages as Record<string, { message: string } | undefined>;

  it("should resolve exactly the documented fan-out and credit keys", () => {
    // Source of truth: the fan-out in libs/pricing/src/components/cart-summary/translation.ts —
    // a key added or removed there must move this list too. Note the set is deduplicated, so a
    // dropped mapping whose key other contexts still return won't change it; the per-combination
    // fan-out rows in translation.spec.ts catch that case.
    expect([...resolvedKeys].sort()).toEqual(
      [
        "premiumMembership",
        "familiesMembership",
        "teamsMembership",
        "enterpriseMembership",
        "passwordManagerPlanPrice",
        "additionalStorageGb",
        "secretsManagerPlanPrice",
        "additionalServiceAccounts",
        "premiumSubscriptionCredit",
        "appliedSubscriptionCredits",
      ].sort(),
    );
  });

  it.each(resolvedKeys)("should have %s present in the en locale", (key) => {
    expect(localeMessages[key]).toBeDefined();
    expect(typeof localeMessages[key]!.message).toBe("string");
    expect(localeMessages[key]!.message.length).toBeGreaterThan(0);
  });
});
