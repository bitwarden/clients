import { Component } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, from, lastValueFrom, map } from "rxjs";
import { debounceTime, first, switchMap } from "rxjs/operators";

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import {
  ProviderStatusType,
  ProviderType,
  ProviderUserType,
} from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { ProviderOrganizationOrganizationDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-organization.response";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import {
  AvatarModule,
  DialogService,
  TableDataSource,
  TableModule,
  ToastService,
} from "@bitwarden/components";
import { SharedOrganizationModule } from "@bitwarden/web-vault/app/admin-console/organizations/shared";
import { BillingNotificationService } from "@bitwarden/web-vault/app/billing/services/billing-notification.service";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { WebProviderService } from "../../../admin-console/providers/services/web-provider.service";

import {
  AddExistingOrganizationDialogComponent,
  AddExistingOrganizationDialogResultType,
} from "./add-existing-organization-dialog.component";
import {
  CreateClientDialogResultType,
  openCreateClientDialog,
} from "./create-client-dialog.component";
import {
  ManageClientNameDialogResultType,
  openManageClientNameDialog,
} from "./manage-client-name-dialog.component";
import {
  ManageClientSubscriptionDialogResultType,
  openManageClientSubscriptionDialog,
} from "./manage-client-subscription-dialog.component";
import { NoClientsComponent } from "./no-clients.component";
import { ReplacePipe } from "./replace.pipe";

@Component({
  templateUrl: "manage-clients.component.html",
  imports: [
    AvatarModule,
    TableModule,
    HeaderModule,
    SharedOrganizationModule,
    NoClientsComponent,
    ReplacePipe,
  ],
})
export class ManageClientsComponent {
  providerId: string = "";
  provider: Provider | undefined;
  loading = true;
  isProviderAdmin = false;
  dataSource: TableDataSource<ProviderOrganizationOrganizationDetailsResponse> =
    new TableDataSource();

  protected searchControl = new FormControl("", { nonNullable: true });
  protected plans: PlanResponse[] = [];

  pageTitle = this.i18nService.t("clients");
  clientColumnHeader = this.i18nService.t("client");
  newClientButtonLabel = this.i18nService.t("newClient");

  constructor(
    private billingApiService: BillingApiServiceAbstraction,
    private providerService: ProviderService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private toastService: ToastService,
    private validationService: ValidationService,
    private webProviderService: WebProviderService,
    private billingNotificationService: BillingNotificationService,
  ) {
    this.activatedRoute.queryParams.pipe(first(), takeUntilDestroyed()).subscribe((queryParams) => {
      this.searchControl.setValue(queryParams.search);
    });

    this.activatedRoute.parent?.params
      ?.pipe(
        switchMap((params) => {
          this.providerId = params.providerId;
          return this.providerService.get$(this.providerId).pipe(
            map((provider: Provider) => provider?.providerStatus === ProviderStatusType.Billable),
            map((isBillable) => {
              if (!isBillable) {
                return from(
                  this.router.navigate(["../clients"], {
                    relativeTo: this.activatedRoute,
                  }),
                );
              } else {
                return from(this.load());
              }
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((searchText) => {
        this.dataSource.filter = (data) =>
          data.organizationName.toLowerCase().indexOf(searchText.toLowerCase()) > -1;
      });
  }

  async load() {
    try {
      this.provider = await firstValueFrom(this.providerService.get$(this.providerId));
      if (this.provider?.providerType === ProviderType.BusinessUnit) {
        this.pageTitle = this.i18nService.t("businessUnits");
        this.clientColumnHeader = this.i18nService.t("businessUnit");
        this.newClientButtonLabel = this.i18nService.t("newBusinessUnit");
      }
      this.isProviderAdmin = this.provider?.type === ProviderUserType.ProviderAdmin;
      this.dataSource.data = (
        await this.billingApiService.getProviderClientOrganizations(this.providerId)
      ).data;
      this.plans = (await this.billingApiService.getPlans()).data;
      this.loading = false;
    } catch (error) {
      this.billingNotificationService.handleError(error);
    }
  }

  addExistingOrganization = async () => {
    if (this.provider) {
      const reference = AddExistingOrganizationDialogComponent.open(this.dialogService, {
        data: {
          provider: this.provider,
        },
      });

      const result = await lastValueFrom(reference.closed);

      if (result === AddExistingOrganizationDialogResultType.Submitted) {
        await this.load();
      }
    }
  };

  createClient = async () => {
    const reference = openCreateClientDialog(this.dialogService, {
      data: {
        providerId: this.providerId,
        plans: this.plans,
      },
    });

    const result = await lastValueFrom(reference.closed);

    if (result === CreateClientDialogResultType.Submitted) {
      await this.load();
    }
  };

  manageClientName = async (organization: ProviderOrganizationOrganizationDetailsResponse) => {
    const dialogRef = openManageClientNameDialog(this.dialogService, {
      data: {
        providerId: this.providerId,
        organization: {
          id: organization.id,
          name: organization.organizationName,
          seats: organization.seats ? organization.seats : 0,
        },
      },
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (result === ManageClientNameDialogResultType.Submitted) {
      await this.load();
    }
  };

  manageClientSubscription = async (
    organization: ProviderOrganizationOrganizationDetailsResponse,
  ) => {
    const dialogRef = openManageClientSubscriptionDialog(this.dialogService, {
      data: {
        organization,
        provider: this.provider!,
      },
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (result === ManageClientSubscriptionDialogResultType.Submitted) {
      await this.load();
    }
  };

  async remove(organization: ProviderOrganizationOrganizationDetailsResponse) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: organization.organizationName,
      content: { key: "detachOrganizationConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.webProviderService.detachOrganization(this.providerId, organization.id);
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("detachedOrganization", organization.organizationName),
      });
      await this.load();
    } catch (e) {
      this.validationService.showError(e);
    }
  }
}
