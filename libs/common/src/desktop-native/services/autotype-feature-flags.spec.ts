import { BehaviorSubject, firstValueFrom } from "rxjs";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { AutotypeFeatureFlagState } from "../enums/autotype-feature-flag-state.enum";

import { autotypeFeatureFlagState$ } from "./autotype-feature-flags";

describe("autotypeFeatureFlagState$", () => {
  let mockConfigService: jest.Mocked<ConfigService>;
  let mvpFeatureFlagSubject: BehaviorSubject<boolean>;
  let gaFeatureFlagSubject: BehaviorSubject<boolean>;

  beforeEach(() => {
    mvpFeatureFlagSubject = new BehaviorSubject<boolean>(true);
    gaFeatureFlagSubject = new BehaviorSubject<boolean>(false);

    mockConfigService = {
      getFeatureFlag$: jest.fn().mockImplementation((flag: FeatureFlag) => {
        if (flag === FeatureFlag.WindowsDesktopAutotypeGA) {
          return gaFeatureFlagSubject.asObservable();
        }
        return mvpFeatureFlagSubject.asObservable();
      }),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("reads the MVP and GA feature flags", () => {
    const subscription = autotypeFeatureFlagState$(mockConfigService).subscribe();

    expect(mockConfigService.getFeatureFlag$).toHaveBeenCalledWith(
      FeatureFlag.WindowsDesktopAutotype,
    );
    expect(mockConfigService.getFeatureFlag$).toHaveBeenCalledWith(
      FeatureFlag.WindowsDesktopAutotypeGA,
    );

    subscription.unsubscribe();
  });

  it("resolves to Off when neither flag is enabled", async () => {
    mvpFeatureFlagSubject.next(false);
    gaFeatureFlagSubject.next(false);

    const result = await firstValueFrom(autotypeFeatureFlagState$(mockConfigService));

    expect(result).toBe(AutotypeFeatureFlagState.Off);
  });

  it("resolves to Mvp when only the MVP flag is enabled", async () => {
    mvpFeatureFlagSubject.next(true);
    gaFeatureFlagSubject.next(false);

    const result = await firstValueFrom(autotypeFeatureFlagState$(mockConfigService));

    expect(result).toBe(AutotypeFeatureFlagState.Mvp);
  });

  it("resolves to Ga when only the GA flag is enabled", async () => {
    mvpFeatureFlagSubject.next(false);
    gaFeatureFlagSubject.next(true);

    const result = await firstValueFrom(autotypeFeatureFlagState$(mockConfigService));

    expect(result).toBe(AutotypeFeatureFlagState.Ga);
  });

  it("resolves to Off (fails closed) when both flags are enabled", async () => {
    mvpFeatureFlagSubject.next(true);
    gaFeatureFlagSubject.next(true);

    const result = await firstValueFrom(autotypeFeatureFlagState$(mockConfigService));

    expect(result).toBe(AutotypeFeatureFlagState.Off);
  });

  it("does not re-emit when the resolved value is unchanged", () => {
    mvpFeatureFlagSubject.next(true);
    gaFeatureFlagSubject.next(false);

    const emissions: AutotypeFeatureFlagState[] = [];
    const subscription = autotypeFeatureFlagState$(mockConfigService).subscribe((value) =>
      emissions.push(value),
    );

    mvpFeatureFlagSubject.next(true); // redundant re-emission of the same flag value

    subscription.unsubscribe();

    expect(emissions).toEqual([AutotypeFeatureFlagState.Mvp]);
  });
});
