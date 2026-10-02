// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionModel } from "@angular/cdk/collections";
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  effect,
  inject,
  input,
  output,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { catchError, concatMap, map, Observable, of, Subject, switchMap, takeUntil } from "rxjs";

import { NoResults } from "@bitwarden/assets/svg";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DialogService, TableDataSource, ToastService } from "@bitwarden/components";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/dirt/event-logs/components/entity-events/entity-events.component";

import { SecretListView } from "../models/view/secret-list.view";
import { SecretView } from "../models/view/secret.view";
import { SecretService } from "../secrets/secret.service";

@Component({
  selector: "sm-secrets-list",
  templateUrl: "./secrets-list.component.html",
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretsListComponent implements OnDestroy {
  private readonly configService = inject(ConfigService);
  protected readonly btnTextAddCreateFeatureFlag = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM32380_BtnTextAddCreate),
    { initialValue: false },
  );

  protected readonly dataSource = new TableDataSource<SecretListView>();

  readonly noItemsIcon = NoResults;

  readonly secrets = input<SecretListView[]>();
  readonly search = input<string>();
  readonly trash = input(false);

  readonly editSecretEvent = output<string>();
  readonly viewSecretEvent = output<string>();
  readonly copySecretNameEvent = output<string>();
  readonly copySecretValueEvent = output<string>();
  readonly copySecretUuidEvent = output<string>();
  readonly onSecretCheckedEvent = output<string[]>();
  readonly deleteSecretsEvent = output<SecretListView[]>();
  readonly newSecretEvent = output<void>();
  readonly restoreSecretsEvent = output<string[]>();
  readonly viewVersionHistoryEvent = output<string>();

  private readonly destroy$ = new Subject<void>();

  readonly selection = new SelectionModel<string>(true, []);
  protected readonly viewEventsAllowed$: Observable<boolean>;
  protected readonly secretVersioningEnabled$: Observable<boolean>;

  constructor(
    private readonly i18nService: I18nService,
    private readonly toastService: ToastService,
    private readonly dialogService: DialogService,
    private readonly organizationService: OrganizationService,
    private readonly activatedRoute: ActivatedRoute,
    private readonly accountService: AccountService,
    private readonly logService: LogService,
  ) {
    this.selection.changed
      .pipe(takeUntil(this.destroy$))
      .subscribe((_) => this.onSecretCheckedEvent.emit(this.selection.selected));

    // The table data source is not signal based, so input changes have to be
    // copied into it. Selections are cleared because the rows they point at
    // may no longer be in the table.
    effect(() => {
      this.selection.clear();
      this.dataSource.data = this.secrets() ?? [];
    });

    effect(() => {
      this.selection.clear();
      this.dataSource.filter = this.search() ?? "";
    });

    this.viewEventsAllowed$ = this.activatedRoute.params.pipe(
      concatMap((params) =>
        getUserId(this.accountService.activeAccount$).pipe(
          switchMap((userId) =>
            this.organizationService
              .organizations$(userId)
              .pipe(getOrganizationById(params.organizationId)),
          ),
        ),
      ),
      map((org) => org.canAccessEventLogs),
      catchError((error: unknown) => {
        if (typeof error === "string") {
          this.toastService.showToast({
            message: error,
            variant: "error",
            title: "",
          });
        } else {
          this.logService.error(error);
        }
        return of(false);
      }),
      takeUntil(this.destroy$),
    );

    this.secretVersioningEnabled$ = this.configService.getFeatureFlag$(
      FeatureFlag.SecretVersioning,
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isAllSelected() {
    if (this.selection.selected?.length > 0) {
      const numSelected = this.selection.selected.length;
      const numRows = this.dataSource.filteredData.length;
      return numSelected === numRows;
    }
    return false;
  }
  readonly openEventsDialog = (secret: SecretView): DialogRef<void> =>
    openEntityEventsDialog(this.dialogService, {
      data: {
        name: secret.name,
        organizationId: secret.organizationId,
        entityId: secret.id,
        entity: "secret",
      },
    });

  toggleAll() {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.dataSource.filteredData.map((s) => s.id));
    }
  }

  bulkDeleteSecrets() {
    if (this.selection.selected.length >= 1) {
      this.deleteSecretsEvent.emit(
        this.secrets().filter((secret) => this.selection.isSelected(secret.id)),
      );
    } else {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nothingSelected"),
      });
    }
  }

  bulkRestoreSecrets() {
    if (this.selection.selected.length >= 1) {
      this.restoreSecretsEvent.emit(this.selection.selected);
    } else {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nothingSelected"),
      });
    }
  }

  readonly sortProjects = (a: SecretListView, b: SecretListView): number => {
    const aProjects = a.projects;
    const bProjects = b.projects;
    if (aProjects.length !== bProjects.length) {
      return aProjects.length - bProjects.length;
    }

    return aProjects[0]?.name.localeCompare(bProjects[0].name);
  };

  protected editSecret(secret: SecretListView) {
    if (secret.write) {
      this.editSecretEvent.emit(secret.id);
    } else {
      this.viewSecretEvent.emit(secret.id);
    }
  }

  /**
   * TODO: Refactor to smart component and remove
   */
  static copySecretName(
    name: string,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
  ) {
    platformUtilsService.copyToClipboard(name);
    platformUtilsService.showToast(
      "success",
      null,
      i18nService.t("valueCopied", i18nService.t("name")),
    );
  }

  /**
   * TODO: Refactor to smart component and remove
   */
  static async copySecretValue(
    id: string,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    secretService: SecretService,
    logService: LogService,
  ) {
    try {
      const value = await secretService.getBySecretId(id).then((secret) => secret.value);
      platformUtilsService.copyToClipboard(value);
      platformUtilsService.showToast(
        "success",
        null,
        i18nService.t("valueCopied", i18nService.t("value")),
      );
    } catch {
      logService.info("Error fetching secret value.");
    }
  }

  static copySecretUuid(
    id: string,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
  ) {
    platformUtilsService.copyToClipboard(id);
    platformUtilsService.showToast(
      "success",
      null,
      i18nService.t("valueCopied", i18nService.t("uuid")),
    );
  }
}
