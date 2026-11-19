import { FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { UserId } from "../../../types/guid";

import { DefaultPremiumCheckoutPendingService } from "./default-premium-checkout-pending.service";
import { PREMIUM_CHECKOUT_PENDING_KEY } from "./premium-checkout-pending.state";

describe("DefaultPremiumCheckoutPendingService", () => {
  const userId = "user-1" as UserId;
  let stateProvider: FakeStateProvider;
  let sut: DefaultPremiumCheckoutPendingService;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    sut = new DefaultPremiumCheckoutPendingService(stateProvider);
  });

  describe("getCheckoutPending", () => {
    it("returns null when no checkout is pending", async () => {
      expect(await sut.getCheckoutPending(userId)).toBeNull();
    });

    it("returns the feature context recorded at launch", async () => {
      await sut.markCheckoutLaunched(userId, { featureNameKey: "premiumFeature" });

      expect(await sut.getCheckoutPending(userId)).toEqual({ featureNameKey: "premiumFeature" });
    });

    it("returns an empty object when launched without context", async () => {
      await sut.markCheckoutLaunched(userId);

      expect(await sut.getCheckoutPending(userId)).toEqual({});
    });

    it("leaves the pending checkout in place across reads", async () => {
      await sut.markCheckoutLaunched(userId, { featureNameKey: "premiumFeature" });

      expect(await sut.getCheckoutPending(userId)).toEqual({ featureNameKey: "premiumFeature" });
      expect(await sut.getCheckoutPending(userId)).toEqual({ featureNameKey: "premiumFeature" });
    });
  });

  describe("clearCheckoutPending", () => {
    it("clears the pending checkout so the next read returns null", async () => {
      await sut.markCheckoutLaunched(userId, { featureNameKey: "premiumFeature" });

      await sut.clearCheckoutPending(userId);

      expect(await sut.getCheckoutPending(userId)).toBeNull();
    });
  });

  describe("consumeCheckoutPending", () => {
    it("returns null when no checkout is pending", async () => {
      expect(await sut.consumeCheckoutPending(userId)).toBeNull();
    });

    it("returns the pending checkout and clears it", async () => {
      await sut.markCheckoutLaunched(userId, { featureNameKey: "premiumFeature" });

      expect(await sut.consumeCheckoutPending(userId)).toEqual({
        featureNameKey: "premiumFeature",
      });
      expect(await sut.consumeCheckoutPending(userId)).toBeNull();
      expect(await sut.getCheckoutPending(userId)).toBeNull();
    });
  });

  it("is scoped per user", async () => {
    const otherUserId = "user-2" as UserId;
    await sut.markCheckoutLaunched(userId);

    expect(await sut.getCheckoutPending(otherUserId)).toBeNull();
  });

  // The "no stale flag survives a restart" guarantee depends entirely on this being
  // memory-scoped. Pin it with code so flipping BILLING_MEMORY to disk fails here
  // rather than silently producing phantom syncs.
  it("is backed by memory-scoped state cleared on logout", () => {
    expect(PREMIUM_CHECKOUT_PENDING_KEY.stateDefinition.defaultStorageLocation).toBe("memory");
    expect(PREMIUM_CHECKOUT_PENDING_KEY.clearOn).toEqual(["logout"]);
  });
});
