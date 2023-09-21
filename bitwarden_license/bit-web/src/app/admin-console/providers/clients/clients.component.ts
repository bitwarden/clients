import { Component, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { first } from "rxjs/operators";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProviderOrganizationOrganizationDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-organization.response";
import { PlanType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogService } from "@bitwarden/components";

import { WebProviderService } from "../services/web-provider.service";

import { AddOrganizationComponent } from "./add-organization.component";

const DisallowedPlanTypes = [
  PlanType.Free,
  PlanType.FamiliesAnnually2019,
  PlanType.FamiliesAnnually,
];

@Component({
  templateUrl: "clients.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class ClientsComponent implements OnInit {
  @ViewChild("add", { read: ViewContainerRef, static: true }) addModalRef: ViewContainerRef;

  providerId: string;
  searchText: string;
  addableOrganizations: Organization[];
  loading = true;
  manageOrganizations = false;
  showAddExisting = false;

  clients: ProviderOrganizationOrganizationDetailsResponse[];
  pagedClients: ProviderOrganizationOrganizationDetailsResponse[];

  protected didScroll = false;
  protected pageSize = 100;
  protected actionPromise: Promise<unknown>;
  private pagedClientsCount = 0;

  constructor(
    private route: ActivatedRoute,
    private providerService: ProviderService,
    private apiService: ApiService,
    private searchService: SearchService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private validationService: ValidationService,
    private webProviderService: WebProviderService,
    private logService: LogService,
    private modalService: ModalService,
    private organizationService: OrganizationService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private dialogService: DialogService
  ) {}

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.parent.params.subscribe(async (params) => {
      this.providerId = params.providerId;

      await this.load();

      /* eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe, rxjs/no-nested-subscribe */
      this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
        this.searchText = qParams.search;
      });
    });
  }

  async load() {
    const response = await this.apiService.getProviderClients(this.providerId);
    this.clients = response.data != null && response.data.length > 0 ? response.data : [];
    this.manageOrganizations =
      (await this.providerService.get(this.providerId)).type === ProviderUserType.ProviderAdmin;
    const candidateOrgs = (await this.organizationService.getAll()).filter(
      (o) => o.isOwner && o.providerId == null
    );
    const allowedOrgsIds = await Promise.all(
      candidateOrgs.map((o) => this.organizationApiService.get(o.id))
    ).then((orgs) =>
      orgs.filter((o) => !DisallowedPlanTypes.includes(o.planType)).map((o) => o.id)
    );
    this.addableOrganizations = candidateOrgs.filter((o) => allowedOrgsIds.includes(o.id));

    this.showAddExisting = this.addableOrganizations.length !== 0;
    this.loading = false;
  }

  isPaging() {
    const searching = this.isSearching();
    if (searching && this.didScroll) {
      this.resetPaging();
    }
    return !searching && this.clients && this.clients.length > this.pageSize;
  }

  isSearching() {
    return this.searchService.isSearchable(this.searchText);
  }

  async resetPaging() {
    this.pagedClients = [];
    this.loadMore();
  }

  loadMore() {
    if (!this.clients || this.clients.length <= this.pageSize) {
      return;
    }
    const pagedLength = this.pagedClients.length;
    let pagedSize = this.pageSize;
    if (pagedLength === 0 && this.pagedClientsCount > this.pageSize) {
      pagedSize = this.pagedClientsCount;
    }
    if (this.clients.length > pagedLength) {
      this.pagedClients = this.pagedClients.concat(
        this.clients.slice(pagedLength, pagedLength + pagedSize)
      );
    }
    this.pagedClientsCount = this.pagedClients.length;
    this.didScroll = this.pagedClients.length > this.pageSize;
  }

  async addExistingOrganization() {
    const [modal] = await this.modalService.openViewRef(
      AddOrganizationComponent,
      this.addModalRef,
      (comp) => {
        comp.providerId = this.providerId;
        comp.organizations = this.addableOrganizations;
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onAddedOrganization.subscribe(async () => {
          try {
            await this.load();
            modal.close();
          } catch (e) {
            this.logService.error(`Handled exception: ${e}`);
          }
        });
      }
    );
  }

  async remove(organization: ProviderOrganizationOrganizationDetailsResponse) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: organization.organizationName,
      content: { key: "detachOrganizationConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    this.actionPromise = this.webProviderService.detachOrganization(
      this.providerId,
      organization.id
    );
    try {
      await this.actionPromise;
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("detachedOrganization", organization.organizationName)
      );
      await this.load();
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = null;
  }
}
