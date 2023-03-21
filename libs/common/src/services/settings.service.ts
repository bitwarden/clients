import { BehaviorSubject, concatMap } from "rxjs";

import { SettingsService as SettingsServiceAbstraction } from "../abstractions/settings.service";
import { StateService } from "../abstractions/state.service";
import { Utils } from "../misc/utils";
import { AccountSettingsSettings } from "../models/domain/account";
import { Guid } from "../types/guid";

export class SettingsService implements SettingsServiceAbstraction {
  protected _settings: BehaviorSubject<AccountSettingsSettings> = new BehaviorSubject({});

  settings$ = this._settings.asObservable();

  constructor(private stateService: StateService) {
    this.stateService.activeAccountUnlocked$
      .pipe(
        concatMap(async (unlocked) => {
          if (Utils.global.bitwardenContainerService == null) {
            return;
          }

          if (!unlocked) {
            this._settings.next({});
            return;
          }

          const data = await this.stateService.getSettings();

          this._settings.next(data);
        })
      )
      .subscribe();
  }

  async setEquivalentDomains(equivalentDomains: string[][]): Promise<void> {
    const settings = this._settings.getValue() ?? {};

    settings.equivalentDomains = equivalentDomains;

    this._settings.next(settings);
    await this.stateService.setSettings(settings);
  }

  getEquivalentDomains(url: string): string[] {
    const domain = Utils.getDomain(url);
    if (domain == null) {
      return null;
    }

    const settings = this._settings.getValue();

    let result: string[] = [];

    if (settings?.equivalentDomains != null) {
      settings.equivalentDomains
        .filter((ed) => ed.length > 0 && ed.includes(domain))
        .forEach((ed) => {
          result = result.concat(ed);
        });
    }

    return result;
  }

  async clear(userId?: Guid): Promise<void> {
    if (userId == null || userId == (await this.stateService.getUserId())) {
      this._settings.next({});
    }

    await this.stateService.setSettings(null, { userId: userId });
  }
}
