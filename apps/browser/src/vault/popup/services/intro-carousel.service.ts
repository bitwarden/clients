import { Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import {
  GlobalState,
  KeyDefinition,
  StateProvider,
  VAULT_BROWSER_INTRO_CAROUSEL,
} from "@bitwarden/common/platform/state";

const INTRO_CAROUSEL = new KeyDefinition<boolean>(
  VAULT_BROWSER_INTRO_CAROUSEL,
  "introCarouselDismissed",
  {
    deserializer: (dismissed) => dismissed,
  },
);

@Injectable({
  providedIn: "root",
})
export class IntroCarouselService {
  private introCarouselState: GlobalState<boolean> = this.stateProvider.getGlobal(INTRO_CAROUSEL);

  readonly introCarouselState$: Observable<boolean> = this.introCarouselState.state$.pipe(
    map((x) => x ?? false),
  );

  constructor(private stateProvider: StateProvider) {}

  async setIntroCarouselDismissed(): Promise<void> {
    await this.introCarouselState.update(() => true);
  }
}
