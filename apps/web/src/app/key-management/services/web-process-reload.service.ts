import { firstValueFrom, map, Observable } from "rxjs";

import {
  DISABLE_PROCESS_RELOAD,
  ProcessReloadServiceAbstraction,
} from "@bitwarden/common/key-management/abstractions/process-reload.service";
import { StateProvider } from "@bitwarden/common/platform/state";

export class WebProcessReloadService implements ProcessReloadServiceAbstraction {
  private readonly disableProcessReloadState = this.stateProvider.getGlobal(DISABLE_PROCESS_RELOAD);

  disableProcessReload$: Observable<boolean> = this.disableProcessReloadState.state$.pipe(
    map((disabled) => disabled ?? false),
  );

  constructor(
    private window: Window,
    private stateProvider: StateProvider,
  ) {}

  async setDisableProcessReload(disabled: boolean): Promise<void> {
    await this.disableProcessReloadState.update(() => disabled, {
      shouldUpdate: (current) => current !== disabled,
    });
  }

  async startProcessReload(): Promise<void> {
    if (await firstValueFrom(this.disableProcessReload$)) {
      return;
    }
    this.window.location.reload();
  }

  cancelProcessReload(): void {
    return;
  }
}
