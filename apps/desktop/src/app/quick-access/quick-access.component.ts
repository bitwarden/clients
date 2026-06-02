// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
import { A11yModule } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from "rxjs";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SearchTextDebounceInterval } from "@bitwarden/common/vault/services/search.service";
import { I18nPipe } from "@bitwarden/ui-common";

const BroadcasterSubscriptionId = "QuickAccessComponent";

type QuickAccessCopyAction = "username" | "password";

type QuickAccessResult = {
  cipherId: string;
  name: string;
  subtitle: string;
  typeIcon: string;
  typeI18nKey: string;
  canCopyUsername: boolean;
  canCopyPassword: boolean;
};

const SearchOnlyHeight = 64;
const ResultRowHeight = 54;
const ResultsPaddingHeight = 12;
const FooterHeight = 40;
const PanelHeight = 190;

@Component({
  selector: "app-quick-access",
  templateUrl: "quick-access.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [A11yModule, CommonModule, FormsModule, I18nPipe],
  styles: [
    `
      :host {
        display: block;
        height: 100vh;
        color: #f8fafc;
        font-family: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif;
      }

      :host * {
        box-sizing: border-box;
      }

      .qa-shell {
        height: 100vh;
        padding: 0;
        background: transparent;
      }

      .qa-card {
        display: grid;
        height: 100vh;
        grid-template-rows: auto minmax(0, 1fr) auto;
        overflow: hidden;
        border: 1px solid rgba(219, 229, 246, 0.52);
        border-radius: 8px;
        background: #175ddc;
        background: rgb(var(--color-primary-600));
        box-shadow:
          0 12px 32px rgba(23, 93, 220, 0.3),
          0 2px 8px rgba(16, 24, 40, 0.16);
      }

      .qa-top {
        padding: 8px;
      }

      .qa-search {
        display: flex;
        height: 46px;
        align-items: center;
        gap: 9px;
        border: 1px solid rgb(var(--color-primary-600));
        border-radius: 8px;
        background: #ffffff;
        padding: 0 12px;
        box-shadow:
          0 0 0 2px rgba(219, 229, 246, 0.52),
          inset 0 0 0 1px rgba(15, 23, 42, 0.04);
      }

      .qa-search-icon {
        color: #1268dc;
        font-size: 16px;
      }

      .qa-search input {
        min-width: 0;
        flex: 1;
        border: 0;
        outline: 0;
        background: transparent;
        color: #111827;
        font-size: 16px;
        font-weight: 500;
        letter-spacing: 0;
        line-height: 1.2;
      }

      .qa-search input::placeholder {
        color: #667085;
        font-weight: 400;
      }

      .qa-clear {
        display: grid;
        width: 24px;
        height: 24px;
        flex: 0 0 auto;
        place-items: center;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: #667085;
        font-size: 14px;
      }

      .qa-clear:hover {
        background: #eef2f7;
        color: #344054;
      }

      .qa-body {
        min-height: 0;
        padding: 0 8px 8px;
      }

      .qa-results {
        height: 100%;
        overflow: hidden auto;
        padding: 2px 0;
      }

      .qa-row {
        display: grid;
        width: 100%;
        min-height: 52px;
        grid-template-columns: 32px minmax(0, 1fr) 24px;
        align-items: center;
        gap: 10px;
        border: 1px solid transparent;
        border-radius: 8px;
        background: transparent;
        padding: 7px 10px;
        color: #f3f4f6;
        text-align: left;
      }

      .qa-row:hover {
        background: rgba(255, 255, 255, 0.07);
      }

      .qa-row.is-selected {
        border-color: rgba(23, 93, 220, 0.45);
        background: rgba(23, 93, 220, 0.18);
        color: #ffffff;
      }

      .qa-icon {
        display: grid;
        width: 28px;
        height: 28px;
        place-items: center;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.08);
        color: #9bbcff;
        font-size: 15px;
      }

      .qa-row.is-selected .qa-icon {
        background: rgba(255, 255, 255, 0.16);
        color: #ffffff;
      }

      .qa-title,
      .qa-subtitle {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .qa-title {
        font-size: 14px;
        font-weight: 600;
      }

      .qa-subtitle {
        margin-top: 1px;
        color: #b6c0cf;
        font-size: 12px;
      }

      .qa-row.is-selected .qa-subtitle {
        color: #c6d8ff;
      }

      .qa-hint {
        color: #9ca3af;
        font-size: 14px;
      }

      .qa-row.is-selected .qa-hint {
        color: #ffffff;
      }

      .qa-panel {
        display: grid;
        min-height: 220px;
        place-items: center;
        padding: 24px;
        text-align: center;
      }

      .qa-panel-title {
        margin-bottom: 8px;
        color: #ffffff;
        font-size: 17px;
        font-weight: 700;
      }

      .qa-panel-copy {
        max-width: 460px;
        margin: 0 auto 18px;
        color: #a8b0bf;
        font-size: 13px;
        line-height: 1.5;
      }

      .qa-unlock-form {
        width: min(420px, 100%);
      }

      .qa-password {
        width: 100%;
        height: 40px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
        padding: 0 12px;
        font-size: 14px;
        outline: 0;
      }

      .qa-password:focus {
        border-color: rgba(85, 158, 255, 0.9);
        box-shadow: 0 0 0 4px rgba(83, 154, 255, 0.16);
      }

      .qa-row:focus-visible,
      .qa-clear:focus-visible,
      .qa-action:focus-visible,
      .qa-primary:focus-visible,
      .qa-secondary:focus-visible {
        outline: 2px solid rgba(85, 158, 255, 0.92);
        outline-offset: 2px;
      }

      .qa-unlock-actions {
        display: flex;
        margin-top: 12px;
        gap: 10px;
      }

      .qa-primary,
      .qa-secondary {
        height: 36px;
        border: 0;
        border-radius: 8px;
        padding: 0 14px;
        font-size: 13px;
        font-weight: 700;
      }

      .qa-primary {
        flex: 1;
        background: #1268dc;
        color: #ffffff;
      }

      .qa-primary:disabled {
        background: #41506a;
        color: #a8b0bf;
      }

      .qa-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: #dbeafe;
      }

      .qa-error {
        margin-top: 10px;
        color: #fca5a5;
        font-size: 13px;
        font-weight: 700;
      }

      .qa-footer {
        display: flex;
        box-sizing: border-box;
        height: 40px;
        align-items: center;
        justify-content: center;
        gap: 22px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        padding: 6px 16px;
      }

      .qa-action {
        display: flex;
        min-height: 30px;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: #cbd5e1;
        font-size: 12px;
        font-weight: 600;
      }

      .qa-action:hover:not(:disabled) {
        color: #ffffff;
      }

      .qa-action:disabled {
        color: rgba(255, 255, 255, 0.4);
      }

      .qa-key {
        display: inline-flex;
        min-width: 24px;
        height: 22px;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(203, 213, 225, 0.28);
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.08);
        color: inherit;
        padding: 0 7px;
        font-size: 11px;
      }

      .qa-status {
        position: fixed;
        left: 50%;
        bottom: 48px;
        transform: translateX(-50%);
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.92);
        color: #ffffff;
        padding: 6px 12px;
        font-size: 12px;
        font-weight: 700;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.24);
      }
    `,
  ],
})
export class QuickAccessComponent implements OnInit, OnDestroy {
  protected readonly AuthenticationStatus = AuthenticationStatus;
  protected authStatus: AuthenticationStatus | null = null;
  protected currentResults: QuickAccessResult[] = [];
  protected isSearching = false;
  protected searchText = "";
  protected selectedIndex = 0;
  protected statusMessageKey = "";

  private activeRequestId = "";
  private activeCopyRequestId = "";
  private requestSequence = 0;
  private readonly destroy$ = new Subject<void>();
  private readonly searchText$ = new Subject<string>();

  constructor(
    private broadcasterService: BroadcasterService,
    private changeDetectorRef: ChangeDetectorRef,
    private elementRef: ElementRef<HTMLElement>,
    private messagingService: MessagingService,
    private ngZone: NgZone,
  ) {}

  ngOnInit() {
    this.searchText$
      .pipe(
        debounceTime(SearchTextDebounceInterval),
        distinctUntilChanged(),
        takeUntil(this.destroy$),
      )
      .subscribe((query) => this.requestSearch(query));

    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      if (message.command === "quickAccessShown") {
        this.resetSearch();
        return;
      }

      if (message.command === "quickAccessSearchResponse") {
        this.handleSearchResponse(message);
        return;
      }

      if (message.command === "quickAccessCopyResponse") {
        this.handleCopyResponse(message);
      }
    });

    this.resetSearch();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  protected get selectedResult() {
    return this.currentResults[this.selectedIndex] ?? null;
  }

  protected search(searchText: string) {
    this.searchText = searchText ?? "";
    this.statusMessageKey = "";
    this.searchText$.next(this.searchText);
  }

  protected clearSearch() {
    this.search("");
    this.focusSearchSoon();
  }

  protected close() {
    this.clearLocalState();
    this.messagingService.send("quickAccessHide");
  }

  protected openSignIn() {
    this.messagingService.send("quickAccessOpenApp", {
      route: ["/login"],
    });
  }

  protected openUnlock() {
    this.messagingService.send("quickAccessOpenApp", {
      route: ["/lock"],
    });
  }

  protected openSelected() {
    const result = this.selectedResult;
    if (result == null) {
      return;
    }

    this.messagingService.send("quickAccessOpenCipher", {
      cipherId: result.cipherId,
      searchText: this.searchText.trim(),
    });
  }

  protected copySelected(action: QuickAccessCopyAction, event?: MouseEvent) {
    event?.stopPropagation();

    const result = this.selectedResult;
    if (result == null || !this.isQuickAccessCopyAction(action)) {
      return;
    }

    const requestId = `quick-access-copy-${Date.now()}-${++this.requestSequence}`;
    this.activeCopyRequestId = requestId;
    this.messagingService.send("quickAccessCopyRequest", {
      requestId,
      cipherId: result.cipherId,
      action,
    });
    this.changeDetectorRef.markForCheck();
  }

  protected handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      this.close();
      return;
    }

    if (this.authStatus !== AuthenticationStatus.Unlocked) {
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      const key = event.key.toLowerCase();

      if (key === "u") {
        event.preventDefault();
        void this.copySelected("username");
        return;
      }

      if (key === "p") {
        event.preventDefault();
        void this.copySelected("password");
        return;
      }
    }

    if (this.currentResults.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentResults.length - 1);
      this.changeDetectorRef.markForCheck();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.changeDetectorRef.markForCheck();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      this.openSelected();
    }
  }

  protected trackByCipher(_index: number, result: QuickAccessResult) {
    return result.cipherId;
  }

  private resetSearch() {
    this.clearLocalState();
    this.requestSearch("");
    this.focusSearchSoon();
  }

  private clearLocalState() {
    this.searchText = "";
    this.currentResults = [];
    this.selectedIndex = 0;
    this.statusMessageKey = "";
    this.changeDetectorRef.markForCheck();
    this.requestResize();
  }

  private requestSearch(query: string) {
    const requestId = `quick-access-${Date.now()}-${++this.requestSequence}`;
    this.activeRequestId = requestId;
    this.isSearching = true;
    this.changeDetectorRef.markForCheck();
    this.requestResize();

    this.messagingService.send("quickAccessSearchRequest", {
      requestId,
      query: query ?? "",
    });
  }

  private handleSearchResponse(message: {
    requestId: string;
    authStatus: AuthenticationStatus;
    results?: QuickAccessResult[];
  }) {
    if (message.requestId !== this.activeRequestId) {
      return;
    }

    this.authStatus = message.authStatus;
    this.currentResults = message.results ?? [];
    this.selectedIndex = 0;
    this.isSearching = false;
    this.changeDetectorRef.markForCheck();
    this.focusSearchSoon();
    this.requestResize();
  }

  private handleCopyResponse(message: {
    requestId: string;
    copied: boolean;
    action: QuickAccessCopyAction;
  }) {
    if (message.requestId !== this.activeCopyRequestId) {
      return;
    }

    this.statusMessageKey = message.copied
      ? message.action === "username"
        ? "usernameCopied"
        : "passwordCopied"
      : "";
    this.changeDetectorRef.markForCheck();
  }

  private requestResize() {
    const height = this.calculateHeight();

    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.messagingService.send("quickAccessResize", { height });
      });
    });
  }

  private calculateHeight() {
    if (this.authStatus == null) {
      return SearchOnlyHeight;
    }

    if (this.authStatus !== AuthenticationStatus.Unlocked) {
      return PanelHeight;
    }

    if (this.currentResults.length === 0) {
      return SearchOnlyHeight;
    }

    return (
      SearchOnlyHeight +
      ResultsPaddingHeight +
      this.currentResults.length * ResultRowHeight +
      FooterHeight
    );
  }

  private isQuickAccessCopyAction(action: string): action is QuickAccessCopyAction {
    return action === "username" || action === "password";
  }

  private focusSearchSoon() {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() =>
        this.elementRef.nativeElement.querySelector<HTMLInputElement>(".qa-search-input")?.focus(),
      );
    });
  }
}
