// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionModel } from "@angular/cdk/collections";
import { Component, EventEmitter, Input, OnDestroy, Output } from "@angular/core";
import { Subject, takeUntil } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { TableDataSource, ToastService } from "@bitwarden/components";

import {
  ServiceAccountSecretsDetailsView,
  ServiceAccountView,
} from "../models/view/service-account.view";

@Component({
  selector: "sm-service-accounts-list",
  templateUrl: "./service-accounts-list.component.html",
  standalone: false,
})
export class ServiceAccountsListComponent implements OnDestroy {
  protected dataSource = new TableDataSource<ServiceAccountSecretsDetailsView>();

  @Input()
  get serviceAccounts(): ServiceAccountSecretsDetailsView[] {
    return this._serviceAccounts;
  }
  set serviceAccounts(serviceAccounts: ServiceAccountSecretsDetailsView[]) {
    this.selection.clear();
    this._serviceAccounts = serviceAccounts;
    this.dataSource.data = serviceAccounts;
  }
  private _serviceAccounts: ServiceAccountSecretsDetailsView[];

  @Input()
  set search(search: string) {
    this.selection.clear();
    this.dataSource.filter = search;
  }

  @Output() newServiceAccountEvent = new EventEmitter();
  @Output() deleteServiceAccountsEvent = new EventEmitter<ServiceAccountView[]>();
  @Output() onServiceAccountCheckedEvent = new EventEmitter<string[]>();
  @Output() editServiceAccountEvent = new EventEmitter<string>();

  private destroy$: Subject<void> = new Subject<void>();

  selection = new SelectionModel<string>(true, []);

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
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
    if (this.selection.selected?.length > 0) {
      const numSelected = this.selection.selected.length;
      const numRows = this.dataSource.filteredData.length;
      return numSelected === numRows;
    }
    return false;
  }

  toggleAll() {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.selection.select(...this.dataSource.filteredData.map((s) => s.id));
    }
  }

  delete(serviceAccount: ServiceAccountSecretsDetailsView) {
    this.deleteServiceAccountsEvent.emit([serviceAccount as ServiceAccountView]);
  }

  bulkDeleteServiceAccounts() {
    if (this.selection.selected.length >= 1) {
      this.deleteServiceAccountsEvent.emit(
        this.serviceAccounts.filter((sa) => this.selection.isSelected(sa.id)),
      );
    } else {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("nothingSelected"),
      });
    }
  }
}
