import { SelectionModel } from "@angular/cdk/collections";
import { Component, EventEmitter, Input, OnDestroy, Output } from "@angular/core";
import { Subject, takeUntil } from "rxjs";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { Guid } from "@bitwarden/common/types/guid";
import { TableDataSource } from "@bitwarden/components";

import { ServiceAccountView } from "../models/view/service-account.view";

@Component({
  selector: "sm-service-accounts-list",
  templateUrl: "./service-accounts-list.component.html",
})
export class ServiceAccountsListComponent implements OnDestroy {
  protected dataSource = new TableDataSource<ServiceAccountView>();

  @Input()
  get serviceAccounts(): ServiceAccountView[] {
    return this._serviceAccounts;
  }
  set serviceAccounts(serviceAccounts: ServiceAccountView[]) {
    this.selection.clear();
    this._serviceAccounts = serviceAccounts;
    this.dataSource.data = serviceAccounts;
  }
  private _serviceAccounts: ServiceAccountView[];

  @Input()
  set search(search: string) {
    this.dataSource.filter = search;
  }

  @Output() newServiceAccountEvent = new EventEmitter();
  @Output() deleteServiceAccountsEvent = new EventEmitter<ServiceAccountView[]>();
  @Output() onServiceAccountCheckedEvent = new EventEmitter<string[]>();
  @Output() editServiceAccountEvent = new EventEmitter<Guid>();

  private destroy$: Subject<void> = new Subject<void>();

  selection = new SelectionModel<string>(true, []);

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService
  ) {
    this.selection.changed
      .pipe(takeUntil(this.destroy$))
      .subscribe((_) => this.onServiceAccountCheckedEvent.emit(this.selection.selected));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.serviceAccounts.length;
    return numSelected === numRows;
  }

  toggleAll() {
    this.isAllSelected()
      ? this.selection.clear()
      : this.selection.select(...this.serviceAccounts.map((s) => s.id));
  }

  delete(serviceAccount: ServiceAccountView) {
    this.deleteServiceAccountsEvent.emit([serviceAccount]);
  }

  bulkDeleteServiceAccounts() {
    if (this.selection.selected.length >= 1) {
      this.deleteServiceAccountsEvent.emit(
        this.serviceAccounts.filter((sa) => this.selection.isSelected(sa.id))
      );
    } else {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected")
      );
    }
  }
}
