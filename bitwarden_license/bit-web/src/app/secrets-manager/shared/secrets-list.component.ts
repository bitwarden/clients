// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionModel } from "@angular/cdk/collections";
import { Component, EventEmitter, Input, OnDestroy, Output, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { catchError, concatMap, map, Observable, of, Subject, switchMap, takeUntil } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DialogService, TableDataSource, ToastService } from "@bitwarden/components";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/admin-console/organizations/manage/entity-events.component";

import { SecretListView } from "../models/view/secret-list.view";
import { SecretView } from "../models/view/secret.view";
import { SecretService } from "../secrets/secret.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "sm-secrets-list",
  templateUrl: "./secrets-list.component.html",
  standalone: false,
})
export class SecretsListComponent implements OnDestroy, OnInit {
  protected dataSource = new TableDataSource<SecretListView>();

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  get secrets(): SecretListView[] {
    return this._secrets;
  }
  set secrets(secrets: SecretListView[]) {
    this.selection.clear();
    this._secrets = secrets;
    this.dataSource.data = secrets;
  }
  private _secrets: SecretListView[];

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  set search(search: string) {
    this.selection.clear();
    this.dataSource.filter = search;
  }

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() trash: boolean;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() editSecretEvent = new EventEmitter<string>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() viewSecretEvent = new EventEmitter<string>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() copySecretNameEvent = new EventEmitter<string>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() copySecretValueEvent = new EventEmitter<string>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() copySecretUuidEvent = new EventEmitter<string>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onSecretCheckedEvent = new EventEmitter<string[]>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() deleteSecretsEvent = new EventEmitter<SecretListView[]>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() newSecretEvent = new EventEmitter();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() restoreSecretsEvent = new EventEmitter();

  private destroy$: Subject<void> = new Subject<void>();

  selection = new SelectionModel<string>(true, []);
  protected viewEventsAllowed$: Observable<boolean>;
  protected isAdmin$: Observable<boolean>;
  protected rowHeight = 66;
  protected rowHeightClass = `tw-h-[66px]`;

  protected get viewportHeight(): string {
    if (!this.secrets || this.secrets.length === 0) {
      return "0px";
    }
    // Calculate height: (number of items * row height) + header height + buffer
    const itemsHeight = this.secrets.length * this.rowHeight;
    const headerHeight = 65; // Header with borders
    const buffer = 8; // Small buffer for borders and spacing
    const totalHeight = itemsHeight + headerHeight + buffer;
    // Use min() to set exact height, capping at 60vh or 500px for responsive behavior
    // This ensures the viewport is exactly the size of the content, unless it exceeds the max
    return `min(${totalHeight}px, 60vh, 500px)`;
  }

  constructor(
    private i18nService: I18nService,
    private toastService: ToastService,
    private dialogService: DialogService,
    private organizationService: OrganizationService,
    private activatedRoute: ActivatedRoute,
    private accountService: AccountService,
    private logService: LogService,
  ) {
    this.selection.changed
      .pipe(takeUntil(this.destroy$))
      .subscribe((_) => this.onSecretCheckedEvent.emit(this.selection.selected));
  }

  ngOnInit(): void {
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
  openEventsDialog = (secret: SecretView): DialogRef<void> =>
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
        this.secrets.filter((secret) => this.selection.isSelected(secret.id)),
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

  sortProjects = (a: SecretListView, b: SecretListView): number => {
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
