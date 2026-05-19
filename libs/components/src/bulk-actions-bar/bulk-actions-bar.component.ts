import { FocusKeyManager } from "@angular/cdk/a11y";
import { DOCUMENT } from "@angular/common";
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  contentChildren,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { outputFromObservable } from "@angular/core/rxjs-interop";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { BulkActionComponent } from "./bulk-action.component";

@Component({
  selector: "bit-bulk-actions-bar",
  templateUrl: "./bulk-actions-bar.component.html",
  imports: [I18nPipe, BulkActionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(document:keydown)": "handleShortcut($event)",
  },
})
export class BulkActionsBarComponent implements AfterContentInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly i18nService = inject(I18nService);

  readonly selectedCount = input.required<number>();

  private readonly clear$ = new Subject<void>();
  readonly clear = outputFromObservable(this.clear$);

  protected readonly bar = viewChild<ElementRef<HTMLElement>>("bar");
  protected readonly closeBtn = viewChild(BulkActionComponent);

  private readonly actions = contentChildren(BulkActionComponent);

  protected readonly visible = computed(() => this.selectedCount() > 0);

  private readonly shortcutKey = computed(() => {
    const nav = this.document.defaultView?.navigator;
    return nav?.platform?.startsWith("Mac") || /Macintosh/.test(nav?.userAgent ?? "")
      ? "Command"
      : "Ctrl";
  });

  protected readonly announcement = computed(() => {
    if (this.selectedCount() === 0) {
      return this.i18nService.t("selectionCleared");
    }
    return this.i18nService.t(
      "bulkActionsBarAnnouncement",
      this.selectedCount(),
      this.shortcutKey(),
    );
  });

  protected readonly barStateClasses = computed(() =>
    this.visible() ? "tw-pointer-events-auto" : "tw-translate-y-[110%] tw-opacity-0",
  );

  // Stashes whatever was focused on the page before the bar took focus, so
  // a second shortcut press can restore it (the same pattern CDK Overlay
  // uses internally).
  private readonly previousFocus = signal<HTMLElement | null>(null);

  private readonly keyManager = signal<FocusKeyManager<BulkActionComponent> | undefined>(undefined);
  private readonly destroy$ = new Subject<void>();

  ngAfterContentInit(): void {
    const closeBtn = this.closeBtn();
    if (closeBtn == null) {
      return;
    }
    const items: BulkActionComponent[] = [closeBtn, ...this.actions()];

    const manager = new FocusKeyManager<BulkActionComponent>(items)
      .withHorizontalOrientation("ltr")
      .withWrap()
      .withHomeAndEnd();
    this.keyManager.set(manager);

    // Make the first item the toolbar's tab stop. updateActiveItem sets
    // the active index without calling .focus(), which is what we want at
    // init — focus only moves when the user actually navigates.
    manager.updateActiveItem(0);
    this.applyRovingTabIndex(0, items);

    manager.change.pipe(takeUntil(this.destroy$)).subscribe((activeIdx) => {
      this.applyRovingTabIndex(activeIdx, items);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.keyManager()?.destroy();
  }

  protected onClear(): void {
    this.clear$.next();
    this.restorePreviousFocus();
  }

  protected onToolbarKeydown(event: KeyboardEvent): void {
    this.keyManager()?.onKeydown(event);
  }

  protected handleShortcut(event: KeyboardEvent): void {
    if (!this.visible()) {
      return;
    }

    // Cmd+B (Mac) or Ctrl+B (Windows/Linux) — exactly one of metaKey/ctrlKey.
    if (event.key.toLowerCase() !== "b" || event.metaKey === event.ctrlKey) {
      return;
    }
    event.preventDefault();

    const root = this.bar()?.nativeElement;
    const active = this.document.activeElement as HTMLElement | null;

    if (root && active && root.contains(active)) {
      this.restorePreviousFocus();
      return;
    }

    this.previousFocus.set(active && active !== this.document.body ? active : null);
    this.keyManager()?.setFirstItemActive();
  }

  private applyRovingTabIndex(activeIdx: number | null, items: BulkActionComponent[]): void {
    items.forEach((item, i) => {
      item.tabIndex.set(i === activeIdx ? 0 : -1);
    });
  }

  private restorePreviousFocus(): void {
    const prev = this.previousFocus();
    this.previousFocus.set(null);
    if (prev && prev.isConnected && this.isFocusable(prev)) {
      prev.focus();
    } else {
      this.document.body.focus();
    }
  }

  private isFocusable(el: HTMLElement): boolean {
    return !el.hasAttribute("disabled") && el.tabIndex !== -1;
  }

  protected readonly elementWithDividerClasses = [
    "tw-relative",
    "after:tw-content-['']",
    "after:tw-absolute",
    "after:tw-bg-bg-brand-strong",
    "after:tw-w-px",
    "after:tw-h-8",
    "after:tw-end-0",
    "after:tw-translate-x-[calc(theme(spacing.2)_+_1px)]",
    "after:tw-inset-y-0",
    "after:tw-my-auto",
  ];
}
