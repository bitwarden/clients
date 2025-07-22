// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, NgZone, OnDestroy, OnInit } from "@angular/core";
import {
  BehaviorSubject,
  Subject,
  firstValueFrom,
  mergeMap,
  from,
  switchMap,
  takeUntil,
  combineLatest,
} from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { SearchService } from "@bitwarden/common/vault/abstractions/search.service";
import { DialogService, ToastService } from "@bitwarden/components";

@Directive()
export class SendComponent implements OnInit, OnDestroy {
  disableSend = false;
  sendType = SendType;
  loaded = false;
  loading = true;
  refreshing = false;
  expired = false;
  type: SendType = null;
  sends: SendView[] = [];
  selectedType: SendType;
  selectedAll: boolean;
  filter: (cipher: SendView) => boolean;
  searchPending = false;
  hasSearched = false; // search() function called - returns true if text qualifies for search

  actionPromise: any;
  onSuccessfulRemovePassword: () => Promise<any>;
  onSuccessfulDelete: () => Promise<any>;
  onSuccessfulLoad: () => Promise<any>;

  private searchTimeout: any;
  private destroy$ = new Subject<void>();
  private _filteredSends: SendView[];
  private _searchText$ = new BehaviorSubject<string>("");
  protected isSearchable: boolean = false;

  get filteredSends(): SendView[] {
    return this._filteredSends;
  }

  set filteredSends(filteredSends: SendView[]) {
    this._filteredSends = filteredSends;
  }

  get searchText() {
    return this._searchText$.value;
  }

  set searchText(value: string) {
    this._searchText$.next(value);
  }

  constructor(
    protected sendService: SendService,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected environmentService: EnvironmentService,
    protected ngZone: NgZone,
    protected searchService: SearchService,
    protected policyService: PolicyService,
    private logService: LogService,
    protected sendApiService: SendApiService,
    protected dialogService: DialogService,
    protected toastService: ToastService,
    private accountService: AccountService,
  ) {}

  async ngOnInit() {
    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) =>
          this.policyService.policyAppliesToUser$(PolicyType.DisableSend, userId),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((policyAppliesToUser) => {
        this.disableSend = policyAppliesToUser;
      });

    combineLatest([this._searchText$, this.accountService.activeAccount$.pipe(getUserId)])
      .pipe(
        switchMap(([searchText, userId]) =>
          from(this.searchService.isSearchable(userId, searchText)),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe((isSearchable) => {
        this.isSearchable = isSearchable;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async load(filter: (send: SendView) => boolean = null) {
    this.loading = true;
    this.sendService.sendViews$
      .pipe(
        mergeMap(async (sends) => {
          this.sends = sends;
          await this.search(null);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
    if (this.onSuccessfulLoad != null) {
      await this.onSuccessfulLoad();
    } else {
      // Default action
      this.selectAll();
    }
    this.loading = false;
    this.loaded = true;
  }

  async reload(filter: (send: SendView) => boolean = null) {
    this.loaded = false;
    this.sends = [];
    await this.load(filter);
  }

  async refresh() {
    try {
      this.refreshing = true;
      await this.reload(this.filter);
    } finally {
      this.refreshing = false;
    }
  }

  async applyFilter(filter: (send: SendView) => boolean = null) {
    this.filter = filter;
    await this.search(null);
  }

  async search(timeout: number = null) {
    this.searchPending = false;
    if (this.searchTimeout != null) {
      clearTimeout(this.searchTimeout);
    }
    if (timeout == null) {
      this.hasSearched = this.isSearchable;
      this.filteredSends = this.sends.filter((s) => this.filter == null || this.filter(s));
      this.applyTextSearch();
      return;
    }
    this.searchPending = true;
    this.searchTimeout = setTimeout(async () => {
      this.hasSearched = this.isSearchable;
      this.filteredSends = this.sends.filter((s) => this.filter == null || this.filter(s));
      this.applyTextSearch();
      this.searchPending = false;
    }, timeout);
  }

  async removePassword(s: SendView): Promise<boolean> {
    if (this.actionPromise != null || s.password == null) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "removePassword" },
      content: { key: "removePasswordConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      this.actionPromise = this.sendApiService.removePassword(s.id);
      await this.actionPromise;
      if (this.onSuccessfulRemovePassword != null) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.onSuccessfulRemovePassword();
      } else {
        // Default actions
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("removedPassword"),
        });
        await this.load();
      }
    } catch (e) {
      this.logService.error(e);
    }
    this.actionPromise = null;
  }

  async delete(s: SendView): Promise<boolean> {
    if (this.actionPromise != null) {
      return false;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteSend" },
      content: { key: "deleteSendConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      this.actionPromise = this.sendApiService.delete(s.id);
      await this.actionPromise;

      if (this.onSuccessfulDelete != null) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.onSuccessfulDelete();
      } else {
        // Default actions
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("deletedSend"),
        });
        await this.refresh();
      }
    } catch (e) {
      this.logService.error(e);
    }
    this.actionPromise = null;
    return true;
  }

  async copy(s: SendView) {
    const env = await firstValueFrom(this.environmentService.environment$);
    const link = env.getSendUrl() + s.accessId + "/" + s.urlB64Key;
    this.platformUtilsService.copyToClipboard(link);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t("sendLink")),
    });
  }

  searchTextChanged() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.search(200);
  }

  selectAll() {
    this.clearSelections();
    this.selectedAll = true;
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.applyFilter(null);
  }

  selectType(type: SendType) {
    this.clearSelections();
    this.selectedType = type;
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.applyFilter((s) => s.type === type);
  }

  clearSelections() {
    this.selectedAll = false;
    this.selectedType = null;
  }

  private applyTextSearch() {
    if (this.searchText != null) {
      this.filteredSends = this.searchService.searchSends(this.filteredSends, this.searchText);
    }
  }
}
