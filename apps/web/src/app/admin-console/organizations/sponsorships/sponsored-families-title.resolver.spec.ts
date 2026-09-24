import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, RouterStateSnapshot } from "@angular/router";
import { firstValueFrom, Observable, of } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { sponsoredFamiliesTitleResolver } from "./sponsored-families-title.resolver";

describe("sponsoredFamiliesTitleResolver", () => {
  const route = Object.freeze({}) as ActivatedRouteSnapshot;
  const state = Object.freeze({}) as RouterStateSnapshot;

  const getFeatureFlag$ = jest.fn();
  const t = jest.fn((key: string) => `translated:${key}`);

  beforeEach(() => {
    getFeatureFlag$.mockReset();
    t.mockClear();

    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigService, useValue: { getFeatureFlag$ } },
        { provide: I18nService, useValue: { t } },
      ],
    });
  });

  function resolve() {
    return firstValueFrom(
      TestBed.runInInjectionContext(
        () => sponsoredFamiliesTitleResolver(route, state) as Observable<string | null>,
      ),
    );
  }

  it("returns the translated title when the VFO1 foundation flag is on", async () => {
    getFeatureFlag$.mockReturnValue(of(true));

    await expect(resolve()).resolves.toBe("translated:acceptSponsoredFamiliesPlan");
    expect(getFeatureFlag$).toHaveBeenCalledWith(FeatureFlag.VFO1Foundation);
    expect(t).toHaveBeenCalledWith("acceptSponsoredFamiliesPlan");
  });

  it("returns null so the default tab title is kept when the flag is off", async () => {
    getFeatureFlag$.mockReturnValue(of(false));

    await expect(resolve()).resolves.toBeNull();
    expect(t).not.toHaveBeenCalled();
  });
});
