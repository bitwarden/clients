import { firstValueFrom } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { LEASED_CIPHERS, liveLeases$ } from "./leased-cipher.state";
import { at, leaseEntry, NOW, seedLeases } from "./leased-cipher.state.spec-util";

describe("LEASED_CIPHERS", () => {
  it("lives in session memory state, never in large-object or disk storage", () => {
    const definition = LEASED_CIPHERS.stateDefinition;

    expect(definition.defaultStorageLocation).toBe("memory");
    expect(definition.storageLocationOverrides).toEqual({});
  });

  it("clears on lock and logout", () => {
    expect(LEASED_CIPHERS.clearOn).toEqual(["lock", "logout"]);
  });
});

describe("liveLeases$", () => {
  const userId = "user-id" as UserId;

  let stateProvider: FakeStateProvider;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("emits only copies whose lease is still live", async () => {
    await seedLeases(stateProvider, userId, [
      leaseEntry("live", at(60_000)),
      leaseEntry("lapsed", at(-1)),
      leaseEntry("garbled", "not-a-date"),
    ]);

    const live = await firstValueFrom(liveLeases$(stateProvider, userId));

    expect(Object.keys(live)).toEqual(["live"]);
  });

  it("emits no copies when there is no state", async () => {
    const live = await firstValueFrom(liveLeases$(stateProvider, userId));

    expect(live).toEqual({});
  });

  it("re-emits without the copy once its lease lapses", async () => {
    await seedLeases(stateProvider, userId, [
      leaseEntry("first", at(60_000)),
      leaseEntry("second", at(120_000)),
    ]);
    const emissions: string[][] = [];

    const subscription = liveLeases$(stateProvider, userId).subscribe((live) =>
      emissions.push(Object.keys(live)),
    );
    jest.advanceTimersByTime(60_000);
    jest.advanceTimersByTime(60_000);
    subscription.unsubscribe();

    expect(emissions).toEqual([["first", "second"], ["second"], []]);
  });

  it("does not re-emit for a refresh that changes no copy", async () => {
    await seedLeases(stateProvider, userId, [leaseEntry("live", at(60_000))]);
    let emissions = 0;

    const subscription = liveLeases$(stateProvider, userId).subscribe(() => emissions++);
    await seedLeases(stateProvider, userId, [leaseEntry("live", at(60_000))], NOW + 1);
    subscription.unsubscribe();

    expect(emissions).toBe(1);
  });
});
