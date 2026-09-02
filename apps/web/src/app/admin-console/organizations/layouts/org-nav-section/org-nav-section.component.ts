import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  ActivatedRoute,
  IsActiveMatchOptions,
  NavigationEnd,
  Router,
  UrlTree,
} from "@angular/router";
import { filter, map, switchMap } from "rxjs";

import {
  canAccessOrgAdmin,
  canAccessVaultTab,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  A11yTitleDirective,
  BitwardenIcon,
  defaultAvatarColors,
  IconModule,
  IconTileComponent,
  NavigationModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { All, getOrgIconForTier, getOrgTileColorForTier } from "@bitwarden/vault";

interface OrgVaultRoutes {
  allItems: UrlTree;
  sharedFolders: UrlTree;
}

interface OrgNavItemViewModel {
  id: string;
  name: string;
  enabled: boolean;
  icon: BitwardenIcon;
  /** Hex, not a palette name — matches the tiles the Password Manager nav renders. */
  color: string;
  /** The organization's own pages, for one with no vault entries to link to. */
  root: UrlTree;
  /** Absent when the user administers the organization but cannot access its vault. */
  vault?: OrgVaultRoutes;
}

/**
 * The Admin Console side-nav organization section: one group per organization the user can
 * administer, holding that organization's vault destinations.
 *
 * The Admin Console keeps its legacy vault filters for VFO1, so these link to the query params
 * those filters already read rather than driving a filter component.
 */
@Component({
  selector: "app-org-nav-section",
  templateUrl: "./org-nav-section.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [A11yTitleDirective, I18nPipe, IconModule, IconTileComponent, NavigationModule],
})
export class OrgNavSectionComponent {
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /**
   * The library default ignores query params, which would light every entry at once. A subset match
   * picks the one entry whose param is present, and tolerates `search` and `cipherId` riding along.
   */
  protected readonly filterActiveOptions: IsActiveMatchOptions = {
    paths: "subset",
    queryParams: "subset",
    fragment: "ignored",
    matrixParams: "ignored",
  };

  protected readonly organizations = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationService.organizations$(userId)),
      map((orgs) =>
        orgs
          .filter(canAccessOrgAdmin)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((org) => this.toViewModel(org)),
      ),
    ),
    { initialValue: [] as OrgNavItemViewModel[] },
  );

  protected readonly activeOrganizationId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get("organizationId"))),
  );

  private readonly queryParams = toSignal(this.route.queryParamMap);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /**
   * Reads {@link currentUrl} because `router.isActive` is not reactive, and the organization id
   * alone does not change when moving between one organization's pages.
   */
  private readonly onVaultPage = computed(() => {
    this.currentUrl();
    const organizationId = this.activeOrganizationId();
    if (organizationId == null) {
      return false;
    }
    return this.router.isActive(this.router.createUrlTree(this.vaultCommands(organizationId)), {
      paths: "exact",
      queryParams: "ignored",
      fragment: "ignored",
      matrixParams: "ignored",
    });
  });

  /**
   * Claims the two shared-folder URLs no link matches: a single folder, which is not a subset of
   * `?sharedFolderId=all`, and the unparameterised vault, where the legacy filter panel points.
   */
  protected sharedFoldersActive(org: OrgNavItemViewModel): boolean {
    if (!this.onVaultPage() || org.id !== this.activeOrganizationId()) {
      return false;
    }
    const params = this.queryParams();
    if ((params?.get("sharedFolderId") ?? params?.get("collectionId")) != null) {
      return true;
    }
    return params?.get("type") == null;
  }

  private toViewModel(org: Organization): OrgNavItemViewModel {
    return {
      id: org.id,
      name: org.name,
      enabled: org.enabled,
      icon: getOrgIconForTier(org.productTierType),
      color: defaultAvatarColors[getOrgTileColorForTier(org.productTierType)],
      root: this.router.createUrlTree(["/organizations", org.id]),
      vault: canAccessVaultTab(org)
        ? {
            allItems: this.vaultRoute(org.id, { type: All }),
            sharedFolders: this.vaultRoute(org.id, { sharedFolderId: All }),
          }
        : undefined,
    };
  }

  /** Built once per organization so `routerLink` gets a stable reference, not a new tree per pass. */
  private vaultRoute(organizationId: string, queryParams: Record<string, string>): UrlTree {
    return this.router.createUrlTree(this.vaultCommands(organizationId), { queryParams });
  }

  private vaultCommands(organizationId: string): string[] {
    return ["/organizations", organizationId, "vault"];
  }
}
