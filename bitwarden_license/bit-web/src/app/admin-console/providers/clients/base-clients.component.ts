// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SelectionModel } from "@angular/cdk/collections";
import { Directive, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, from, Subject, switchMap } from "rxjs";
import { first, takeUntil } from "rxjs/operators";

import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { ProviderOrganizationOrganizationDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-organization.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { DialogService, TableDataSource, ToastService } from "@bitwarden/components";

import { WebProviderService } from "../services/web-provider.service";

@Directive()
export abstract class BaseClientsComponent implements OnInit, OnDestroy {
  protected destroy$ = new Subject<void>();

  private searchText$ = new BehaviorSubject<string>("");

  get searchText() {
    return this.searchText$.value;
  }

  set searchText(value: string) {
    this.searchText$.next(value);
    this.selection.clear();
    this.dataSource.filter = value;
  }

  private searching = false;
  protected scrolled = false;
  protected pageSize = 100;
  private pagedClientsCount = 0;
  protected selection = new SelectionModel<string>(true, []);

  protected clients: ProviderOrganizationOrganizationDetailsResponse[];
  protected pagedClients: ProviderOrganizationOrganizationDetailsResponse[];
  protected dataSource = new TableDataSource<ProviderOrganizationOrganizationDetailsResponse>();

  abstract providerId: string;

  protected constructor(
    protected activatedRoute: ActivatedRoute,
    protected dialogService: DialogService,
    private i18nService: I18nService,
    private searchService: SearchService,
    private toastService: ToastService,
    private validationService: ValidationService,
    private webProviderService: WebProviderService,
  ) {}

  abstract load(): Promise<void>;

  ngOnInit() {
    this.activatedRoute.queryParams
      .pipe(first(), takeUntil(this.destroy$))
      .subscribe((queryParams) => {
        this.searchText = queryParams.search;
      });

    this.searchText$
      .pipe(
        switchMap((searchText) => from(this.searchService.isSearchable(searchText))),
        takeUntil(this.destroy$),
      )
      .subscribe((isSearchable) => {
        this.searching = isSearchable;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isPaging() {
    if (this.searching && this.scrolled) {
      this.resetPaging();
    }
    return !this.searching && this.clients && this.clients.length > this.pageSize;
  }

  resetPaging() {
    this.pagedClients = [];
    this.loadMore();
  }

  loadMore() {
    if (!this.clients || this.clients.length <= this.pageSize) {
      return;
    }
    const pagedLength = this.pagedClients.length;
    let pagedSize = this.pageSize;
    if (pagedLength === 0 && this.pagedClientsCount > this.pageSize) {
      pagedSize = this.pagedClientsCount;
    }
    if (this.clients.length > pagedLength) {
      this.pagedClients = this.pagedClients.concat(
        this.clients.slice(pagedLength, pagedLength + pagedSize),
      );
    }
    this.pagedClientsCount = this.pagedClients.length;
    this.scrolled = this.pagedClients.length > this.pageSize;
  }

  async remove(organization: ProviderOrganizationOrganizationDetailsResponse) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: organization.organizationName,
      content: { key: "detachOrganizationConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      await this.webProviderService.detachOrganization(this.providerId, organization.id);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("detachedOrganization", organization.organizationName),
      });
      await this.load();
    } catch (e) {
      this.validationService.showError(e);
    }
  }
}
