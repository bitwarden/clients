import { BehaviorSubject, concatMap } from "rxjs";

import { SettingsService as SettingsServiceAbstraction } from "../abstractions/settings.service";
import { StateService } from "../platform/abstractions/state.service";
import { Utils } from "../platform/misc/utils";

export class SettingsService implements SettingsServiceAbstraction {
  protected _disableFavicon = new BehaviorSubject<boolean>(null);

  disableFavicon$ = this._disableFavicon.asObservable();

  constructor(private stateService: StateService) {
    this.stateService.activeAccountUnlocked$
      .pipe(
        concatMap(async (unlocked) => {
          if (Utils.global.bitwardenContainerService == null) {
            return;
          }

          if (!unlocked) {
            return;
          }

          const disableFavicon = await this.stateService.getDisableFavicon();

          this._disableFavicon.next(disableFavicon);
        }),
      )
      .subscribe();
  }

  async setDisableFavicon(value: boolean) {
    this._disableFavicon.next(value);
    await this.stateService.setDisableFavicon(value);
  }

  getDisableFavicon(): boolean {
    return this._disableFavicon.getValue();
  }
}
