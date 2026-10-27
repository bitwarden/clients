import { Subscription } from "rxjs";

import {
  FakeAccountService,
  FakeStateProvider,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { seedLeases } from "../leased-cipher.state.spec-util";

import { BrowserAccessEventService } from "./browser-access-event.service";

describe("BrowserAccessEventService", () => {
  const userId = "user-id" as UserId;
  const otherUserId = "other-user-id" as UserId;

  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  let service: BrowserAccessEventService;
  let subscription: Subscription | undefined;
  let ticks: number;

  const refresh = (refreshedAt: number, forUserId = userId) =>
    seedLeases(stateProvider, forUserId, [], refreshedAt);
  const listen = () => {
    subscription = service.accessChanged$().subscribe(() => ticks++);
  };

  beforeEach(() => {
    ticks = 0;
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    service = new BrowserAccessEventService(stateProvider, accountService);
  });

  afterEach(() => {
    subscription?.unsubscribe();
  });

  it("does not tick for the state stored when it subscribes", async () => {
    await refresh(1);
    listen();

    expect(ticks).toBe(0);
  });

  it("ticks each time the background refreshes", async () => {
    await refresh(1);
    listen();

    await refresh(2);
    await refresh(3);

    expect(ticks).toBe(2);
  });

  it("does not tick for a rewrite without a refresh", async () => {
    await refresh(1);
    listen();

    await refresh(1);

    expect(ticks).toBe(0);
  });

  it("ignores another user's refresh", async () => {
    listen();

    await refresh(2, otherUserId);

    expect(ticks).toBe(0);
  });

  it("does not tick for the stored state of an account switched to", async () => {
    await refresh(1, otherUserId);
    listen();

    await accountService.switchAccount(otherUserId);
    expect(ticks).toBe(0);

    await refresh(2, otherUserId);
    expect(ticks).toBe(1);
  });
});
