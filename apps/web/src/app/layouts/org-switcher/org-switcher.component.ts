// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, map, Observable, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import type { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions/billing-api.service.abstraction";
import { DialogService, NavigationModule } from "@bitwarden/components";

import { TrialFlowService } from "./../../billing/services/trial-flow.service";

@Component({
  selector: "org-switcher",
  templateUrl: "org-switcher.component.html",
  imports: [CommonModule, JslibModule, NavigationModule],
})
export class OrgSwitcherComponent {
  protected organizations$: Observable<Organization[]> = this.accountService.activeAccount$.pipe(
    switchMap((account) =>
      this.organizationService
        .organizations$(account?.id)
        .pipe(
          map((orgs) =>
            orgs.filter((org) => this.filter(org)).sort((a, b) => a.name.localeCompare(b.name)),
          ),
        ),
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
    private trialFlowService: TrialFlowService,
    protected billingApiService: BillingApiServiceAbstraction,
    private accountService: AccountService,
  ) {}

  protected toggle(event?: MouseEvent) {
    event?.stopPropagation();
    this.open = !this.open;
    this.openChange.emit(this.open);
  }

  async handleUnpaidSubscription(org: Organization) {
    const metaData = await this.billingApiService.getOrganizationBillingMetadata(org.id);
    await this.trialFlowService.handleUnpaidSubscriptionDialog(org, metaData);
  }
}
