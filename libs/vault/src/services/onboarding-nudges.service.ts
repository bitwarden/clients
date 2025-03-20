import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { Jsonify } from "type-fest";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import {
  StateProvider,
  UserKeyDefinition,
  ONBOARDING_NUDGES_DISK,
  SingleUserState,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

export type OnboardingNudgesType = {
  introCarouselDismissal: boolean | null;
  emptyVaultNudgeDismissal: boolean | null;
  populatedVaultNudgeDismissal: boolean | null;
  acctSettingsNudgeDismissal: boolean | null;
  autofillSettingsNudgeDismissal: boolean | null;
  loginItemNudgeDismissal: boolean | null;
  cardItemNudgeDismissal: boolean | null;
  identityItemNudgeDismissal: boolean | null;
  noteItemNudgeDismissal: boolean | null;
  generatorPageNudgeDismissal: boolean | null;
};

export class OnboardingNudges {
  introCarouselDismissal: boolean | null = null;
  emptyVaultNudgeDismissal: boolean | null = null;
  populatedVaultNudgeDismissal: boolean | null = null;
  acctSettingsNudgeDismissal: boolean | null = null;
  autofillSettingsNudgeDismissal: boolean | null = null;
  loginItemNudgeDismissal: boolean | null = null;
  cardItemNudgeDismissal: boolean | null = null;
  identityItemNudgeDismissal: boolean | null = null;
  noteItemNudgeDismissal: boolean | null = null;
  generatorPageNudgeDismissal: boolean | null = null;

  constructor(obj: Partial<OnboardingNudges>) {
    if (obj == null) {
      return;
    }
    this.introCarouselDismissal = obj.introCarouselDismissal || null;
    this.emptyVaultNudgeDismissal = obj.emptyVaultNudgeDismissal || null;
    this.populatedVaultNudgeDismissal = obj.populatedVaultNudgeDismissal || null;
    this.acctSettingsNudgeDismissal = obj.acctSettingsNudgeDismissal || null;
    this.autofillSettingsNudgeDismissal = obj.autofillSettingsNudgeDismissal || null;
    this.loginItemNudgeDismissal = obj.loginItemNudgeDismissal || null;
    this.cardItemNudgeDismissal = obj.cardItemNudgeDismissal || null;
    this.identityItemNudgeDismissal = obj.identityItemNudgeDismissal || null;
    this.noteItemNudgeDismissal = obj.noteItemNudgeDismissal || null;
    this.generatorPageNudgeDismissal = obj.generatorPageNudgeDismissal || null;
  }

  static fromJSON(obj: Jsonify<OnboardingNudges>) {
    return Object.assign(new OnboardingNudges({}), obj);
  }
}

export const ONBOARDING_NUDGES_KEY = new UserKeyDefinition<OnboardingNudgesType>(
  ONBOARDING_NUDGES_DISK,
  "onboarding_nudges",
  {
    deserializer: (obj: Jsonify<OnboardingNudges>) => OnboardingNudges.fromJSON(obj),
    clearOn: [],
  },
);

@Injectable()
export class OnboardingNudgesService {
  constructor(
    private stateProvider: StateProvider,
    private apiService: ApiService,
  ) {}

  private onboardingNudgesState(userId: UserId): SingleUserState<OnboardingNudgesType> {
    return this.stateProvider.getUser(userId, ONBOARDING_NUDGES_KEY);
  }

  getOnboardinngNudgesState$(userId: UserId): Observable<OnboardingNudgesType | null> {
    return this.onboardingNudgesState(userId).state$;
  }

  async setOnboardingNudgesState(userId: UserId, nudges: OnboardingNudgesType): Promise<void> {
    await this.onboardingNudgesState(userId).update(() => ({ ...nudges }));
  }

  async isNewAccount(userId: UserId): Promise<boolean> {
    const userProfile = await this.apiService.getProfile();
    const profileCreationDate = new Date(userProfile.creationDate);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    return profileCreationDate >= thirtyDaysAgo;
  }
}
