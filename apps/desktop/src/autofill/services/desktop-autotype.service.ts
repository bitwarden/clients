import { Injectable, OnDestroy } from "@angular/core";
import { firstValueFrom, Subject } from "rxjs";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

@Injectable({
  providedIn: "root",
})
export class DesktopAutotypeService implements OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(private desktopSettingsService: DesktopSettingsService) {}

  async init() {
    const autotypeEnabled = await firstValueFrom(this.desktopSettingsService.autotypeEnabled$);
    // eslint-disable-next-line no-console
    console.log("Is Autotype enabled? -> " + autotypeEnabled);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
