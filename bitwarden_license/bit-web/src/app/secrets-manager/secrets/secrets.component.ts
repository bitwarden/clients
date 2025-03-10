// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { combineLatestWith, firstValueFrom, Observable, startWith, switchMap } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

import { SecretListView } from "../models/view/secret-list.view";
import { SecretsListComponent } from "../shared/secrets-list.component";

import {
  SecretDeleteDialogComponent,
  SecretDeleteOperation,
} from "./dialog/secret-delete.component";
import {
  OperationType,
  SecretDialogComponent,
  SecretOperation,
} from "./dialog/secret-dialog.component";
import {
  SecretViewDialogComponent,
  SecretViewDialogParams,
} from "./dialog/secret-view-dialog.component";
import { SecretService } from "./secret.service";

@Component({
  selector: "sm-secrets",
  templateUrl: "./secrets.component.html",
})
export class SecretsComponent implements OnInit {
  protected secrets$: Observable<SecretListView[]>;
  protected search: string;

  private organizationId: string;
  private organizationEnabled: boolean;

  constructor(
    private route: ActivatedRoute,
    private secretService: SecretService,
    private dialogService: DialogService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private logService: LogService,
  ) {}

  ngOnInit() {
    this.secrets$ = this.secretService.secret$.pipe(
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

        return await this.getSecrets();
      }),
    );

    if (this.route.snapshot.queryParams.search) {
      this.search = this.route.snapshot.queryParams.search;
    }
  }

  private async getSecrets(): Promise<SecretListView[]> {
    return await this.secretService.getSecrets(this.organizationId);
  }

  openEditSecret(secretId: string) {
    this.dialogService.open<unknown, SecretOperation>(SecretDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Edit,
        secretId: secretId,
        organizationEnabled: this.organizationEnabled,
      },
    });
  }

  openViewSecret(secretId: string) {
    this.dialogService.open<unknown, SecretViewDialogParams>(SecretViewDialogComponent, {
      data: {
        organizationId: this.organizationId,
        secretId: secretId,
      },
    });
  }

  openDeleteSecret(event: SecretListView[]) {
    this.dialogService.open<unknown, SecretDeleteOperation>(SecretDeleteDialogComponent, {
      data: {
        secrets: event,
      },
    });
  }

  openNewSecretDialog() {
    this.dialogService.open<unknown, SecretOperation>(SecretDialogComponent, {
      data: {
        organizationId: this.organizationId,
        operation: OperationType.Add,
        organizationEnabled: this.organizationEnabled,
      },
    });
  }

  copySecretName(name: string) {
    SecretsListComponent.copySecretName(name, this.platformUtilsService, this.i18nService);
  }

  async copySecretValue(id: string) {
    await SecretsListComponent.copySecretValue(
      id,
      this.platformUtilsService,
      this.i18nService,
      this.secretService,
      this.logService,
    );
  }

  copySecretUuid(id: string) {
    SecretsListComponent.copySecretUuid(id, this.platformUtilsService, this.i18nService);
  }
}
