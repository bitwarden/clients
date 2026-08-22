import { BehaviorSubject, firstValueFrom, of } from "rxjs";

import { AllowedFeatureFlagTypes, FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { StateProvider } from "@bitwarden/state";

import { devFlagEnabled, devFlagValue } from "../../../platform/flags";
import { QualificationEngineId } from "../../qualification/types/engine-id";

import { QualificationEngineOverrideState } from "./engine-override.state";
import { DEFAULT_ENGINE_ID } from "./engine-registry";

jest.mock("../../../platform/flags", () => ({
  devFlagEnabled: jest.fn().mockReturnValue(false),
  devFlagValue: jest.fn(),
}));

const devFlagEnabledMock = devFlagEnabled as jest.Mock;
const devFlagValueMock = devFlagValue as jest.Mock;

type Options = {
  /** What the popup picker has persisted, if anything. */
  override?: unknown;
  /** What `getFeatureFlag$` resolves the flag to. */
  flagValue?: unknown;
  /** What `local.json` sets, if anything. */
  devFlag?: string;
};

function build({ override, flagValue, devFlag }: Options) {
  devFlagEnabledMock.mockReturnValue(devFlag !== undefined);
  devFlagValueMock.mockReturnValue(devFlag);

  const overrides = new BehaviorSubject<Partial<Record<FeatureFlag, AllowedFeatureFlagTypes>>>(
    override === undefined
      ? {}
      : { [FeatureFlag.AutofillQualificationEngine]: override as AllowedFeatureFlagTypes },
  );

  // `update` applies the reducer against the live value, so `set`/`clear` tests
  // can read the result back out of `overrides`.
  const update = jest.fn(async (reducer: (current: unknown) => unknown) => {
    overrides.next(
      reducer(overrides.value) as Partial<Record<FeatureFlag, AllowedFeatureFlagTypes>>,
    );
  });

  const stateProvider = {
    getGlobal: () => ({ state$: overrides.asObservable(), update }),
  } as unknown as StateProvider;

  const configService = { getFeatureFlag$: () => of(flagValue) } as unknown as ConfigService;

  return {
    state: new QualificationEngineOverrideState(stateProvider, configService),
    pick: (id: QualificationEngineId) =>
      overrides.next({ [FeatureFlag.AutofillQualificationEngine]: id }),
    stored: () => overrides.value,
  };
}

describe("QualificationEngineOverrideState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("resolvedId$", () => {
    it("prefers the picker's choice over the dev flag", async () => {
      // The whole point of the picker outranking `local.json`: setting a dev
      // flag is how the picker becomes visible on a production build, so if the
      // dev flag also won the picker would be permanently inert.
      const { state } = build({
        override: QualificationEngineId.Autocomplete,
        devFlag: QualificationEngineId.Scoring,
      });

      expect(await firstValueFrom(state.resolvedId$)).toBe(QualificationEngineId.Autocomplete);
    });

    it("falls back to the dev flag when nothing is picked", async () => {
      const { state } = build({ devFlag: QualificationEngineId.Scoring });

      expect(await firstValueFrom(state.resolvedId$)).toBe(QualificationEngineId.Scoring);
    });

    it("falls back to the flag value when there is no dev flag", async () => {
      const { state } = build({ flagValue: QualificationEngineId.Autocomplete });

      expect(await firstValueFrom(state.resolvedId$)).toBe(QualificationEngineId.Autocomplete);
    });

    it("falls back to the default when there is no selection at all", async () => {
      expect(await firstValueFrom(build({}).state.resolvedId$)).toBe(DEFAULT_ENGINE_ID);
    });

    it("ignores an unrecognized persisted override", async () => {
      // Nothing validates what lands in the override store, so a stale id left
      // over from a renamed engine must not take the popup down with it.
      const { state } = build({ override: "scoring-v2", devFlag: QualificationEngineId.Scoring });

      expect(await firstValueFrom(state.resolvedId$)).toBe(QualificationEngineId.Scoring);
    });

    it("re-emits when the picker changes", () => {
      const emitted: QualificationEngineId[] = [];
      const { state, pick } = build({});

      state.resolvedId$.subscribe((id) => emitted.push(id));
      pick(QualificationEngineId.Autocomplete);

      expect(emitted).toEqual([DEFAULT_ENGINE_ID, QualificationEngineId.Autocomplete]);
    });
  });

  describe("set / clear", () => {
    it("pins the picked engine ahead of the flag", async () => {
      const { state, stored } = build({ flagValue: QualificationEngineId.Autocomplete });

      await state.set(QualificationEngineId.Scoring);

      expect(stored()).toEqual({
        [FeatureFlag.AutofillQualificationEngine]: QualificationEngineId.Scoring,
      });
      expect(await firstValueFrom(state.resolvedId$)).toBe(QualificationEngineId.Scoring);
    });

    it("removes the key on clear rather than writing the default", async () => {
      // Writing the default id would keep outranking the server rollout
      // forever. Only an absent key means "follow the flag".
      const { state, stored } = build({
        override: QualificationEngineId.Scoring,
        flagValue: QualificationEngineId.Autocomplete,
      });

      await state.clear();

      expect(stored()).not.toHaveProperty(FeatureFlag.AutofillQualificationEngine);
      expect(await firstValueFrom(state.resolvedId$)).toBe(QualificationEngineId.Autocomplete);
    });

    it("leaves other flag overrides alone", async () => {
      const { state, stored } = build({ override: QualificationEngineId.Scoring });
      await state.set(QualificationEngineId.Autocomplete);
      // Simulate an unrelated override sharing the store.
      Object.assign(stored(), { [FeatureFlag.FillAssistTargetingRules]: true });

      await state.clear();

      expect(stored()).toEqual({ [FeatureFlag.FillAssistTargetingRules]: true });
    });

    it("is a no-op when nothing was ever stored", async () => {
      const { state } = build({ flagValue: undefined });

      await expect(state.clear()).resolves.toBeUndefined();
      expect(await firstValueFrom(state.resolvedId$)).toBe(DEFAULT_ENGINE_ID);
    });
  });
});
