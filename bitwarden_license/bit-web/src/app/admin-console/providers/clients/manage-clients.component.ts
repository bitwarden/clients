import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import {
  firstValueFrom,
  lastValueFrom,
  map,
  combineLatest,
  switchMap,
  Observable,
  Subject,
  takeUntil,
} from "rxjs";
import { debounceTime, first } from "rxjs/operators";

import { ProviderApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/provider/provider-api.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderType, ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { ProviderOrganizationOrganizationDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-organization.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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

import {
  CreateClientDialogResultType,
  openCreateClientDialog,
} from "../../../billing/providers/clients/create-client-dialog.component";
import {
  ManageClientSubscriptionDialogResultType,
  openManageClientSubscriptionDialog,
} from "../../../billing/providers/clients/manage-client-subscription-dialog.component";
import { WebProviderService } from "../services/web-provider.service";

import {
  AddExistingOrganizationDialogComponent,
  AddExistingOrganizationDialogResultType,
} from "./add-existing-organization-dialog.component";
import {
  ManageClientNameDialogResultType,
  openManageClientNameDialog,
} from "./manage-client-name-dialog.component";
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
export class ManageClientsComponent implements OnInit, OnDestroy {
  loading = true;
  dataSource: TableDataSource<ProviderOrganizationOrganizationDetailsResponse> =
    new TableDataSource();

  protected searchControl = new FormControl("", { nonNullable: true });
  protected plans: PlanResponse[] = [];
  protected ProviderUserType = ProviderUserType;

  pageTitle = this.i18nService.t("clients");
  clientColumnHeader = this.i18nService.t("client");
  newClientButtonLabel = this.i18nService.t("newClient");

  protected providerId$: Observable<string> =
    this.activatedRoute.parent?.params.pipe(map((params) => params.providerId as string)) ??
    new Observable();

  protected provider$ = combineLatest([
    this.providerId$,
    this.accountService.activeAccount$.pipe(getUserId),
  ]).pipe(switchMap(([providerId, userId]) => this.providerService.get$(providerId, userId)));

  protected isAdminOrServiceUser$ = this.provider$.pipe(
    map(
      (provider) =>
        provider?.type === ProviderUserType.ProviderAdmin ||
        provider?.type === ProviderUserType.ServiceUser,
    ),
  );

  protected providerPortalTakeover$ = this.configService.getFeatureFlag$(
    FeatureFlag.PM21821_ProviderPortalTakeover,
  );

  protected suspensionActive$ = combineLatest([
    this.isAdminOrServiceUser$,
    this.providerPortalTakeover$,
    this.provider$.pipe(map((provider) => provider?.enabled ?? false)),
  ]).pipe(
    map(
      ([isAdminOrServiceUser, portalTakeoverEnabled, providerEnabled]) =>
        isAdminOrServiceUser && portalTakeoverEnabled && !providerEnabled,
    ),
  );

  private destroy$ = new Subject<void>();

  constructor(
    private billingApiService: BillingApiServiceAbstraction,
    private providerService: ProviderService,
    private activatedRoute: ActivatedRoute,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private toastService: ToastService,
    private validationService: ValidationService,
    private webProviderService: WebProviderService,
    private billingNotificationService: BillingNotificationService,
    private configService: ConfigService,
    private accountService: AccountService,
    private providerApiService: ProviderApiServiceAbstraction,
  ) {}

  async ngOnInit() {
    this.activatedRoute.queryParams
      .pipe(first(), takeUntil(this.destroy$))
      .subscribe((queryParams) => {
        this.searchControl.setValue(queryParams.search);
      });

    await this.load();

    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntil(this.destroy$))
      .subscribe((searchText) => {
        this.dataSource.filter = (data) =>
          data.organizationName.toLowerCase().indexOf(searchText.toLowerCase()) > -1;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async load() {
    try {
      const providerId = await firstValueFrom(this.providerId$);
      const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
      const provider = await firstValueFrom(this.providerService.get$(providerId, userId));
      if (provider?.providerType === ProviderType.BusinessUnit) {
        this.pageTitle = this.i18nService.t("businessUnits");
        this.clientColumnHeader = this.i18nService.t("businessUnit");
        this.newClientButtonLabel = this.i18nService.t("newBusinessUnit");
      }
      this.dataSource.data = (
        await this.providerApiService.getProviderOrganizations(providerId)
      ).data;
      this.plans = (await this.billingApiService.getPlans()).data;
      this.loading = false;
    } catch (error) {
      this.billingNotificationService.handleError(error);
    }
  }

  addExistingOrganization = async () => {
    const provider = await firstValueFrom(this.provider$);
    if (provider) {
      const reference = AddExistingOrganizationDialogComponent.open(this.dialogService, {
        data: {
          provider: provider,
        },
      });

      const result = await lastValueFrom(reference.closed);

      if (result === AddExistingOrganizationDialogResultType.Submitted) {
        await this.load();
      }
    }
  };

  createClient = async () => {
    const providerId = await firstValueFrom(this.providerId$);
    const reference = openCreateClientDialog(this.dialogService, {
      data: {
        providerId: providerId,
        plans: this.plans,
      },
    });

    const result = await lastValueFrom(reference.closed);

    if (result === CreateClientDialogResultType.Submitted) {
      await this.load();
    }
  };

  manageClientName = async (organization: ProviderOrganizationOrganizationDetailsResponse) => {
    const providerId = await firstValueFrom(this.providerId$);
    const dialogRef = openManageClientNameDialog(this.dialogService, {
      data: {
        providerId: providerId,
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
    const provider = await firstValueFrom(this.provider$);
    const dialogRef = openManageClientSubscriptionDialog(this.dialogService, {
      data: {
        organization,
        provider: provider!,
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
      const providerId = await firstValueFrom(this.providerId$);
      await this.webProviderService.detachOrganization(providerId, organization.id);
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
