// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Data, NavigationEnd, Router, RouterModule } from "@angular/router";
import { Subject, filter, switchMap, takeUntil, tap } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { Translation } from "../dialog";
import { Icon } from "../icon";

import { AnonLayoutWrapperDataService } from "./anon-layout-wrapper-data.service";
import { AnonLayoutComponent, AnonLayoutMaxWidth } from "./anon-layout.component";

export interface AnonLayoutWrapperData {
  /**
   * The optional title of the page.
   * If a string is provided, it will be presented as is (ex: Organization name)
   * If a Translation object (supports placeholders) is provided, it will be translated
   */
  pageTitle?: string | Translation | null;
  /**
   * The optional subtitle of the page.
   * If a string is provided, it will be presented as is (ex: user's email)
   * If a Translation object (supports placeholders) is provided, it will be translated
   */
  pageSubtitle?: string | Translation | null;
  /**
   * The optional icon to display on the page.
   */
  pageIcon?: Icon | null;
  /**
   * Hides the default Bitwarden shield icon.
   */
  hideIcon?: boolean;
  /**
   * Optional flag to either show the optional environment selector (false) or just a readonly hostname (true).
   */
  showReadonlyHostname?: boolean;
  /**
   * Optional flag to set the max-width of the page. Defaults to 'md' if not provided.
   */
  maxWidth?: AnonLayoutMaxWidth;
  /**
   * Hide the card that wraps the default content. Defaults to false.
   */
  hideCardWrapper?: boolean;
}

@Component({
  templateUrl: "anon-layout-wrapper.component.html",
  imports: [AnonLayoutComponent, RouterModule],
})
export class AnonLayoutWrapperComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  protected pageTitle: string;
  protected pageSubtitle: string;
  protected pageIcon: Icon;
  protected showReadonlyHostname: boolean;
  protected maxWidth: AnonLayoutMaxWidth;
  protected hideCardWrapper: boolean;
  protected hideIcon: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private i18nService: I18nService,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private changeDetectorRef: ChangeDetectorRef,
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
      this.pageTitle = this.handleStringOrTranslation(firstChildRouteData["pageTitle"]);
    }

    if (firstChildRouteData["pageSubtitle"] !== undefined) {
      this.pageSubtitle = this.handleStringOrTranslation(firstChildRouteData["pageSubtitle"]);
    }

    if (firstChildRouteData["pageIcon"] !== undefined) {
      this.pageIcon = firstChildRouteData["pageIcon"];
    }

    if (firstChildRouteData["hideIcon"] !== undefined) {
      this.hideIcon = firstChildRouteData["hideIcon"];
    }

    this.showReadonlyHostname = Boolean(firstChildRouteData["showReadonlyHostname"]);
    this.maxWidth = firstChildRouteData["maxWidth"];
    this.hideCardWrapper = Boolean(firstChildRouteData["hideCardWrapper"]);
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

    if (data.showReadonlyHostname !== undefined) {
      this.showReadonlyHostname = data.showReadonlyHostname;
    }

    if (data.hideCardWrapper !== undefined) {
      this.hideCardWrapper = data.hideCardWrapper;
    }

    // Manually fire change detection to avoid ExpressionChangedAfterItHasBeenCheckedError
    // when setting the page data from a service
    this.changeDetectorRef.detectChanges();
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
    this.maxWidth = null;
    this.hideCardWrapper = null;
    this.hideIcon = null;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
