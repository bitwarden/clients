import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, Observable, Subject, Subscription } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BadgeSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/badge-settings.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { Tab } from "../../platform/badge/badge-browser-api";
import { BadgeService } from "../../platform/badge/badge.service";
import { BadgeStatePriority } from "../../platform/badge/priority";
import { flushPromises } from "../spec/testing-utils";

import { CipherUse, FillCipherPolicy } from "./abstractions/fill-cipher-policy";
import { AutofillBadgeUpdaterService } from "./autofill-badge-updater.service";

describe("AutofillBadgeUpdaterService", () => {
  const userId = "user-1" as UserId;
  const tab: Tab = { tabId: 1, url: "https://example.com" };

  let setState: jest.Mock;
  let activeAccount$: BehaviorSubject<{ id: UserId } | null>;
  let enableBadgeCounter$: BehaviorSubject<boolean>;
  let changed$: Subject<void>;
  let fillCipherPolicy: MockProxy<FillCipherPolicy>;
  let emissions: unknown[];
  let subscription: Subscription;

  const subscribeToBadgeState = () => {
    const stateFunction = setState.mock.calls[0][1] as (tab: Tab) => Observable<unknown>;
    subscription = stateFunction(tab).subscribe((state) => emissions.push(state));
  };

  beforeEach(() => {
    setState = jest.fn();
    activeAccount$ = new BehaviorSubject<{ id: UserId } | null>({ id: userId });
    enableBadgeCounter$ = new BehaviorSubject(true);
    changed$ = new Subject<void>();
    fillCipherPolicy = mock<FillCipherPolicy>();
    fillCipherPolicy.changed$.mockReturnValue(changed$);
    fillCipherPolicy.ciphersForUrl.mockResolvedValue([mock<CipherView>(), mock<CipherView>()]);
    emissions = [];

    new AutofillBadgeUpdaterService(
      { setState } as unknown as BadgeService,
      { activeAccount$ } as unknown as AccountService,
      fillCipherPolicy,
      { enableBadgeCounter$ } as unknown as BadgeSettingsServiceAbstraction,
      mock<LogService>(),
    ).init();
  });

  afterEach(() => {
    subscription?.unsubscribe();
  });

  it("registers its state function on init", () => {
    expect(setState).toHaveBeenCalledWith("autofill-badge-updater", expect.any(Function));
  });

  it("counts the badge ciphers for the tab URL when the policy reports a change", async () => {
    subscribeToBadgeState();

    changed$.next();
    await flushPromises();

    expect(fillCipherPolicy.changed$).toHaveBeenCalledWith(userId);
    expect(fillCipherPolicy.ciphersForUrl).toHaveBeenCalledWith(tab.url, userId, CipherUse.Badge);
    expect(emissions).toEqual([{ state: { text: "2" }, priority: BadgeStatePriority.Default }]);
  });

  it("recounts on every policy change", async () => {
    subscribeToBadgeState();
    changed$.next();
    await flushPromises();

    fillCipherPolicy.ciphersForUrl.mockResolvedValueOnce([]);
    changed$.next();
    await flushPromises();

    expect(fillCipherPolicy.ciphersForUrl).toHaveBeenCalledTimes(2);
    expect(emissions).toEqual([
      { state: { text: "2" }, priority: BadgeStatePriority.Default },
      { state: { text: undefined }, priority: BadgeStatePriority.Default },
    ]);
  });

  it("shows 9+ for more than nine ciphers", async () => {
    fillCipherPolicy.ciphersForUrl.mockResolvedValue(
      Array.from({ length: 10 }, () => mock<CipherView>()),
    );
    subscribeToBadgeState();

    changed$.next();
    await flushPromises();

    expect(emissions).toEqual([{ state: { text: "9+" }, priority: BadgeStatePriority.Default }]);
  });

  it("does not count when the badge counter is disabled", async () => {
    enableBadgeCounter$.next(false);
    subscribeToBadgeState();

    changed$.next();
    await flushPromises();

    expect(fillCipherPolicy.ciphersForUrl).not.toHaveBeenCalled();
    expect(emissions).toEqual([undefined]);
  });

  it("does not ask the policy without an active account", async () => {
    activeAccount$.next(null);
    subscribeToBadgeState();

    await flushPromises();

    expect(fillCipherPolicy.changed$).not.toHaveBeenCalled();
    expect(fillCipherPolicy.ciphersForUrl).not.toHaveBeenCalled();
    expect(emissions).toEqual([undefined]);
  });
});
