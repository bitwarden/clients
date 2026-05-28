import { Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import {
  GlobalState,
  KeyDefinition,
  StateProvider,
  VAULT_BROWSER_HEALTH_INTRO,
} from "@bitwarden/common/platform/state";

const HEALTH_INTRO = new KeyDefinition<boolean>(
  VAULT_BROWSER_HEALTH_INTRO,
  "healthIntroDismissed",
  {
    deserializer: (dismissed) => dismissed,
  },
);

const HEALTH_BERRY = new KeyDefinition<boolean>(
  VAULT_BROWSER_HEALTH_INTRO,
  "healthBerryDismissed",
  {
    deserializer: (dismissed) => dismissed,
  },
);

@Injectable({
  providedIn: "root",
})
export class HealthIntroService {
  private healthIntroState: GlobalState<boolean> = this.stateProvider.getGlobal(HEALTH_INTRO);
  private healthBerryState: GlobalState<boolean> = this.stateProvider.getGlobal(HEALTH_BERRY);

  readonly healthIntroDismissed$: Observable<boolean> = this.healthIntroState.state$.pipe(
    map((x) => x ?? false),
  );

  readonly healthBerryDismissed$: Observable<boolean> = this.healthBerryState.state$.pipe(
    map((x) => x ?? false),
  );

  constructor(private stateProvider: StateProvider) {}

  async setHealthIntroDismissed(): Promise<void> {
    await this.healthIntroState.update(() => true, {
      shouldUpdate: (prev) => prev !== true,
    });
  }

  async setHealthBerryDismissed(): Promise<void> {
    await this.healthBerryState.update(() => true, {
      shouldUpdate: (prev) => prev !== true,
    });
  }
}
