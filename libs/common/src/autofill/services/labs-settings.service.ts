import { map, Observable, firstValueFrom } from "rxjs";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { devFlagEnabled } from "@bitwarden/common/platform/misc/flags";

import {
  LABS_SETTINGS_DISK,
  LABS_SETTINGS_DISK_LOCAL,
  ActiveUserState,
  GlobalState,
  KeyDefinition,
  StateProvider,
  UserKeyDefinition,
} from "../../platform/state";

const LABS_SETTINGS_ENABLED = new UserKeyDefinition(LABS_SETTINGS_DISK, "labsSettingsEnabled", {
  deserializer: (value: boolean) => value ?? false,
  clearOn: [],
});

const IMPROVED_FIELD_QUALIFICATION_FOR_INLINE_MENU_ENABLED = new UserKeyDefinition(
  LABS_SETTINGS_DISK,
  "improvedFieldQualificationForInlineMenuEnabled",
  {
    deserializer: (value: boolean) => value ?? null,
    clearOn: [],
  },
);

const ADDITIONAL_INLINE_MENU_CIPHER_TYPES_ENABLED = new UserKeyDefinition(
  LABS_SETTINGS_DISK,
  "additionalInlineMenuCipherTypesEnabled",
  {
    deserializer: (value: boolean) => value ?? null,
    clearOn: [],
  },
);

export abstract class LabsSettingsServiceAbstraction {
  labsSettingsEnabled$: Observable<boolean>;
  setLabsSettingsEnabled: (newValue: boolean) => Promise<void>;
  improvedFieldQualificationForInlineMenuEnabled$: Observable<boolean>;
  setImprovedFieldQualificationForInlineMenuEnabled: (newValue: boolean) => Promise<void>;
  additionalInlineMenuCipherTypesEnabled$: Observable<boolean>;
  setAdditionalInlineMenuCipherTypesEnabled: (newValue: boolean) => Promise<void>;
}

export class LabsSettingsService implements LabsSettingsServiceAbstraction {
  private labsSettingsEnabledState: ActiveUserState<boolean>;
  readonly labsSettingsEnabled$: Observable<boolean>;
  private improvedFieldQualificationForInlineMenuEnabledState: ActiveUserState<boolean>;
  readonly improvedFieldQualificationForInlineMenuEnabled$: Observable<boolean>;
  private additionalInlineMenuCipherTypesEnabledState: ActiveUserState<boolean>;
  readonly additionalInlineMenuCipherTypesEnabled$: Observable<boolean>;

  constructor(
    private stateProvider: StateProvider,
    private configService: ConfigService,
  ) {
    this.labsSettingsEnabledState = this.stateProvider.getActive(LABS_SETTINGS_ENABLED);
    this.labsSettingsEnabled$ = this.labsSettingsEnabledState.state$.pipe(map((x) => x ?? false));

    this.improvedFieldQualificationForInlineMenuEnabledState = this.stateProvider.getActive(
      IMPROVED_FIELD_QUALIFICATION_FOR_INLINE_MENU_ENABLED,
    );
    this.improvedFieldQualificationForInlineMenuEnabled$ =
      this.improvedFieldQualificationForInlineMenuEnabledState.state$.pipe(map((x) => x ?? null));

    this.additionalInlineMenuCipherTypesEnabledState = this.stateProvider.getActive(
      ADDITIONAL_INLINE_MENU_CIPHER_TYPES_ENABLED,
    );
    this.additionalInlineMenuCipherTypesEnabled$ =
      this.additionalInlineMenuCipherTypesEnabledState.state$.pipe(map((x) => x ?? null));
  }

  async init() {
  }

  async setLabsSettingsEnabled(newValue: boolean): Promise<void> {
    await this.labsSettingsEnabledState.update(() => newValue);
  }

  // This setting may improve the accuracy of the inline menu appearing in login forms
  async setImprovedFieldQualificationForInlineMenuEnabled(newValue: boolean): Promise<void> {
    await this.improvedFieldQualificationForInlineMenuEnabledState.update(() => newValue);
  }

  // This flag turns on inline menu credit card and identity features
  async setAdditionalInlineMenuCipherTypesEnabled(newValue: boolean): Promise<void> {
    await this.additionalInlineMenuCipherTypesEnabledState.update(() => newValue);
  }
}
