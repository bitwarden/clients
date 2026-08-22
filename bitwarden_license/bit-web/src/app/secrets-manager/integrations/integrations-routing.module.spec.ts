import { Route } from "@angular/router";

import { IntegrationType } from "@bitwarden/common/enums";

import { routes } from "./integrations-routing.module";
import { SmIntegrationsTabComponent } from "./sm-integrations-tab/sm-integrations-tab.component";

describe("Secrets Manager integrations routing", () => {
  const childRoutes = routes[0].children as Route[];
  const childFor = (path: string) => childRoutes.find((r) => r.path === path);

  it("should default to the integrations tab", () => {
    const indexRoute = childFor("");

    expect(indexRoute?.pathMatch).toBe("full");
    expect(indexRoute?.redirectTo).toBe("integrations");
  });

  it("should configure the integrations tab", () => {
    const route = childFor("integrations");

    expect(route?.component).toBe(SmIntegrationsTabComponent);
    expect(route?.data).toEqual({
      integrationType: IntegrationType.Integration,
      descriptionKey: "integrationsDesc",
      tooltipKey: "smIntegrationTooltip",
      ariaKey: "smIntegrationCardAriaLabel",
    });
  });

  it("should configure the sdks tab", () => {
    const route = childFor("sdks");

    expect(route?.component).toBe(SmIntegrationsTabComponent);
    expect(route?.data).toEqual({
      integrationType: IntegrationType.SDK,
      descriptionKey: "sdksDesc",
      tooltipKey: "smSdkTooltip",
      ariaKey: "smSdkAriaLabel",
    });
  });
});
