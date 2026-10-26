import { ProductTierType, ProductType } from "@bitwarden/common/billing/enums";
import { DEFAULT_TRIAL_LENGTH_DAYS } from "@bitwarden/web-vault/app/billing/constants";

import { parseTrialInitiationParams } from "./trial-initiation-params";

describe("parseTrialInitiationParams", () => {
  describe("product", () => {
    it("resolves the primary product from the link", () => {
      expect(parseTrialInitiationParams({ product: `${ProductType.SecretsManager}` }).product).toBe(
        ProductType.SecretsManager,
      );
    });

    it("resolves the base product from a comma-separated list and flags the add-on", () => {
      const result = parseTrialInitiationParams({ product: "0,2" });

      expect(result.product).toBe(ProductType.PasswordManager);
      expect(result.privilegedControlsRequested).toBe(true);
    });

    it("defaults to Password Manager and no add-on when unrecognized or absent", () => {
      const unrecognized = parseTrialInitiationParams({ product: "99,nonsense" });
      expect(unrecognized.product).toBe(ProductType.PasswordManager);
      expect(unrecognized.privilegedControlsRequested).toBe(false);

      const absent = parseTrialInitiationParams({});
      expect(absent.product).toBe(ProductType.PasswordManager);
      expect(absent.privilegedControlsRequested).toBe(false);
    });

    it("defaults to Password Manager when only the add-on is listed", () => {
      expect(
        parseTrialInitiationParams({ product: `${ProductType.PrivilegedControls}` }).product,
      ).toBe(ProductType.PasswordManager);
    });

    it("uses the first base product listed when a link lists both", () => {
      expect(parseTrialInitiationParams({ product: "1,0" }).product).toBe(
        ProductType.SecretsManager,
      );
      expect(parseTrialInitiationParams({ product: "0,1" }).product).toBe(
        ProductType.PasswordManager,
      );
    });
  });

  describe("productTier", () => {
    it("parses the tier when present", () => {
      const result = parseTrialInitiationParams({ productTier: `${ProductTierType.Enterprise}` });

      expect(result.productTier).toBe(ProductTierType.Enterprise);
    });

    it("is undefined when missing or invalid", () => {
      expect(parseTrialInitiationParams({}).productTier).toBeUndefined();
      expect(parseTrialInitiationParams({ productTier: "nope" }).productTier).toBe(undefined);
    });
  });

  describe("other fields", () => {
    it("reads email only when it looks like an address", () => {
      expect(parseTrialInitiationParams({ email: "user@example.com" }).email).toBe(
        "user@example.com",
      );
      expect(parseTrialInitiationParams({ email: "not-an-email" }).email).toBeUndefined();
    });

    it("maps verification, sales-assisted, and sponsorship tokens", () => {
      const result = parseTrialInitiationParams({
        fromEmail: "true",
        token: "verify-token",
        salesAssistedToken: "sales-token",
        sponsorshipToken: "sponsor-token",
      });

      expect(result.emailVerified).toBe(true);
      expect(result.emailVerificationToken).toBe("verify-token");
      expect(result.salesAssistedToken).toBe("sales-token");
      expect(result.sponsorshipToken).toBe("sponsor-token");
    });

    it("defaults the trial length and preserves an explicit zero", () => {
      expect(parseTrialInitiationParams({}).trialLength).toBe(DEFAULT_TRIAL_LENGTH_DAYS);
      expect(parseTrialInitiationParams({ trialLength: "0" }).trialLength).toBe(0);
      expect(parseTrialInitiationParams({ trialLength: "14" }).trialLength).toBe(14);
    });

    it("treats paymentOptional as true only for the literal string", () => {
      expect(parseTrialInitiationParams({ paymentOptional: "true" }).paymentOptional).toBe(true);
      expect(parseTrialInitiationParams({ paymentOptional: "false" }).paymentOptional).toBe(false);
      expect(parseTrialInitiationParams({}).paymentOptional).toBe(false);
    });
  });
});
