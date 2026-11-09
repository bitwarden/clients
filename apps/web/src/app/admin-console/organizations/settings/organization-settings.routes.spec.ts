import { Route } from "@angular/router";

import { IMPORT_DESTINATION_ROUTE_PATH } from "@bitwarden/importer-ui";

import { organizationSettingsRoutes } from "./organization-settings.routes";

describe("organizationSettingsRoutes import", () => {
  const tools = organizationSettingsRoutes[0].children?.find((route) => route.path === "tools");
  const importRoutes: Route[] = (tools?.children ?? []).filter((route) => route.path === "import");

  // The upgraded import is matched first, behind the feature flag; the legacy page follows it.
  const [upgraded, legacy] = importRoutes;

  it("has the upgraded import followed by the legacy one", () => {
    expect(importRoutes).toHaveLength(2);
    expect(upgraded.canMatch).toHaveLength(1);
    expect(legacy.canMatch).toBeUndefined();
  });

  it("gives the upgraded import the screens its Continue buttons go to", () => {
    // An import route with no children left Continue on the source picker with nowhere to go.
    expect((upgraded.children ?? []).map((child) => child.path)).toEqual([
      "",
      ":importType",
      IMPORT_DESTINATION_ROUTE_PATH,
    ]);
  });

  it("keeps the import behind the same permission as the legacy page", () => {
    expect(upgraded.canActivate).toHaveLength(1);
    expect(legacy.canActivate).toHaveLength(1);
  });

  it("guards the vendor and location screens against an unknown vendor", () => {
    const [, controls, destination] = upgraded.children ?? [];

    expect(controls.canActivate).toHaveLength(1);
    expect(destination.canActivate).toHaveLength(1);
  });
});
