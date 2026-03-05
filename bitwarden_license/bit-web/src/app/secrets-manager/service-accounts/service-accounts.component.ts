// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatestWith, firstValueFrom, Observable, startWith, switchMap } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/admin-console/organizations/manage/entity-events.component";

import {
  ServiceAccountSecretsDetailsView,
  ServiceAccountView,
} from "../models/view/service-account.view";

import {
  ServiceAccountDeleteDialogComponent,
  ServiceAccountDeleteOperation,
} from "./dialog/service-account-delete-dialog.component";
import {
  OperationType,
  ServiceAccountDialogComponent,
  ServiceAccountOperation,
} from "./dialog/service-account-dialog.component";
import { ServiceAccountService } from "./service-account.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "sm-service-accounts",
  templateUrl: "./service-accounts.component.html",
  standalone: false,
})
export class ServiceAccountsComponent implements OnInit {
  protected serviceAccounts$: Observable<ServiceAccountSecretsDetailsView[]>;
  protected search: string;

  private organizationId: string;
  private organizationEnabled: boolean;

  constructor(
    private route: ActivatedRoute,
    private dialogService: DialogService,
    private serviceAccountService: ServiceAccountService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private toastService: ToastService,
    private router: Router,
    private i18nService: I18nService,
  ) {}

  ngOnInit() {
    this.serviceAccounts$ = this.serviceAccountService.serviceAccount$.pipe(
      startWith(null),
      combineLatestWith(this.route.params),
      switchMap(async ([_, params]) => {
        this.organizationId = params.organizationId;
        const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
        this.organizationEnabled = (
          await firstValueFrom(
            this.organizationService
              .organizations$(userId)
              .pipe(getOrganizationById(params.organizationId)),
          )
        )?.enabled;

        const serviceAccounts = await this.getServiceAccounts();

        const viewEvents = this.route.snapshot.queryParams.viewEvents;
        if (viewEvents) {
          const targetAccount = serviceAccounts.find((sa) => sa.id === viewEvents);

          const userIsAdmin = (
            await firstValueFrom(
              this.organizationService
                .organizations$(userId)
                .pipe(getOrganizationById(params.organizationId)),
            )
          )?.isAdmin;

          if (!targetAccount) {
            if (userIsAdmin) {
              this.openEventsDialogByEntityId(
                this.i18nService.t("nameUnavailableServiceAccountDeleted", viewEvents),
                viewEvents,
              );
            } else {
              this.toastService.showToast({
                variant: "error",
                title: null,
                message: this.i18nService.t("unknownServiceAccount"),
              });
            }
          } else {
            this.openEventsDialog(targetAccount);
          }

          await this.router.navigate([], {
            queryParams: { search: this.search },
          });
        }

        return serviceAccounts;
      }),
    );

    if (this.route.snapshot.queryParams.search) {
      this.search = this.route.snapshot.queryParams.search;
    }
  }

  openEventsDialogByEntityId = (
    serviceAccountName: string,
    serviceAccountId: string,
  ): DialogRef<void> =>
    openEntityEventsDialog(this.dialogService, {
      data: {
        name: serviceAccountName,
        organizationId: this.organizationId,
        entityId: serviceAccountId,
        entity: "service-account",
      },
    });

  openEventsDialog = (serviceAccount: ServiceAccountView): DialogRef<void> =>
    openEntityEventsDialog(this.dialogService, {
      data: {
        name: serviceAccount.name,
        organizationId: this.organizationId,
        entityId: serviceAccount.id,
        entity: "service-account",
      },
    });

  openNewServiceAccountDialog() {
    this.dialogService.open<unknown, ServiceAccountOperation>(ServiceAccountDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Add,
        organizationEnabled: this.organizationEnabled,
      },
    });
  }

  openEditServiceAccountDialog(serviceAccountId: string) {
    this.dialogService.open<unknown, ServiceAccountOperation>(ServiceAccountDialogComponent, {
      data: {
        organizationId: this.organizationId,
        serviceAccountId: serviceAccountId,
        operation: OperationType.Edit,
        organizationEnabled: this.organizationEnabled,
      },
    });
  }

  openDeleteDialog(event: ServiceAccountView[]) {
    this.dialogService.open<unknown, ServiceAccountDeleteOperation>(
      ServiceAccountDeleteDialogComponent,
      {
        data: {
          serviceAccounts: event,
        },
      },
    );
  }

  private async getServiceAccounts(): Promise<ServiceAccountSecretsDetailsView[]> {
    return await this.serviceAccountService.getServiceAccounts(this.organizationId, true);
  }
}
