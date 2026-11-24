import { type Observable, of } from "rxjs";

import type { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import type { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import type { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import type { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import type { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { defaultTimings, type AutofillTimings } from "../../lifecycle";
import type { LiveFrame } from "../../lifecycle/transition-buffer";
import type { AutofillService } from "../../services/abstractions/autofill.service";

/**
 * The browser, as a fill reads it. No read rejects: a tab or frame that is gone, and a window with no
 * active tab, resolve to `undefined`. An adapter over the browser maps a `null` result and a
 * rejection to `undefined`.
 */
export type FillBrowser = Readonly<{
  /** The tab as the browser reports it now. */
  tab: (tabId: number) => Promise<chrome.tabs.Tab | undefined>;
  /** The frame as the browser reports it now. Frame `0` is the tab's top frame. */
  frame: (tabId: number, frameId: number) => Promise<LiveFrame | undefined>;
  /** The active tab of the current window. */
  activeTab: () => Promise<chrome.tabs.Tab | undefined>;
}>;

/** The services a fill works with. A phase is built with only the members it needs, picked by name. */
export type FillServices = Readonly<{
  browser: FillBrowser;
  /**
   * Whether the tab is monitoring: its current value, then each change. Completes when that is no
   * longer known. An error rejects the fill.
   */
  monitoring$: (tabId: number) => Observable<boolean>;
  accountService: AccountService;
  authService: AuthService;
  autofillService: AutofillService;
  cipherService: CipherService;
  logService: LogService;
  platformUtilsService: PlatformUtilsService;
  /** Refreshes the inline menu's ciphers. */
  updateOverlayCiphers: () => Promise<void>;
  /** The wall clock, in epoch ms. */
  now: () => number;
}>;

/** The tuned timings of a fill. */
export type FillTimings = Pick<AutofillTimings, "slowRenderMs$"> &
  Readonly<{
    /**
     * How long a tab-wide collect waits after a frame's answer for another. A tab's frames answer a
     * collect independently, and their answers accumulate into one result. Its current value is
     * taken each time a frame answers. A timing that has no value then holds the collect until it
     * does.
     */
    collectSettleMs$: Observable<number>;
  }>;

/** The default of {@link FillTimings.collectSettleMs$}. */
const COLLECT_SETTLE_MS = 50;

/** The default timings of a fill. */
export const defaultFillTimings: FillTimings = Object.freeze({
  slowRenderMs$: defaultTimings.slowRenderMs$,
  collectSettleMs$: of(COLLECT_SETTLE_MS),
});
