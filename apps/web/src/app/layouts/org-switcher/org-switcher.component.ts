import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, map, Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import type { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, NavigationModule } from "@bitwarden/components";

import { TrialFlowService } from "../../core/trial-flow.service";

@Component({
  selector: "org-switcher",
  templateUrl: "org-switcher.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, NavigationModule],
})
export class OrgSwitcherComponent {
  protected organizations$: Observable<Organization[]> =
    this.organizationService.organizations$.pipe(
      map((orgs) =>
        orgs.filter((org) => this.filter(org)).sort((a, b) => a.name.localeCompare(b.name)),
      ),
    );

  protected activeOrganization$: Observable<Organization> = combineLatest([
    this.route.paramMap,
    this.organizations$,
  ]).pipe(map(([params, orgs]) => orgs.find((org) => org.id === params.get("organizationId"))));

  /**
   * Filter function for displayed organizations in the `org-switcher`
   * @example
   * const smFilter = (org: Organization) => org.canAccessSecretsManager
   * // <org-switcher [filter]="smFilter">
   */
  @Input()
  filter: (org: Organization) => boolean = () => true;

  /**
   * Is `true` if the expanded content is visible
   */
  @Input()
  open = false;
  @Output()
  openChange = new EventEmitter<boolean>();

  /**
   * Visibility of the New Organization button
   */
  @Input()
  hideNewButton = false;

  constructor(
    private route: ActivatedRoute,
    protected dialogService: DialogService,
    private organizationService: OrganizationService,
    private i18nService: I18nService,
    private router: Router,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private trialFlowService: TrialFlowService,
  ) {}

  protected toggle(event?: MouseEvent) {
    event?.stopPropagation();
    this.open = !this.open;
    this.openChange.emit(this.open);
  }

  async handleUnpaidSubscription(org: Organization) {
    const sub = await this.organizationApiService.getSubscription(org.id);
    await this.trialFlowService.handleUnpaidSubscriptionDialog(org, sub);
  }
}
