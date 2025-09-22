// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { ActivatedRoute, NavigationEnd, NavigationStart, ParamMap, Router } from "@angular/router";
import { combineLatest, filter, map, Observable, ReplaySubject, startWith, switchMap } from "rxjs";

import {
  canAccessOrgAdmin,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { PolicyType, ProviderType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";

export type ProductSwitcherItem = {
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
  marketingRoute?: {
    route: string | any[];
    external: boolean;
  };
  /**
   * Route definition for external/internal routes for items in the `otherProducts$` section
   */

  /**
   * Used to apply css styles to show when a button is selected
   */
  isActive?: boolean;

  /**
   * A product switcher item can be shown in the left navigation menu.
   * When shown under the "other" section the content can be overridden.
   */
  otherProductOverrides?: {
    /** Alternative navigation menu name */
    name?: string;
    /** Supporting text that is shown when the product is rendered in the "other" section */
    supportingText?: string;
  };
};

@Injectable({
  providedIn: "root",
})
export class ProductSwitcherService {
  /**
   * Emits when the sync service has completed a sync
   *
   * Without waiting for a sync to be complete, in accurate product information
   * can be displayed to the user for a brief moment until the sync is complete
   * and all data is available.
   */
  private syncCompleted$ = new ReplaySubject<void>(1);

  /**
   * Certain events should trigger an update to the `products$` observable but the values
   * themselves are not needed. This observable is used to only trigger the update.
   */
  private triggerProductUpdate$: Observable<void> = combineLatest([
    this.syncCompleted$,
    this.router.events.pipe(
      // Product paths need to be updated when routes change, but the router event isn't actually needed
      startWith(null), // Start with a null event to trigger the initial combineLatest
      filter((e) => e instanceof NavigationEnd || e instanceof NavigationStart || e === null),
    ),
  ]).pipe(map(() => null));

  constructor(
    private organizationService: OrganizationService,
    private providerService: ProviderService,
    private route: ActivatedRoute,
    private router: Router,
    private syncService: SyncService,
    private accountService: AccountService,
    private platformUtilsService: PlatformUtilsService,
    private policyService: PolicyService,
    private i18nService: I18nService,
  ) {
    this.pollUntilSynced();
  }

  organizations$ = this.accountService.activeAccount$.pipe(
    map((a) => a?.id),
    switchMap((id) => this.organizationService.organizations$(id)),
  );

  providers$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((id) => this.providerService.providers$(id)),
  );

  userHasSingleOrgPolicy$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.policyService.policyAppliesToUser$(PolicyType.SingleOrg, userId)),
  );

  products$: Observable<{
    bento: ProductSwitcherItem[];
    other: ProductSwitcherItem[];
  }> = combineLatest([
    this.organizations$,
    this.providers$,
    this.userHasSingleOrgPolicy$,
    this.route.paramMap,
    this.triggerProductUpdate$,
  ]).pipe(
    map(
      ([orgs, providers, userHasSingleOrgPolicy, paramMap]: [
        Organization[],
        Provider[],
        boolean,
        ParamMap,
        void,
      ]) => {
        // Sort orgs by name to match the order within the sidebar
        orgs.sort((a, b) => a.name.localeCompare(b.name));

        let routeOrg = orgs.find((o) => o.id === paramMap.get("organizationId"));

        let organizationIdViaPath: string | null = null;

        if (["/sm/", "/organizations/"].some((path) => this.router.url.includes(path))) {
          // Grab the organization ID from the URL
          organizationIdViaPath = this.router.url.split("/")[2] ?? null;
        }

        // When the user is already viewing an organization within an application use it as the active route org
        if (organizationIdViaPath && !routeOrg) {
          routeOrg = orgs.find((o) => o.id === organizationIdViaPath);
        }

        // If the active route org doesn't have access to SM, find the first org that does.
        const smOrg =
          routeOrg?.canAccessSecretsManager && routeOrg?.enabled == true
            ? routeOrg
            : orgs.find((o) => o.canAccessSecretsManager && o.enabled == true);

        // If the active route org doesn't have access to AC, find the first org that does.
        const acOrg =
          routeOrg != null && canAccessOrgAdmin(routeOrg)
            ? routeOrg
            : orgs.find((o) => canAccessOrgAdmin(o));

        const providerPortalName =
          providers[0]?.providerType === ProviderType.BusinessUnit
            ? "Business Unit Portal"
            : "Provider Portal";

        const orgsMarketingRoute = this.platformUtilsService.isSelfHost()
          ? {
              route: "https://bitwarden.com/products/business/",
              external: true,
            }
          : {
              route: "/create-organization",
              external: false,
            };

        const products = {
          pm: {
            name: "Password Manager",
            icon: "bwi-lock",
            appRoute: "/vault",
            marketingRoute: {
              route: "https://bitwarden.com/products/personal/",
              external: true,
            },
            isActive:
              !this.router.url.includes("/sm/") &&
              !this.router.url.includes("/organizations/") &&
              !this.router.url.includes("/providers/"),
          },
          sm: {
            name: "Secrets Manager",
            icon: "bwi-cli",
            appRoute: ["/sm", smOrg?.id],
            marketingRoute: {
              route: "/sm-landing",
              external: false,
            },
            isActive: this.router.url.includes("/sm/"),
            otherProductOverrides: {
              supportingText: this.i18nService.t("secureYourInfrastructure"),
            },
          },
          ac: {
            name: "Admin Console",
            icon: "bwi-business",
            appRoute: ["/organizations", acOrg?.id],
            marketingRoute: {
              route: "https://bitwarden.com/products/business/",
              external: true,
            },
            isActive: this.router.url.includes("/organizations/"),
          },
          provider: {
            name: providerPortalName,
            icon: "bwi-provider",
            appRoute: ["/providers", providers[0]?.id],
            isActive: this.router.url.includes("/providers/"),
          },
          orgs: {
            name: "Organizations",
            icon: "bwi-business",
            marketingRoute: orgsMarketingRoute,
            otherProductOverrides: {
              name: "Share your passwords",
              supportingText: this.i18nService.t("protectYourFamilyOrBusiness"),
            },
          },
        } satisfies Record<string, ProductSwitcherItem>;

        const bento: ProductSwitcherItem[] = [products.pm];
        const other: ProductSwitcherItem[] = [];

        if (smOrg) {
          bento.push(products.sm);
        } else {
          other.push(products.sm);
        }

        if (acOrg) {
          bento.push(products.ac);
        } else {
          if (!userHasSingleOrgPolicy) {
            other.push(products.orgs);
          }
        }

        if (providers.length > 0) {
          bento.push(products.provider);
        }

        return {
          bento,
          other,
        };
      },
    ),
  );

  /** Poll the `syncService` until a sync is completed */
  private pollUntilSynced() {
    const interval = setInterval(async () => {
      const lastSync = await this.syncService.getLastSync();
      if (lastSync !== null) {
        clearInterval(interval);
        this.syncCompleted$.next();
      }
    }, 200);
  }
}
