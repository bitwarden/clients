import { SelectionModel } from "@angular/cdk/collections";
import { Component, EventEmitter, Input, OnDestroy, Output } from "@angular/core";
import { Subject, takeUntil } from "rxjs";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { Guid } from "@bitwarden/common/types/guid";
import { TableDataSource } from "@bitwarden/components";

import { SecretListView } from "../models/view/secret-list.view";
import { SecretService } from "../secrets/secret.service";

@Component({
  selector: "sm-secrets-list",
  templateUrl: "./secrets-list.component.html",
})
export class SecretsListComponent implements OnDestroy {
  protected dataSource = new TableDataSource<SecretListView>();

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

  @Input()
  set search(search: string) {
    this.dataSource.filter = search;
  }

  @Input() trash: boolean;

  @Output() editSecretEvent = new EventEmitter<Guid>();
  @Output() copySecretNameEvent = new EventEmitter<string>();
  @Output() copySecretValueEvent = new EventEmitter<string>();
  @Output() onSecretCheckedEvent = new EventEmitter<string[]>();
  @Output() deleteSecretsEvent = new EventEmitter<SecretListView[]>();
  @Output() newSecretEvent = new EventEmitter();
  @Output() restoreSecretsEvent = new EventEmitter();

  private destroy$: Subject<void> = new Subject<void>();

  selection = new SelectionModel<string>(true, []);

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService
  ) {
    this.selection.changed
      .pipe(takeUntil(this.destroy$))
      .subscribe((_) => this.onSecretCheckedEvent.emit(this.selection.selected));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.secrets.length;
    return numSelected === numRows;
  }

  toggleAll() {
    this.isAllSelected()
      ? this.selection.clear()
      : this.selection.select(...this.secrets.map((s) => s.id));
  }

  bulkDeleteSecrets() {
    if (this.selection.selected.length >= 1) {
      this.deleteSecretsEvent.emit(
        this.secrets.filter((secret) => this.selection.isSelected(secret.id))
      );
    } else {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected")
      );
    }
  }

  bulkRestoreSecrets() {
    if (this.selection.selected.length >= 1) {
      this.restoreSecretsEvent.emit(this.selection.selected);
    } else {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected")
      );
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

  /**
   * TODO: Refactor to smart component and remove
   */
  static copySecretName(
    name: string,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService
  ) {
    platformUtilsService.copyToClipboard(name);
    platformUtilsService.showToast(
      "success",
      null,
      i18nService.t("valueCopied", i18nService.t("name"))
    );
  }

  /**
   * TODO: Refactor to smart component and remove
   */
  static copySecretValue(
    id: string,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    secretService: SecretService
  ) {
    const value = secretService.getBySecretId(id).then((secret) => secret.value);
    SecretsListComponent.copyToClipboardAsync(value, platformUtilsService).then(() => {
      platformUtilsService.showToast(
        "success",
        null,
        i18nService.t("valueCopied", i18nService.t("value"))
      );
    });
  }

  /**
   * TODO: Remove in favor of updating `PlatformUtilsService.copyToClipboard`
   */
  private static copyToClipboardAsync(
    text: Promise<string>,
    platformUtilsService: PlatformUtilsService
  ) {
    if (platformUtilsService.isSafari()) {
      return navigator.clipboard.write([
        new ClipboardItem({
          ["text/plain"]: text,
        }),
      ]);
    }

    return text.then((t) => platformUtilsService.copyToClipboard(t));
  }
}
