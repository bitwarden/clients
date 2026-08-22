import { Observable, combineLatest, map } from "rxjs";

import { AllowedFeatureFlagTypes, FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { GLOBAL_FEATURE_FLAG_OVERRIDES } from "@bitwarden/common/platform/services/config/default-config.service";
import { StateProvider } from "@bitwarden/state";

import {
  QualificationEngineId,
  toQualificationEngineId,
} from "../../qualification/types/engine-id";

import { resolveEngineId } from "./engine-registry";

/**
 * Reads and writes the popup engine picker's selection.
 *
 * Backed by the shared feature-flag override store, which means
 * `ConfigService.getFeatureFlag$` already picks the value up ahead of the
 * server config — the picker needs no separate plumbing to reach the code that
 * builds engines. The override store is global rather than per-user, matching
 * the flag it overrides.
 *
 * This is a narrow accessor rather than a method on `AutofillSettingsService`
 * on purpose. The engine picker is internal scaffolding for the engine-bay
 * work, not a user-facing setting, and confining it here means retiring it
 * later touches one file.
 */
export class QualificationEngineOverrideState {
  private readonly state = this.stateProvider.getGlobal(GLOBAL_FEATURE_FLAG_OVERRIDES);

  readonly engineId$: Observable<QualificationEngineId | undefined> = this.state.state$.pipe(
    map((overrides) =>
      toQualificationEngineId(overrides?.[FeatureFlag.AutofillQualificationEngine]),
    ),
  );

  /**
   * The engine id the popup should build. Highest precedence is the picker's
   * own choice, then whatever {@link resolveEngineId} makes of the feature flag.
   *
   * The picker deliberately outranks the `qualificationEngine` dev flag, which
   * `resolveEngineId` would otherwise let win. `local.json` is there for the
   * background and content scripts, which can't read config at all; the popup
   * can, so a click should beat a file. Without this the picker is inert
   * whenever a dev flag is set — and on a production build, setting one is the
   * only way to make the picker appear in the first place.
   */
  readonly resolvedId$: Observable<QualificationEngineId> = combineLatest([
    this.engineId$,
    this.configService.getFeatureFlag$(FeatureFlag.AutofillQualificationEngine),
  ]).pipe(map(([picked, flagValue]) => picked ?? resolveEngineId(flagValue)));

  constructor(
    private readonly stateProvider: StateProvider,
    private readonly configService: ConfigService,
  ) {}

  async set(id: QualificationEngineId): Promise<void> {
    await this.state.update(
      (overrides) =>
        // The KeyDefinition types this as a total Record over every FeatureFlag,
        // but the store only ever holds the flags actually overridden. The
        // assertion reconciles that; the read side already treats it as partial.
        ({
          ...(overrides ?? {}),
          [FeatureFlag.AutofillQualificationEngine]: id,
        }) as Record<FeatureFlag, AllowedFeatureFlagTypes>,
    );
  }

  /**
   * Drops the override so the flag rolls out normally again.
   *
   * The counterpart to {@link set}, and not optional. Writing here pins the
   * flag client-side ahead of the server config, and on a production build the
   * picker becomes visible the moment the id moves off the default — so
   * without a way back, one click permanently removes that install from the
   * rollout with no UI path to undo it.
   *
   * Drops the key rather than writing the default id. Those are different
   * states: an absent key means "follow the flag", where the default id
   * written explicitly would keep outranking a rollout that later turns the
   * flag on.
   *
   * Rebuilt without the key rather than `delete`d, because the KeyDefinition
   * types the store as a total record over every flag and strict mode refuses
   * to delete a required property. Same assertion, and the same reason, as
   * {@link set}.
   */
  async clear(): Promise<void> {
    await this.state.update((overrides) => {
      if (!overrides) {
        return overrides;
      }
      return Object.fromEntries(
        Object.entries(overrides).filter(
          ([flag]) => flag !== FeatureFlag.AutofillQualificationEngine,
        ),
      ) as Record<FeatureFlag, AllowedFeatureFlagTypes>;
    });
  }
}
