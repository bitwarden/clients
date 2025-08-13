import { Injectable } from "@angular/core";
import { firstValueFrom, map, Observable } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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

  constructor(
    private stateProvider: StateProvider,
    private configService: ConfigService,
  ) {}

  async setIntroCarouselDismissed(): Promise<void> {
    const hasVaultNudgeFlag = await firstValueFrom(
      this.configService.getFeatureFlag$(FeatureFlag.PM8851_BrowserOnboardingNudge),
    );
    if (hasVaultNudgeFlag) {
      await this.introCarouselState.update(() => true);
    }
  }
}
