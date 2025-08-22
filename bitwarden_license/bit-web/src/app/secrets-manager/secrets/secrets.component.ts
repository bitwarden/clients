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
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DialogService, ToastService } from "@bitwarden/components";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/admin-console/organizations/manage/entity-events.component";

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
  standalone: false,
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
    private toastService: ToastService,
    private router: Router,
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

        const secrets = await this.getSecrets();
        const viewEvents = this.route.snapshot.queryParams.viewEvents;

        if (viewEvents) {
          let targetSecret = secrets.find((secret) => secret.id === viewEvents);

          const userIsAdmin = (
            await firstValueFrom(
              this.organizationService
                .organizations$(userId)
                .pipe(getOrganizationById(params.organizationId)),
            )
          )?.isAdmin;

          // Secret might be deleted, make sure they are an admin before checking the trashed secrets
          if (!targetSecret && userIsAdmin) {
            targetSecret = (await this.secretService.getTrashedSecrets(this.organizationId)).find(
              (e) => e.id == viewEvents,
            );
          }

          // They would fall into here if they don't have access to a secret, or if it has been permanently deleted.
          if (!targetSecret) {
            //If they are an admin it was permanently deleted and we can show the events even though we don't have the secret name
            if (userIsAdmin) {
              this.openEventsDialogByEntityId(
                this.i18nService.t("nameUnavailableSecretDeleted", viewEvents),
                viewEvents,
              );
            } else {
              //They aren't an admin so we don't know if they have access to it, lets show the unknown secret toast.
              this.toastService.showToast({
                variant: "error",
                title: null,
                message: this.i18nService.t("unknownSecret"),
              });
            }
          } else {
            this.openEventsDialog(targetSecret);
          }

          await this.router.navigate([], {
            queryParams: { search: this.search },
          });
        }

        return secrets;
      }),
    );

    if (this.route.snapshot.queryParams.search) {
      this.search = this.route.snapshot.queryParams.search;
    }
  }

  openEventsDialogByEntityId = (secretName: string, secretId: string): DialogRef<void> =>
    openEntityEventsDialog(this.dialogService, {
      data: {
        name: secretName,
        organizationId: this.organizationId,
        entityId: secretId,
        entity: "secret",
      },
    });

  openEventsDialog = (secret: SecretListView): DialogRef<void> =>
    openEntityEventsDialog(this.dialogService, {
      data: {
        name: secret.name,
        organizationId: this.organizationId,
        entityId: secret.id,
        entity: "secret",
      },
    });

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
