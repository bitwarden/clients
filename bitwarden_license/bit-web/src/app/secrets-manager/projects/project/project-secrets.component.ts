// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import {
  combineLatest,
  combineLatestWith,
  filter,
  firstValueFrom,
  Observable,
  startWith,
  switchMap,
} from "rxjs";

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

import { ProjectView } from "../../models/view/project.view";
import { SecretListView } from "../../models/view/secret-list.view";
import {
  SecretDeleteDialogComponent,
  SecretDeleteOperation,
} from "../../secrets/dialog/secret-delete.component";
import {
  OperationType,
  SecretDialogComponent,
  SecretOperation,
} from "../../secrets/dialog/secret-dialog.component";
import {
  SecretViewDialogComponent,
  SecretViewDialogParams,
} from "../../secrets/dialog/secret-view-dialog.component";
import { SecretService } from "../../secrets/secret.service";
import { SecretsListComponent } from "../../shared/secrets-list.component";
import { ProjectService } from "../project.service";

@Component({
  selector: "sm-project-secrets",
  templateUrl: "./project-secrets.component.html",
  standalone: false,
})
export class ProjectSecretsComponent implements OnInit {
  secrets$: Observable<SecretListView[]>;

  private organizationId: string;
  private projectId: string;
  protected project$: Observable<ProjectView>;
  private organizationEnabled: boolean;

  constructor(
    private route: ActivatedRoute,
    private projectService: ProjectService,
    private secretService: SecretService,
    private dialogService: DialogService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private organizationService: OrganizationService,
    private accountService: AccountService,
    private logService: LogService,
  ) {}

  ngOnInit() {
    // Refresh list if project is edited
    const currentProjectEdited = this.projectService.project$.pipe(
      filter((p) => p?.id === this.projectId),
      startWith(null),
    );

    this.project$ = combineLatest([this.route.params, currentProjectEdited]).pipe(
      switchMap(([params, _]) => {
        return this.projectService.getByProjectId(params.projectId);
      }),
    );

    this.secrets$ = this.secretService.secret$.pipe(
      startWith(null),
      combineLatestWith(this.route.params, currentProjectEdited),
      switchMap(async ([_, params]) => {
        this.organizationId = params.organizationId;
        this.projectId = params.projectId;
        const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
        this.organizationEnabled = (
          await firstValueFrom(
            this.organizationService
              .organizations$(userId)
              .pipe(getOrganizationById(params.organizationId)),
          )
        )?.enabled;
        return await this.getSecretsByProject();
      }),
    );
  }

  private async getSecretsByProject(): Promise<SecretListView[]> {
    return await this.secretService.getSecretsByProject(this.organizationId, this.projectId);
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
        projectId: this.projectId,
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
