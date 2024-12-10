import { inject, Injectable } from "@angular/core";
import Plausible from "plausible-tracker";
// import { firstValueFrom } from "rxjs";

import { ANALYTICS, GlobalStateProvider, KeyDefinition } from "@bitwarden/common/platform/state";

const ANALYTICS_ENABLED_KEY_DEF = new KeyDefinition<boolean>(ANALYTICS, "analytics_enabled", {
  deserializer: (s) => s,
});

@Injectable({ providedIn: "root" })
export class AnalyticsService {
  private plausible: ReturnType<typeof Plausible>;
  private plausibleCleanup?: () => any;

  private readonly _enabledState = inject(GlobalStateProvider).get(ANALYTICS_ENABLED_KEY_DEF);
  readonly enabled$ = this._enabledState.state$;

  async init() {
    this.plausible = Plausible({
      domain: "bitwarden",
      trackLocalhost: true,
      hashMode: true,
    });

    // TODO: uncomment when a toggle is added to settings page
    // const enabled = await firstValueFrom(this._enabledState.state$);
    // if (!enabled) {
    //     return;
    // }

    await this.enable();
  }

  async enable() {
    await this._enabledState.update((_prevState) => true);
    this.plausibleCleanup = this.plausible.enableAutoPageviews();
  }

  async disable() {
    await this._enabledState.update((_prevState) => false);
    this?.plausibleCleanup();
  }

  trackEvent(eventName: string) {
    this.plausible.trackEvent(eventName);
  }
}
