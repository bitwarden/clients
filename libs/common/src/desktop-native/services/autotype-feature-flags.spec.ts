import { BehaviorSubject, firstValueFrom } from "rxjs";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";

import { autotypeFeatureFlagEnabled$ } from "./autotype-feature-flags";

describe("autotypeFeatureFlagEnabled$", () => {
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
    const subscription = autotypeFeatureFlagEnabled$(mockConfigService).subscribe();

    expect(mockConfigService.getFeatureFlag$).toHaveBeenCalledWith(
      FeatureFlag.WindowsDesktopAutotype,
    );
    expect(mockConfigService.getFeatureFlag$).toHaveBeenCalledWith(
      FeatureFlag.WindowsDesktopAutotypeGA,
    );

    subscription.unsubscribe();
  });

  it("emits false when neither flag is enabled", async () => {
    mvpFeatureFlagSubject.next(false);
    gaFeatureFlagSubject.next(false);

    const result = await firstValueFrom(autotypeFeatureFlagEnabled$(mockConfigService));

    expect(result).toBe(false);
  });

  it("emits true when only the MVP flag is enabled", async () => {
    mvpFeatureFlagSubject.next(true);
    gaFeatureFlagSubject.next(false);

    const result = await firstValueFrom(autotypeFeatureFlagEnabled$(mockConfigService));

    expect(result).toBe(true);
  });

  it("emits true when only the GA flag is enabled", async () => {
    mvpFeatureFlagSubject.next(false);
    gaFeatureFlagSubject.next(true);

    const result = await firstValueFrom(autotypeFeatureFlagEnabled$(mockConfigService));

    expect(result).toBe(true);
  });

  it("emits true when both flags are enabled", async () => {
    mvpFeatureFlagSubject.next(true);
    gaFeatureFlagSubject.next(true);

    const result = await firstValueFrom(autotypeFeatureFlagEnabled$(mockConfigService));

    expect(result).toBe(true);
  });

  it("does not re-emit when the resolved value is unchanged", () => {
    mvpFeatureFlagSubject.next(false);
    gaFeatureFlagSubject.next(false);

    const emissions: boolean[] = [];
    const subscription = autotypeFeatureFlagEnabled$(mockConfigService).subscribe((value) =>
      emissions.push(value),
    );

    mvpFeatureFlagSubject.next(true); // false -> true: a real change
    gaFeatureFlagSubject.next(true); // true || true is still true: no new emission

    subscription.unsubscribe();

    expect(emissions).toEqual([false, true]);
  });
});
