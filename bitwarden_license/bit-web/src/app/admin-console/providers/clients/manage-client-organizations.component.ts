import { SelectionModel } from "@angular/cdk/collections";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { first } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { ProviderOrganizationOrganizationDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-organization.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogService, TableDataSource } from "@bitwarden/components";

import { WebProviderService } from "../services/web-provider.service";

import { ManageClientOrganizationSubscriptionComponent } from "./manage-client-organization-subscription.component";

@Component({
  templateUrl: "manage-client-organizations.component.html",
})

// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class ManageClientOrganizationsComponent implements OnInit {
  providerId: string;
  assignedSeats: number;
  unassignedSeats: number;
  loading = true;
  manageOrganizations = false;

  set searchText(search: string) {
    this.selection.clear();
    this.dataSource.filter = search;
  }

  clients: ProviderOrganizationOrganizationDetailsResponse[];
  pagedClients: ProviderOrganizationOrganizationDetailsResponse[];

  protected didScroll = false;
  protected pageSize = 100;
  protected actionPromise: Promise<unknown>;
  private pagedClientsCount = 0;
  selection = new SelectionModel<string>(true, []);
  protected dataSource = new TableDataSource<ProviderOrganizationOrganizationDetailsResponse>();

  constructor(
    private route: ActivatedRoute,
    private providerService: ProviderService,
    private apiService: ApiService,
    private searchService: SearchService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private validationService: ValidationService,
    private webProviderService: WebProviderService,
    private dialogService: DialogService,
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
    this.dataSource.data = this.clients;
    this.manageOrganizations =
      (await this.providerService.get(this.providerId)).type === ProviderUserType.ProviderAdmin;

    this.loading = false;
  }

  getProviderAssignedSeats(clients: ProviderOrganizationOrganizationDetailsResponse[]) {
    this.assignedSeats = clients.reduce(
      (total: number, client: ProviderOrganizationOrganizationDetailsResponse) =>
        total + client.seats,
      0,
    );
  }

  getProviderUnassignedSeats(clients: ProviderOrganizationOrganizationDetailsResponse[]) {
    this.unassignedSeats = clients.reduce(
      (total: number, client: ProviderOrganizationOrganizationDetailsResponse) =>
        total + client.userCount,
      0,
    );
  }

  isPaging() {
    const searching = this.isSearching();
    if (searching && this.didScroll) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
        this.clients.slice(pagedLength, pagedLength + pagedSize),
      );
    }
    this.pagedClientsCount = this.pagedClients.length;
    this.didScroll = this.pagedClients.length > this.pageSize;
  }

  async manageSubscription(organization: ProviderOrganizationOrganizationDetailsResponse) {
    if (organization == null) {
      return;
    }

    this.getProviderAssignedSeats(this.clients);
    this.getProviderUnassignedSeats(this.clients);
    const dialogRef = ManageClientOrganizationSubscriptionComponent.open(this.dialogService, {
      organizationId: organization.id,
      providerId: organization.providerId,
      clientName: organization.organizationName,
      assignedSeats: this.assignedSeats,
      unassignedSeats: this.assignedSeats - this.unassignedSeats,
    });

    await firstValueFrom(dialogRef.closed);
    await this.load();
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
      organization.id,
    );
    try {
      await this.actionPromise;
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("detachedOrganization", organization.organizationName),
      );
      await this.load();
    } catch (e) {
      this.validationService.showError(e);
    }
    this.actionPromise = null;
  }
}
