import { ActivatedRoute } from "@angular/router";
import { of } from "rxjs";

import { InitiationPath, ProductType } from "@bitwarden/common/billing/enums";

import { CreateOrganizationComponent } from "./create-organization.component";

describe("CreateOrganizationComponent", () => {
  function createComponent(queryParams: Record<string, unknown>): CreateOrganizationComponent {
    const route = { queryParams: of(queryParams) } as unknown as ActivatedRoute;
    return new CreateOrganizationComponent(route);
  }

  describe("initiationPath derivation from the product query param", () => {
    it("marks a Password Manager marketing trial when the product param is Password Manager", () => {
      const component = createComponent({ product: `${ProductType.PasswordManager}` });

      component.ngOnInit();

      expect(component["initiationPath"]).toBe(
        InitiationPath.PasswordManagerTrialFromMarketingWebsite,
      );
    });

    it("marks a Secrets Manager marketing trial when the product param is Secrets Manager", () => {
      const component = createComponent({ product: `${ProductType.SecretsManager}` });

      component.ngOnInit();

      expect(component["initiationPath"]).toBe(
        InitiationPath.SecretsManagerTrialFromMarketingWebsite,
      );
    });

    it("stays in-product when no product param is present", () => {
      const component = createComponent({ plan: "teams" });

      component.ngOnInit();

      expect(component["initiationPath"]).toBe(InitiationPath.NewOrganizationCreationInProduct);
    });
  });
});
