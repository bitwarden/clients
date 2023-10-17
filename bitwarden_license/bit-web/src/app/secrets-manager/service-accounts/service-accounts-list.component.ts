import { SelectionModel } from "@angular/cdk/collections";
import { Component, EventEmitter, Input, OnDestroy, Output } from "@angular/core";
import { Subject, takeUntil } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { TableDataSource } from "@bitwarden/components";

import {
  ServiceAccountSecretsDetailsView,
  ServiceAccountView,
} from "../models/view/service-account.view";

@Component({
  selector: "sm-service-accounts-list",
  templateUrl: "./service-accounts-list.component.html",
})
export class ServiceAccountsListComponent implements OnDestroy {
  protected dataSource = new TableDataSource<ServiceAccountSecretsDetailsView>();

  @Input()
  get serviceAccounts(): ServiceAccountSecretsDetailsView[] {
    return this._serviceAccounts;
  }
  set serviceAccounts(serviceAccounts: ServiceAccountSecretsDetailsView[]) {
    this.selectionModel.clear();
    this._serviceAccounts = serviceAccounts;
    this.dataSource.data = serviceAccounts;
  }
  private _serviceAccounts: ServiceAccountSecretsDetailsView[];

  @Input()
  set search(search: string) {
    this.selectionModel.clear();
    this.dataSource.filter = search;
  }

  @Output() newServiceAccountEvent = new EventEmitter();
  @Output() deleteServiceAccountsEvent = new EventEmitter<ServiceAccountView[]>();
  @Output() onServiceAccountCheckedEvent = new EventEmitter<ServiceAccountView[]>();
  @Output() editServiceAccountEvent = new EventEmitter<string>();

  private destroy$: Subject<void> = new Subject<void>();

  protected selectionModel = new SelectionModel<ServiceAccountView>(true, []);

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService
  ) {
    this.selectionModel.changed
      .pipe(takeUntil(this.destroy$))
      .subscribe((_) => this.onServiceAccountCheckedEvent.emit(this.selectionModel.selected));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  delete(serviceAccount: ServiceAccountSecretsDetailsView) {
    this.deleteServiceAccountsEvent.emit([serviceAccount as ServiceAccountView]);
  }

  bulkDeleteServiceAccounts() {
    if (this.selectionModel.selected.length >= 1) {
      this.deleteServiceAccountsEvent.emit(this.selectionModel.selected);
    } else {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("nothingSelected")
      );
    }
  }
}
