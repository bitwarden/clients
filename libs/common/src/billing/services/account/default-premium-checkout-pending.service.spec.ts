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

  it("consumeCheckoutPending returns false by default", async () => {
    expect(await sut.consumeCheckoutPending(userId)).toBe(false);
  });

  it("markCheckoutLaunched makes the next consume return true", async () => {
    await sut.markCheckoutLaunched(userId);

    expect(await sut.consumeCheckoutPending(userId)).toBe(true);
  });

  it("consumeCheckoutPending clears the flag so a second consume returns false", async () => {
    await sut.markCheckoutLaunched(userId);

    expect(await sut.consumeCheckoutPending(userId)).toBe(true);
    expect(await sut.consumeCheckoutPending(userId)).toBe(false);
  });

  it("is scoped per user", async () => {
    const otherUserId = "user-2" as UserId;
    await sut.markCheckoutLaunched(userId);

    expect(await sut.consumeCheckoutPending(otherUserId)).toBe(false);
  });

  // The "no stale flag survives a restart" guarantee depends entirely on this being
  // memory-scoped. Pin it with code so flipping BILLING_MEMORY to disk fails here
  // rather than silently producing phantom syncs.
  it("is backed by memory-scoped state cleared on logout", () => {
    expect(PREMIUM_CHECKOUT_PENDING_KEY.stateDefinition.defaultStorageLocation).toBe("memory");
    expect(PREMIUM_CHECKOUT_PENDING_KEY.clearOn).toEqual(["logout"]);
  });
});
