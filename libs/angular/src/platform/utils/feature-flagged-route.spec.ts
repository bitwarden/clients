import { ChangeDetectionStrategy, Component } from "@angular/core";
import { Route } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { featureFlaggedRoute } from "./feature-flagged-route";

@Component({ template: "", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush })
class DefaultComponent {}

@Component({ template: "", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush })
class FlaggedComponent {}

const guard = () => true;
const flag = FeatureFlag.VFO1Foundation;

/** `componentRouteSwap` returns the flagged route first so it's matched first. */
function split(routes: Route[]) {
  return { flagged: routes[0], fallback: routes[1] };
}

describe("featureFlaggedRoute", () => {
  it("applies the shared options to both routes", () => {
    const { flagged, fallback } = split(
      featureFlaggedRoute({
        defaultComponent: DefaultComponent,
        flaggedComponent: FlaggedComponent,
        featureFlag: flag,
        routeOptions: { path: "vault", data: { titleId: "vaults" } },
      }),
    );

    expect(flagged.component).toBe(FlaggedComponent);
    expect(flagged.data).toEqual({ titleId: "vaults" });
    expect(fallback.component).toBe(DefaultComponent);
    expect(fallback.data).toEqual({ titleId: "vaults" });
  });

  describe("flaggedRouteOptions", () => {
    // Guards and resolvers that only make sense with the flag on belong here rather than being
    // registered on both routes and re-checking the flag from the inside.
    it("replaces the shared options on the flagged route only", () => {
      const { flagged, fallback } = split(
        featureFlaggedRoute({
          defaultComponent: DefaultComponent,
          flaggedComponent: FlaggedComponent,
          featureFlag: flag,
          routeOptions: { path: "vault", data: { titleId: "vaults" } },
          flaggedRouteOptions: {
            path: "vault",
            data: { titleId: "vaults", vaultFilterScope: true },
            canActivate: [guard],
          },
        }),
      );

      expect(flagged.data).toEqual({ titleId: "vaults", vaultFilterScope: true });
      expect(flagged.canActivate).toEqual([guard]);
      expect(fallback.data).toEqual({ titleId: "vaults" });
      expect(fallback.canActivate).toBeUndefined();
    });

    it("keeps the flag's own canMatch ahead of the route's", () => {
      const ownCanMatch = () => true;
      const { flagged } = split(
        featureFlaggedRoute({
          defaultComponent: DefaultComponent,
          flaggedComponent: FlaggedComponent,
          featureFlag: flag,
          routeOptions: { path: "vault" },
          flaggedRouteOptions: { path: "vault", canMatch: [ownCanMatch] },
        }),
      );

      expect(flagged.canMatch).toHaveLength(2);
      expect(flagged.canMatch?.[1]).toBe(ownCanMatch);
    });

    it("composes with flaggedRouteProviders", () => {
      const provider = { provide: "token", useValue: 1 };
      const { flagged } = split(
        featureFlaggedRoute({
          defaultComponent: DefaultComponent,
          flaggedComponent: FlaggedComponent,
          featureFlag: flag,
          routeOptions: { path: "vault" },
          flaggedRouteOptions: { path: "vault", canActivate: [guard] },
          flaggedRouteProviders: [provider],
        }),
      );

      expect(flagged.canActivate).toEqual([guard]);
      expect(flagged.providers).toEqual([provider]);
    });
  });

  describe("scoped providers", () => {
    it("keeps default providers off the flagged route", () => {
      const defaultProvider = { provide: "legacy", useValue: 1 };
      const { flagged, fallback } = split(
        featureFlaggedRoute({
          defaultComponent: DefaultComponent,
          flaggedComponent: FlaggedComponent,
          featureFlag: flag,
          routeOptions: { path: "vault" },
          defaultRouteProviders: [defaultProvider],
        }),
      );

      expect(fallback.providers).toEqual([defaultProvider]);
      expect(flagged.providers).toBeUndefined();
    });

    it("keeps flagged providers off the default route", () => {
      const flaggedProvider = { provide: "next", useValue: 1 };
      const { flagged, fallback } = split(
        featureFlaggedRoute({
          defaultComponent: DefaultComponent,
          flaggedComponent: FlaggedComponent,
          featureFlag: flag,
          routeOptions: { path: "vault" },
          flaggedRouteProviders: [flaggedProvider],
        }),
      );

      expect(flagged.providers).toEqual([flaggedProvider]);
      expect(fallback.providers).toBeUndefined();
    });
  });
});
