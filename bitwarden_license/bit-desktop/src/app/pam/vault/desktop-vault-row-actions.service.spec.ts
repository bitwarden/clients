import { DestroyRef } from "@angular/core";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { GatedRequestActionsService } from "@bitwarden/bit-pam-components";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { DesktopVaultRowActionsService } from "./desktop-vault-row-actions.service";

function gatedCipher(id: string | null = "cipher-1"): CipherViewLike {
  return { id, partial: true } as unknown as CipherViewLike;
}

function plainCipher(): CipherViewLike {
  return { id: "cipher-2", partial: false } as unknown as CipherViewLike;
}

describe("DesktopVaultRowActionsService", () => {
  let gatedRequestActions: MockProxy<GatedRequestActionsService>;
  let activeAccount$: BehaviorSubject<Account | null>;
  let cancelable$: Record<string, BehaviorSubject<boolean>>;
  let destroyCallbacks: Array<() => void>;
  let service: DesktopVaultRowActionsService;

  const account = (id: string) => ({ id: id as UserId }) as Account;

  /** The service reads a row's state on a microtask, since `show` may not write a signal. */
  async function settle(): Promise<void> {
    await Promise.resolve();
  }

  function cancelAction() {
    const action = service.rowActions().find((a) => a.id === "pamCancelRequest");
    if (action == null) {
      throw new Error("the cancel action was not offered");
    }
    return action;
  }

  beforeEach(() => {
    cancelable$ = { "cipher-1": new BehaviorSubject(true) };
    gatedRequestActions = mock<GatedRequestActionsService>();
    gatedRequestActions.cancelableRequest$.mockImplementation((cipher) => {
      const id = String(cipher.id);
      return (cancelable$[id] ??= new BehaviorSubject(false));
    });
    const accountService = mock<AccountService>();
    activeAccount$ = new BehaviorSubject<Account | null>(account("user-1"));
    accountService.activeAccount$ = activeAccount$;
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key);
    destroyCallbacks = [];
    const destroyRef = {
      onDestroy: (callback: () => void) => {
        destroyCallbacks.push(callback);
        return () => undefined;
      },
    } as unknown as DestroyRef;
    service = new DesktopVaultRowActionsService(
      gatedRequestActions,
      i18nService,
      accountService,
      destroyRef,
    );
  });

  it("offers Cancel request under the PAM id, labelled with the shared string", () => {
    expect(cancelAction().label).toBe("pendingStateCancelRequest");
    expect(cancelAction().icon).toBe("bwi-close");
  });

  describe("show", () => {
    it("hides the entry until the row's state has been read, then shows it", async () => {
      const action = cancelAction();

      expect(action.show!(gatedCipher())).toBe(false);
      await settle();

      expect(action.show!(gatedCipher())).toBe(true);
    });

    it("never reads the state of an ungated row", async () => {
      const action = cancelAction();

      expect(action.show!(plainCipher())).toBe(false);
      await settle();

      expect(gatedRequestActions.cancelableRequest$).not.toHaveBeenCalled();
    });

    it("never reads a row that has no id", async () => {
      expect(cancelAction().show!(gatedCipher(null))).toBe(false);
      await settle();

      expect(gatedRequestActions.cancelableRequest$).not.toHaveBeenCalled();
    });

    it("reads each row once however often the menu asks within the freshness window", async () => {
      const action = cancelAction();

      action.show!(gatedCipher());
      action.show!(gatedCipher());
      await settle();
      action.show!(gatedCipher());

      expect(gatedRequestActions.cancelableRequest$).toHaveBeenCalledTimes(1);
    });

    it("holds no subscription once a row has answered", async () => {
      cancelAction().show!(gatedCipher());
      await settle();

      expect(cancelable$["cipher-1"].observed).toBe(false);
    });

    it("reads a row again once its answer has gone stale", async () => {
      jest.useFakeTimers({ doNotFake: ["queueMicrotask", "nextTick"] });
      try {
        const action = cancelAction();
        action.show!(gatedCipher());
        await settle();

        cancelable$["cipher-1"].next(false);
        jest.advanceTimersByTime(6000);
        action.show!(gatedCipher());
        await settle();

        expect(action.show!(gatedCipher())).toBe(false);
        expect(gatedRequestActions.cancelableRequest$).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("run", () => {
    it("withdraws the row's outstanding request through the shared service", async () => {
      gatedRequestActions.cancelRequest.mockResolvedValue(undefined);
      const cipher = gatedCipher();

      await cancelAction().run(cipher);

      expect(gatedRequestActions.cancelRequest).toHaveBeenCalledWith(cipher);
    });
  });

  describe("account changes", () => {
    it("forgets the previous account's answers", async () => {
      const action = cancelAction();
      action.show!(gatedCipher());
      await settle();
      expect(action.show!(gatedCipher())).toBe(true);

      activeAccount$.next(account("user-2"));

      expect(action.show!(gatedCipher())).toBe(false);
    });

    it("is not reset by an account emission that names the same user", async () => {
      const action = cancelAction();
      action.show!(gatedCipher());
      await settle();

      activeAccount$.next(account("user-1"));

      expect(action.show!(gatedCipher())).toBe(true);
    });

    it("forgets every answer when destroyed", async () => {
      const action = cancelAction();
      action.show!(gatedCipher());
      await settle();

      destroyCallbacks.forEach((callback) => callback());

      expect(action.show!(gatedCipher())).toBe(false);
    });

    it("drops a read scheduled before the account changed", async () => {
      cancelAction().show!(gatedCipher());

      activeAccount$.next(account("user-2"));
      await settle();

      expect(gatedRequestActions.cancelableRequest$).not.toHaveBeenCalled();
    });
  });
});
