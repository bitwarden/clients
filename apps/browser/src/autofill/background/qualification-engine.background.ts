import { Subscription, distinctUntilChanged } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { BrowserApi } from "../../platform/browser/browser-api";
import { QualificationEngineCommand } from "../enums/autofill-message.enums";
import { QualificationEngineId } from "../qualification/types/engine-id";
import { QualificationEngineOverrideState } from "../services/qualification/engine-override.state";
import { QualificationStack } from "../services/qualification/qualification-service.factory";

/**
 * Carries the selected qualification engine to every context that can't resolve
 * it for itself.
 *
 * `MainBackground` is constructed at module scope with no opportunity to await
 * `ConfigService`, and content scripts have no access to it at all, so both
 * build at the default and are corrected from here. See
 * `autofill/qualification/engine-selection.design.md` for why resolving before
 * construction is the wrong trade in both places — deferring the background
 * costs synchronous MV3 listener registration, and deferring a content script
 * costs a storage read at `document_start` on every page load.
 *
 * Two directions:
 *
 * - **Background** — subscribes to the resolved selection and swaps its own
 *   stack in place. Every reference handed out during construction keeps
 *   working; see {@link SwappableQualificationEngine}.
 * - **Content scripts** — pushed the id on every change, and allowed to ask for
 *   it once at init. The push alone would miss frames that boot between
 *   changes; the pull alone would leave open tabs on a stale engine after a
 *   flag flip. Fields are qualified on focus and on mutation rather than at
 *   construction, so an id arriving after boot is still in time.
 */
export class QualificationEngineBackground {
  private subscription?: Subscription;

  constructor(
    private readonly stack: QualificationStack,
    private readonly selection: QualificationEngineOverrideState,
    private readonly logService: LogService,
  ) {}

  init() {
    BrowserApi.messageListener("qualification-engine.background", this.handleExtensionMessage);

    this.subscription = this.selection.resolvedId$
      .pipe(distinctUntilChanged())
      .subscribe((id) => this.applySelection(id));
  }

  destroy() {
    this.subscription?.unsubscribe();
  }

  /**
   * Swaps the background's own stack, and tells every frame only when the
   * selection actually moved.
   *
   * The broadcast is a `tabsQuery` plus a `getAllFrameDetails` and a
   * `tabSendMessage` per frame — cheap once, wasteful on repeat. An MV3 service
   * worker is torn down and restarted constantly, and each restart re-runs
   * `init()` and re-subscribes, so `resolvedId$` emits its current value again.
   * Without the guard every restart sweeps every frame of every tab to announce
   * something they are already running.
   */
  private applySelection(id: QualificationEngineId) {
    if (!this.stack.swap(id)) {
      return;
    }
    void this.pushToAllFrames(id).catch((error: unknown) => this.logService.error(error));
  }

  /**
   * Answers a content script's boot-time request for the current id.
   *
   * Only our own content scripts can reach this listener — host page script
   * runs in an isolated world and `chrome.runtime.onMessage` does not carry
   * messages from it — but the sender check is cheap and keeps the guarantee
   * local to the file rather than implied by the platform.
   */
  private handleExtensionMessage = (
    message: { command?: string },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ): true | void => {
    if (message?.command !== QualificationEngineCommand.request) {
      return;
    }

    if (sender.id !== chrome.runtime.id) {
      sendResponse(null);
      return true;
    }

    sendResponse({ engineId: this.stack.engine.id });
    return true;
  };

  /**
   * Sends the id to every frame of every http(s) tab.
   *
   * Modelled on `AutofillService.injectAutofillScriptsInAllTabs`. Frames
   * without an autofill content script simply have no listener for the command;
   * `tabSendMessage` rejects and the per-frame catch swallows it, which is the
   * same shape the injection sweep relies on.
   */
  private async pushToAllFrames(engineId: QualificationEngineId): Promise<void> {
    const tabs = await BrowserApi.tabsQuery({});
    for (const tab of tabs) {
      if (!tab?.id || !tab.url?.startsWith("http")) {
        continue;
      }
      const frames = await BrowserApi.getAllFrameDetails(tab.id);
      frames?.forEach((frame) => {
        void BrowserApi.tabSendMessage(
          tab,
          { command: QualificationEngineCommand.update, engineId },
          { frameId: frame.frameId },
        ).catch(() => {
          /* frame has no autofill content script */
        });
      });
    }
  }
}
