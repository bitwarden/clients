// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, firstValueFrom, Observable, startWith, switchMap } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DialogService } from "@bitwarden/components";

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
  ) {}

  ngOnInit() {
    this.serviceAccounts$ = combineLatest([
      this.route.params,
      this.serviceAccountService.serviceAccount$.pipe(startWith(null)),
    ]).pipe(
      switchMap(async ([params]) => {
        this.organizationId = params.organizationId;
        const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
        this.organizationEnabled = (
          await firstValueFrom(
            this.organizationService
              .organizations$(userId)
              .pipe(getOrganizationById(params.organizationId)),
          )
        )?.enabled;

        return await this.getServiceAccounts();
      }),
    );
  }

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
