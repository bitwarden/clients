import { FocusKeyManager } from "@angular/cdk/a11y";
import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  contentChildren,
  effect,
  inject,
  input,
  signal,
  viewChild,
  viewChildren,
} from "@angular/core";
import { outputFromObservable, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { IconComponent } from "../icon/icon.component";
import { MenuItemComponent } from "../menu/menu-item.component";
import { MenuTriggerForDirective } from "../menu/menu-trigger-for.directive";
import { MenuComponent } from "../menu/menu.component";

import { BulkActionButtonComponent } from "./bulk-action-button.component";
import { BulkActionComponent } from "./bulk-action.component";
import { BulkAdditionalActionComponent } from "./bulk-additional-action.component";

/**
 * Slack between the bar's intrinsic width and the wrapper width that triggers
 * compact mode. Engaging compact while the bar still has breathing room avoids
 * a "just barely fits" state where the bar visually crowds the viewport.
 */
const COMPACT_THRESHOLD_BUFFER_PX = 48;

@Component({
  selector: "bit-bulk-actions-bar",
  templateUrl: "./bulk-actions-bar.component.html",
  imports: [
    I18nPipe,
    BulkActionButtonComponent,
    MenuComponent,
    MenuItemComponent,
    MenuTriggerForDirective,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(document:keydown)": "handleShortcut($event)",
  },
})
export class BulkActionsBarComponent {
  private readonly document = inject(DOCUMENT);
  private readonly i18nService = inject(I18nService);

  readonly selectedCount = input.required<number>();

  private readonly clear$ = new Subject<void>();
  readonly clear = outputFromObservable(this.clear$);

  protected readonly bar = viewChild<ElementRef<HTMLElement>>("bar");
  protected readonly wrapper = viewChild.required<ElementRef<HTMLElement>>("wrapper");
  protected readonly closeBtn = viewChild(BulkActionButtonComponent);

  private readonly additionalActionsTrigger = viewChild("additionalActionsTrigger", {
    read: BulkActionButtonComponent,
  });

  // Data-holder children projected by the consumer. The bar reads their inputs and renders
  // both the toolbar buttons and the menu items itself from this data.
  protected readonly primaryActions = contentChildren(BulkActionComponent);
  protected readonly additionalActions = contentChildren(BulkAdditionalActionComponent);
  protected readonly hasAdditionalActions = computed(() => this.additionalActions().length > 0);

  // The toolbar buttons the bar renders for each primary data holder. Sourced via viewChildren
  // (not contentChildren) because the bar renders them itself via @for.
  private readonly primaryButtons = viewChildren(BulkActionButtonComponent);

  protected readonly visible = computed(() => this.selectedCount() > 0);

  /**
   * The bar's intrinsic width (in px) measured once after first render, when all
   * action labels are visible. Used both as the cap (`max-width`) and as the
   * threshold for entering compact mode.
   */
  protected readonly initialBarWidth = signal(0);

  /** True when the wrapper is narrower than the bar's intrinsic width. */
  readonly compact = signal(false);

  // Seeded from navigator so the first announcement (which can fire before any
  // keypress) has a sensible label; `handleShortcut` upgrades this to ground
  // truth as soon as a real Cmd/Ctrl-bearing keydown is observed.
  private readonly modifierKey = signal<"Command" | "Ctrl">(this.detectInitialModifier());

  protected readonly announcement = computed(() => {
    if (this.selectedCount() === 0) {
      return this.i18nService.t("selectionCleared");
    }
    return this.i18nService.t(
      "bulkActionsBarAnnouncement",
      this.selectedCount(),
      `${this.modifierKey()}+B`,
    );
  });

  protected readonly barStateClasses = computed(() =>
    this.visible() ? "tw-pointer-events-auto" : "tw-translate-y-[110%] tw-opacity-0",
  );

  // Stashes whatever was focused on the page before the bar took focus, so
  // a second shortcut press can restore it (the same pattern CDK Overlay
  // uses internally).
  private readonly previousFocus = signal<HTMLElement | null>(null);

  private readonly keyManager = signal<FocusKeyManager<BulkActionButtonComponent> | undefined>(
    undefined,
  );
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.initResizeObserver();

    // FocusKeyManager captures button references at construction. Rebuild it
    // whenever the projected action set changes so it tracks the current
    // buttons; onCleanup destroys the previous manager on each rebuild and
    // on component destroy.
    effect((onCleanup) => {
      const closeBtn = this.closeBtn();
      if (closeBtn == null) {
        return;
      }
      const trigger = this.additionalActionsTrigger();
      const primaries = this.primaryButtons().filter((b) => b !== closeBtn && b !== trigger);
      const items = trigger ? [closeBtn, ...primaries, trigger] : [closeBtn, ...primaries];

      const manager = new FocusKeyManager<BulkActionButtonComponent>(items)
        .withHorizontalOrientation("ltr")
        .withWrap()
        .withHomeAndEnd();
      this.keyManager.set(manager);
      manager.updateActiveItem(0);
      this.applyRovingTabIndex(0, items);

      manager.change
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((idx) => this.applyRovingTabIndex(idx, items));

      onCleanup(() => manager.destroy());
    });
  }

  protected onClear(): void {
    this.clear$.next();
    this.restorePreviousFocus();
  }

  protected onToolbarKeydown(event: KeyboardEvent): void {
    this.keyManager()?.onKeydown(event);
  }

  private initResizeObserver(): void {
    afterNextRender(() => {
      const barEl = this.bar()?.nativeElement;
      const wrapperEl = this.wrapper().nativeElement;
      if (!barEl) {
        return;
      }

      // Pin `min-width: max-content` for the read so the flex parent can't
      // shrink the bar below content size when mounted in a constrained
      // context. `COMPACT_THRESHOLD_BUFFER_PX` absorbs any imprecision.
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

  protected handleShortcut(event: KeyboardEvent): void {
    // Real keydown events are the source of truth for the announcement
    // label, overriding the navigator-based initial guess. Runs even when
    // hidden so the label is primed before the first announcement.
    if (event.metaKey && !event.ctrlKey) {
      this.modifierKey.set("Command");
    } else if (event.ctrlKey && !event.metaKey) {
      this.modifierKey.set("Ctrl");
    }

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

  private applyRovingTabIndex(activeIdx: number | null, items: BulkActionButtonComponent[]): void {
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

  private detectInitialModifier(): "Command" | "Ctrl" {
    const nav = this.document.defaultView?.navigator;
    const isMac = nav?.platform?.startsWith("Mac") || /Macintosh/.test(nav?.userAgent ?? "");
    return isMac ? "Command" : "Ctrl";
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
