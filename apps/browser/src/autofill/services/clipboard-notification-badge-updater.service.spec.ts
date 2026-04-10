import { BehaviorSubject, firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";

import { BadgeService } from "../../platform/badge/badge.service";
import { BadgeStatePriority } from "../../platform/badge/priority";

import { ClipboardNotificationBadgeUpdaterService } from "./clipboard-notification-badge-updater.service";

describe("ClipboardNotificationBadgeUpdaterService", () => {
  let service: ClipboardNotificationBadgeUpdaterService;
  let setState: jest.Mock;
  let activeAccount$: BehaviorSubject<{ id: string } | null>;
  let showClipboardSettingUpdateNotification$: BehaviorSubject<boolean>;

  beforeEach(async () => {
    setState = jest.fn();
    activeAccount$ = new BehaviorSubject<{ id: string } | null>({ id: "test-user" });
    showClipboardSettingUpdateNotification$ = new BehaviorSubject<boolean>(false);

    service = new ClipboardNotificationBadgeUpdaterService(
      { setState } as unknown as BadgeService,
      { activeAccount$ } as unknown as AccountService,
      {
        showClipboardSettingUpdateNotification$,
      } as unknown as AutofillSettingsServiceAbstraction,
    );

    await service.init();
  });

  it("registers state function on init", () => {
    expect(setState).toHaveBeenCalledWith("clipboard-notification-badge", expect.any(Function));
  });

  it("returns undefined when shouldShow is false", async () => {
    showClipboardSettingUpdateNotification$.next(false);
    const stateFunction = setState.mock.calls[0][1];

    const state = await firstValueFrom(stateFunction());

    expect(state).toBeUndefined();
  });

  it("returns undefined when account is null", async () => {
    activeAccount$.next(null);
    showClipboardSettingUpdateNotification$.next(true);
    const stateFunction = setState.mock.calls[0][1];

    const state = await firstValueFrom(stateFunction());

    expect(state).toBeUndefined();
  });

  it("returns badge state when account exists and shouldShow is true", async () => {
    showClipboardSettingUpdateNotification$.next(true);
    const stateFunction = setState.mock.calls[0][1];

    const state = await firstValueFrom(stateFunction());

    expect(state).toEqual({
      state: { text: "1", color: "#ff0000" },
      priority: BadgeStatePriority.Default,
    });
  });

  it("clears badge when shouldShow changes to false", async () => {
    showClipboardSettingUpdateNotification$.next(true);
    const stateFunction = setState.mock.calls[0][1];
    const observable = stateFunction();

    showClipboardSettingUpdateNotification$.next(false);
    const state = await firstValueFrom(observable);

    expect(state).toBeUndefined();
  });
});
