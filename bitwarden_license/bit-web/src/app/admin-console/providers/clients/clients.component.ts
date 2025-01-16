// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, from, map } from "rxjs";
import { switchMap, takeUntil } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderStatusType, ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { PlanType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { WebProviderService } from "../services/web-provider.service";

import { AddOrganizationComponent } from "./add-organization.component";
import { BaseClientsComponent } from "./base-clients.component";

const DisallowedPlanTypes = [
  PlanType.Free,
  PlanType.FamiliesAnnually2019,
  PlanType.FamiliesAnnually,
  PlanType.TeamsStarter2023,
  PlanType.TeamsStarter,
];

@Component({
  templateUrl: "clients.component.html",
})
export class ClientsComponent extends BaseClientsComponent implements OnInit, OnDestroy {
  providerId: string;
  addableOrganizations: Organization[];
  loading = true;
  manageOrganizations = false;
  showAddExisting = false;

  constructor(
    private router: Router,
    private providerService: ProviderService,
    private apiService: ApiService,
    private organizationService: OrganizationService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    activatedRoute: ActivatedRoute,
    dialogService: DialogService,
    i18nService: I18nService,
    searchService: SearchService,
    toastService: ToastService,
    validationService: ValidationService,
    webProviderService: WebProviderService,
  ) {
    super(
      activatedRoute,
      dialogService,
      i18nService,
      searchService,
      toastService,
      validationService,
      webProviderService,
    );
  }

  ngOnInit() {
    this.activatedRoute.parent.params
      .pipe(
        switchMap((params) => {
          this.providerId = params.providerId;
          return this.providerService.get$(this.providerId).pipe(
            map((provider) => provider?.providerStatus === ProviderStatusType.Billable),
            map((isBillable) => {
              if (isBillable) {
                return from(
                  this.router.navigate(["../manage-client-organizations"], {
                    relativeTo: this.activatedRoute,
                  }),
                );
              } else {
                return from(this.load());
              }
            }),
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }

  async load() {
    const response = await this.apiService.getProviderClients(this.providerId);
    this.clients = response.data != null && response.data.length > 0 ? response.data : [];
    this.manageOrganizations =
      (await this.providerService.get(this.providerId)).type === ProviderUserType.ProviderAdmin;
    const candidateOrgs = (await this.organizationService.getAll()).filter(
      (o) => o.isOwner && o.providerId == null,
    );
    const allowedOrgsIds = await Promise.all(
      candidateOrgs.map((o) => this.organizationApiService.get(o.id)),
    ).then((orgs) =>
      orgs.filter((o) => !DisallowedPlanTypes.includes(o.planType)).map((o) => o.id),
    );
    this.addableOrganizations = candidateOrgs.filter((o) => allowedOrgsIds.includes(o.id));

    this.showAddExisting = this.addableOrganizations.length !== 0;
    this.loading = false;
  }

  async addExistingOrganization() {
    const dialogRef = AddOrganizationComponent.open(this.dialogService, {
      providerId: this.providerId,
      organizations: this.addableOrganizations,
    });

    if (await firstValueFrom(dialogRef.closed)) {
      await this.load();
    }
  }
}
