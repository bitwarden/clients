import { Component, ViewChild } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, map } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { MenuComponent } from "@bitwarden/components";

type ProductSwitcherItem = {
  /**
   * Displayed name
   */
  name: string;

  /**
   * Displayed icon
   */
  icon: string;

  /**
   * Route for items in the `bentoProducts$` section
   */
  appRoute?: string | any[];

  /**
   * Route for items in the `otherProducts$` section
   */
  marketingRoute?: string | any[];

  /**
   * Used to apply css styles to show when a button is selected
   */
  isActive?: boolean;
};

@Component({
  selector: "product-switcher-content",
  templateUrl: "./product-switcher-content.component.html",
})
export class ProductSwitcherContentComponent {
  @ViewChild("menu")
  menu: MenuComponent;

  protected products$ = combineLatest([
    this.organizationService.organizations$,
    this.route.paramMap,
  ]).pipe(
    map(([orgs, paramMap]) => {
      const routeOrg = orgs.find((o) => o.id === paramMap.get("organizationId"));
      // If the active route org doesn't have access to SM, find the first org that does.
      const smOrg = routeOrg?.canAccessSecretsManager
        ? routeOrg
        : orgs.find((o) => o.canAccessSecretsManager);

      /**
       * We can update this to the "satisfies" type upon upgrading to TypeScript 4.9
       * https://devblogs.microsoft.com/typescript/announcing-typescript-4-9/#satisfies
       */
      const products: Record<"pm" | "sm" | "orgs", ProductSwitcherItem> = {
        pm: {
          name: "Password Manager",
          icon: "bwi-lock",
          appRoute: "/vault",
          marketingRoute: "https://bitwarden.com/products/personal/",
          isActive: !this.router.url.includes("/sm/"),
        },
        sm: {
          name: "Secrets Manager",
          icon: "bwi-cli",
          appRoute: ["/sm", smOrg?.id],
          marketingRoute: "https://bitwarden.com/products/secrets-manager/",
          isActive: this.router.url.includes("/sm/"),
        },
        orgs: {
          name: "Organizations",
          icon: "bwi-business",
          marketingRoute: "https://bitwarden.com/products/business/",
        },
      };

      const bento: ProductSwitcherItem[] = [products.pm];
      const other: ProductSwitcherItem[] = [];

      if (orgs.length === 0) {
        other.push(products.orgs);
      }

      if (smOrg) {
        bento.push(products.sm);
      } else {
        other.push(products.sm);
      }

      return {
        bento,
        other,
      };
    })
  );

  constructor(
    private organizationService: OrganizationService,
    private route: ActivatedRoute,
    private router: Router
  ) {}
}
