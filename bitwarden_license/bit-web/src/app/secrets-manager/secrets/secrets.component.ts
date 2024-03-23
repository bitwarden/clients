import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { combineLatestWith, lastValueFrom, Observable, startWith, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

import { SecretListView } from "../models/view/secret-list.view";
import {
  BulkConfirmationDetails,
  BulkConfirmationDialogComponent,
  BulkConfirmationResult,
} from "../shared/dialogs/bulk-confirmation-dialog.component";
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
  SecretMoveProjectComponent,
  SecretMoveProjectOperation,
} from "./dialog/secret-move-project.component";
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
  ) {}

  ngOnInit() {
    this.secrets$ = this.secretService.secret$.pipe(
      startWith(null),
      combineLatestWith(this.route.params),
      switchMap(async ([_, params]) => {
        this.organizationId = params.organizationId;
        this.organizationEnabled = (
          await this.organizationService.get(params.organizationId)
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

  copySecretValue(id: string) {
    SecretsListComponent.copySecretValue(
      id,
      this.platformUtilsService,
      this.i18nService,
      this.secretService,
    );
  }

  copySecretUuid(id: string) {
    SecretsListComponent.copySecretUuid(id, this.platformUtilsService, this.i18nService);
  }

  async openMoveToProjectDialog(secrets: SecretListView[]) {
    let secretsToMove = secrets;
    const readonlySecrets = secrets.filter((secret) => secret.write == false);
    if (readonlySecrets.length > 0) {
      const dialogRef = this.dialogService.open<BulkConfirmationResult, BulkConfirmationDetails>(
        BulkConfirmationDialogComponent,
        {
          data: {
            title: "moveSecrets",
            columnTitle: "secret",
            message: "smSecretsMoveBulkConfirmation",
            details: readonlySecrets.map((secret) => ({
              id: secret.id,
              name: secret.name,
              description: "smSecretMoveAccessRestricted",
            })),
          },
        },
      );

      const result = await lastValueFrom(dialogRef.closed);

      if (result !== BulkConfirmationResult.Continue) {
        return;
      }

      secretsToMove = secrets.filter((secret) => secret.write);
    }

    this.dialogService.open<unknown, SecretMoveProjectOperation>(SecretMoveProjectComponent, {
      data: {
        organizationId: this.organizationId,
        secrets: secretsToMove,
      },
    });
  }
}
