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
import { DialogRef, DialogService, TableDataSource, ToastService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { openEntityEventsDialog } from "@bitwarden/web-vault/app/admin-console/organizations/manage/entity-events.component";

import {
  ServiceAccountSecretsDetailsView,
  ServiceAccountView,
} from "../models/view/service-account.view";

@Component({
  selector: "sm-service-accounts-list",
  templateUrl: "./service-accounts-list.component.html",
  standalone: false,
})
export class ServiceAccountsListComponent implements OnDestroy, OnInit {
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
  protected viewEventsAllowed$: Observable<boolean>;
  protected isAdmin$: Observable<boolean>;
  selection = new SelectionModel<string>(true, []);

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
      .subscribe((_) => this.onServiceAccountCheckedEvent.emit(this.selection.selected));
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
  openEventsDialog = (serviceAccount: ServiceAccountView): DialogRef<void> =>
    openEntityEventsDialog(this.dialogService, {
      data: {
        name: serviceAccount.name,
        organizationId: serviceAccount.organizationId,
        entityId: serviceAccount.id,
        entity: "service-account",
      },
    });
}
