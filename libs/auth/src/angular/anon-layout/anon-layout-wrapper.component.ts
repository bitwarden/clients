import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Data, NavigationEnd, Router, RouterModule } from "@angular/router";
import { Subject, filter, switchMap, takeUntil, tap } from "rxjs";

import { AnonLayoutComponent } from "@bitwarden/auth/angular";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Icon } from "@bitwarden/components";

import { AnonLayoutWrapperDataService } from "./anon-layout-wrapper-data.service";

export interface AnonLayoutWrapperData {
  pageTitle?: string;
  pageSubtitle?: string;
  pageIcon?: Icon;
  showReadonlyHostname?: boolean;
  maxWidth?: "md" | "3xl";
}

@Component({
  standalone: true,
  templateUrl: "anon-layout-wrapper.component.html",
  imports: [AnonLayoutComponent, RouterModule],
})
export class AnonLayoutWrapperComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  protected pageTitle: string;
  protected pageSubtitle: string;
  protected pageIcon: Icon;
  protected showReadonlyHostname: boolean;
  protected maxWidth: "md" | "3xl";

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private i18nService: I18nService,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
  ) {}

  ngOnInit(): void {
    // Set the initial page data on load
    this.setAnonLayoutWrapperDataFromRouteData(this.route.snapshot.firstChild?.data);
    // Listen for page changes and update the page data appropriately
    this.listenForPageDataChanges();
    this.listenForServiceDataChanges();
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
      this.pageTitle = this.i18nService.t(firstChildRouteData["pageTitle"]);
    }

    if (firstChildRouteData["pageSubtitle"] !== undefined) {
      this.pageSubtitle = this.i18nService.t(firstChildRouteData["pageSubtitle"]);
    }

    if (firstChildRouteData["pageIcon"] !== undefined) {
      this.pageIcon = firstChildRouteData["pageIcon"];
    }

    this.showReadonlyHostname = Boolean(firstChildRouteData["showReadonlyHostname"]);
    this.maxWidth = firstChildRouteData["maxWidth"];
  }

  private listenForServiceDataChanges() {
    this.anonLayoutWrapperDataService
      .anonLayoutWrapperData$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((data: AnonLayoutWrapperData) => {
        this.setAnonLayoutWrapperData(data);
      });
  }

  private setAnonLayoutWrapperData(data: AnonLayoutWrapperData) {
    if (!data) {
      return;
    }

    if (data.pageTitle) {
      this.pageTitle = this.i18nService.t(data.pageTitle);
    }

    if (data.pageSubtitle) {
      this.pageSubtitle = this.i18nService.t(data.pageSubtitle);
    }

    if (data.pageIcon) {
      this.pageIcon = data.pageIcon;
    }

    if (data.showReadonlyHostname != null) {
      this.showReadonlyHostname = data.showReadonlyHostname;
    }
  }

  private resetPageData() {
    this.pageTitle = null;
    this.pageSubtitle = null;
    this.pageIcon = null;
    this.showReadonlyHostname = null;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
