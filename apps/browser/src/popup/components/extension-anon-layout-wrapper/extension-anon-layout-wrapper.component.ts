// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Data, NavigationEnd, Router, RouterModule } from "@angular/router";
import { Subject, filter, switchMap, takeUntil, tap } from "rxjs";

import { BitwardenLogo, Icon } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  IconModule,
  Translation,
  AnonLayoutComponent,
  AnonLayoutWrapperData,
  AnonLayoutWrapperDataService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { AccountSwitcherService } from "../../../auth/popup/account-switching/services/account-switcher.service";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

export interface ExtensionAnonLayoutWrapperData extends AnonLayoutWrapperData {
  showAcctSwitcher?: boolean;
  showBackButton?: boolean;
  showLogo?: boolean;
  hideFooter?: boolean;
  hideIcon?: boolean;
}

@Component({
  templateUrl: "extension-anon-layout-wrapper.component.html",
  imports: [
    AnonLayoutComponent,
    CommonModule,
    CurrentAccountComponent,
    I18nPipe,
    IconModule,
    PopOutComponent,
    PopupPageComponent,
    PopupHeaderComponent,
    RouterModule,
  ],
})
export class ExtensionAnonLayoutWrapperComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  protected showAcctSwitcher: boolean;
  protected showBackButton: boolean;
  protected showLogo: boolean = true;
  protected hideIcon: boolean = false;

  protected pageTitle: string;
  protected pageSubtitle: string;
  protected pageIcon: Icon;
  protected showReadonlyHostname: boolean;
  protected maxWidth: "md" | "3xl";
  protected hasLoggedInAccount: boolean = false;
  protected hideFooter: boolean;
  protected hideCardWrapper: boolean = false;

  protected theme: string;
  protected logo = BitwardenLogo;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private i18nService: I18nService,
    private extensionAnonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private accountSwitcherService: AccountSwitcherService,
  ) {}

  async ngOnInit(): Promise<void> {
    // Set the initial page data on load
    this.setAnonLayoutWrapperDataFromRouteData(this.route.snapshot.firstChild?.data);

    // Listen for page changes and update the page data appropriately
    this.listenForPageDataChanges();
    this.listenForServiceDataChanges();

    this.accountSwitcherService.availableAccounts$
      .pipe(takeUntil(this.destroy$))
      .subscribe((accounts) => {
        this.hasLoggedInAccount = accounts.some((account) => account.id !== "addAccount");
      });
  }

  private listenForPageDataChanges() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        // reset page data on page changes
        tap(() => this.resetPageData()),
        switchMap(() => this.route.firstChild?.data || null),
        takeUntil(this.destroy$),
      )
      .subscribe((firstChildRouteData: Data | null) => {
        this.setAnonLayoutWrapperDataFromRouteData(firstChildRouteData);
      });
  }

  private setAnonLayoutWrapperDataFromRouteData(firstChildRouteData: Data | null) {
    if (!firstChildRouteData) {
      return;
    }

    if (firstChildRouteData["pageTitle"] !== undefined) {
      this.pageTitle = this.handleStringOrTranslation(firstChildRouteData["pageTitle"]);
    }

    if (firstChildRouteData["pageSubtitle"] !== undefined) {
      this.pageSubtitle = this.handleStringOrTranslation(firstChildRouteData["pageSubtitle"]);
    }

    if (firstChildRouteData["pageIcon"] !== undefined) {
      this.pageIcon = firstChildRouteData["pageIcon"];
    }

    this.hideFooter = Boolean(firstChildRouteData["hideFooter"]);
    this.showReadonlyHostname = Boolean(firstChildRouteData["showReadonlyHostname"]);
    this.maxWidth = firstChildRouteData["maxWidth"];

    if (firstChildRouteData["showAcctSwitcher"] !== undefined) {
      this.showAcctSwitcher = Boolean(firstChildRouteData["showAcctSwitcher"]);
    }

    if (firstChildRouteData["showBackButton"] !== undefined) {
      this.showBackButton = Boolean(firstChildRouteData["showBackButton"]);
    }

    if (firstChildRouteData["showLogo"] !== undefined) {
      this.showLogo = Boolean(firstChildRouteData["showLogo"]);
    }

    if (firstChildRouteData["hideIcon"] !== undefined) {
      this.hideIcon = Boolean(firstChildRouteData["hideIcon"]);
    }

    if (firstChildRouteData["hideCardWrapper"] !== undefined) {
      this.hideCardWrapper = Boolean(firstChildRouteData["hideCardWrapper"]);
    }
  }

  private listenForServiceDataChanges() {
    this.extensionAnonLayoutWrapperDataService
      .anonLayoutWrapperData$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: ExtensionAnonLayoutWrapperData) => {
        this.setAnonLayoutWrapperData(data);
      });
  }

  private setAnonLayoutWrapperData(data: ExtensionAnonLayoutWrapperData) {
    if (!data) {
      return;
    }

    // Null emissions are used to reset the page data as all fields are optional.

    if (data.pageTitle !== undefined) {
      this.pageTitle =
        data.pageTitle !== null ? this.handleStringOrTranslation(data.pageTitle) : null;
    }

    if (data.pageSubtitle !== undefined) {
      this.pageSubtitle =
        data.pageSubtitle !== null ? this.handleStringOrTranslation(data.pageSubtitle) : null;
    }

    if (data.pageIcon !== undefined) {
      this.pageIcon = data.pageIcon !== null ? data.pageIcon : null;
    }

    if (data.hideFooter !== undefined) {
      this.hideFooter = data.hideFooter !== null ? data.hideFooter : null;
    }

    if (data.showReadonlyHostname !== undefined) {
      this.showReadonlyHostname = data.showReadonlyHostname;
    }

    if (data.hideCardWrapper !== undefined) {
      this.hideCardWrapper = data.hideCardWrapper;
    }

    if (data.showAcctSwitcher !== undefined) {
      this.showAcctSwitcher = data.showAcctSwitcher;
    }

    if (data.showBackButton !== undefined) {
      this.showBackButton = data.showBackButton;
    }

    if (data.showLogo !== undefined) {
      this.showLogo = data.showLogo;
    }

    if (data.hideIcon !== undefined) {
      this.hideIcon = data.hideIcon;
    }
  }

  private handleStringOrTranslation(value: string | Translation): string {
    if (typeof value === "string") {
      // If it's a string, return it as is
      return value;
    }

    // If it's a Translation object, translate it
    return this.i18nService.t(value.key, ...(value.placeholders ?? []));
  }

  private resetPageData() {
    this.pageTitle = null;
    this.pageSubtitle = null;
    this.pageIcon = null;
    this.showReadonlyHostname = null;
    this.showAcctSwitcher = null;
    this.showBackButton = null;
    this.showLogo = null;
    this.maxWidth = null;
    this.hideFooter = null;
    this.hideIcon = null;
    this.hideCardWrapper = null;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
