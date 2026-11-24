import type { Observable } from "rxjs";

import type { FrameLost } from "../monitoring/types";
import type { AccountEvent } from "../types";

import type { CompletionScopeKind } from "./enums";

/** The lifecycles that a completion reaches. See {@link CompletionScopeKind}. */
export type CompletionScope =
  | Readonly<{
      kind: typeof CompletionScopeKind.Frame;
      tabId: number;
      frameId: number | undefined;
    }>
  | Readonly<{ kind: typeof CompletionScopeKind.Tab; tabId: number }>
  | Readonly<{ kind: typeof CompletionScopeKind.All }>;

/** A frame of a tab. The top frame of a tab has no frame id. */
export type LifecycleFrame = Readonly<{ tabId: number; frameId: number | undefined }>;

/** The signals that complete lifecycles. `lifecycleCompletions` subscribes to each once. */
export type CompletionSignals = Readonly<{
  /** The account events: the first observation, then each change, as from `accountEvents$`. */
  accountEvents$: Observable<AccountEvent>;
  /** The id of each removed tab, as from `TabLifecycles.tabRemoved$`. */
  tabRemoved$: Observable<number>;
  /** Each frame the extension no longer holds a connection to, as from `MonitoringController.frameLost$`. */
  frameLost$: Observable<FrameLost>;
}>;
