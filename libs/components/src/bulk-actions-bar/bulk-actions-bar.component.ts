import { FocusKeyManager } from "@angular/cdk/a11y";
import { DOCUMENT } from "@angular/common";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  afterNextRender,
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

import { MenuItemComponent } from "../menu/menu-item.component";
import { MenuTriggerForDirective } from "../menu/menu-trigger-for.directive";
import { MenuComponent } from "../menu/menu.component";

import { BulkActionComponent } from "./bulk-action.component";
import { BULK_ACTIONS_BAR_CONTEXT, BulkActionsBarContext } from "./bulk-actions-bar-context";

/**
 * Slack between the bar's intrinsic width and the wrapper width that triggers
 * compact mode. Engaging compact while the bar still has breathing room avoids
 * a "just barely fits" state where the bar visually crowds the viewport.
 */
const COMPACT_THRESHOLD_BUFFER_PX = 48;

@Component({
  selector: "bit-bulk-actions-bar",
  templateUrl: "./bulk-actions-bar.component.html",
  imports: [I18nPipe, BulkActionComponent, MenuComponent, MenuTriggerForDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(document:keydown)": "handleShortcut($event)",
  },
  providers: [{ provide: BULK_ACTIONS_BAR_CONTEXT, useExisting: BulkActionsBarComponent }],
})
export class BulkActionsBarComponent implements BulkActionsBarContext, AfterViewInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly i18nService = inject(I18nService);

  readonly selectedCount = input.required<number>();

  private readonly clear$ = new Subject<void>();
  readonly clear = outputFromObservable(this.clear$);

  protected readonly bar = viewChild<ElementRef<HTMLElement>>("bar");
  protected readonly wrapper = viewChild.required<ElementRef<HTMLElement>>("wrapper");
  protected readonly closeBtn = viewChild(BulkActionComponent);

  readonly additionalActionsTrigger = viewChild("additionalActionsTrigger", {
    read: BulkActionComponent,
  });

  private readonly actions = contentChildren(BulkActionComponent);
  private readonly additionalActions = contentChildren(MenuItemComponent);
  protected readonly hasAdditionalActions = computed(() => this.additionalActions().length > 0);

  protected readonly visible = computed(() => this.selectedCount() > 0);

  /**
   * The bar's intrinsic width (in px) measured once after first render, when all
   * action labels are visible. Used both as the cap (`max-width`) and as the
   * threshold for entering compact mode.
   */
  protected readonly initialBarWidth = signal(0);

  /** True when the wrapper is narrower than the bar's intrinsic width. */
  readonly compact = signal(false);

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
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const barEl = this.bar()?.nativeElement;
      const wrapperEl = this.wrapper().nativeElement;
      if (!barEl) {
        return;
      }

      // Measure the bar's intrinsic width once. Pinning `min-width: max-content`
      // for the read prevents the bar's flex parent from shrinking it below its
      // content size when the bar mounts in a constrained context. Even if the
      // measurement is slightly off, the `COMPACT_THRESHOLD_BUFFER_PX` below
      // absorbs the imprecision — the bar is never width-capped, so an
      // under-read just causes compact mode to engage a few pixels earlier.
      const previousMinWidth = barEl.style.minWidth;
      barEl.style.minWidth = "max-content";
      this.initialBarWidth.set(Math.ceil(barEl.getBoundingClientRect().width));
      barEl.style.minWidth = previousMinWidth;

      const observer = new ResizeObserver(() => {
        const threshold = this.initialBarWidth() + COMPACT_THRESHOLD_BUFFER_PX;
        this.compact.set(wrapperEl.clientWidth < threshold);
      });
      observer.observe(wrapperEl);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  ngAfterViewInit(): void {
    // Built in ngAfterViewInit (not ngAfterContentInit) so the additional-
    // actions trigger — which only renders once the bitMenuItem content
    // children resolve and the @if branch ticks through — is available.
    const closeBtn = this.closeBtn();
    if (closeBtn == null) {
      return;
    }
    const items: BulkActionComponent[] = [closeBtn, ...this.actions()];
    const trigger = this.additionalActionsTrigger();
    if (trigger) {
      items.push(trigger);
    }

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
