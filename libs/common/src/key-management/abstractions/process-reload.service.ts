import { Observable } from "rxjs";

import { KeyDefinition, PROCESS_RELOAD_DISK } from "../../platform/state";

export const DISABLE_PROCESS_RELOAD = new KeyDefinition<boolean>(
  PROCESS_RELOAD_DISK,
  "disableProcessReload",
  { deserializer: (s) => s },
);

export abstract class ProcessReloadServiceAbstraction {
  /** Dev-only setting. When true, process reload is skipped on lock or logout. */
  abstract disableProcessReload$: Observable<boolean>;
  abstract setDisableProcessReload(disabled: boolean): Promise<void>;
  abstract startProcessReload(): Promise<void>;
  abstract cancelProcessReload(): void;
}
