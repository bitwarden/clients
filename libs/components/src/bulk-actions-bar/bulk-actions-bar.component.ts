import { FocusKeyManager } from "@angular/cdk/a11y";
import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  contentChildren,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from "@angular/core";
import { outputFromObservable, takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Subject } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { IconComponent } from "../icon/icon.component";
import { MenuDividerComponent } from "../menu/menu-divider.component";
import { MenuItemComponent } from "../menu/menu-item.component";
import { MenuTriggerForDirective } from "../menu/menu-trigger-for.directive";
import { MenuComponent } from "../menu/menu.component";
import {
  OverflowItemDirective,
  OverflowListDirective,
  OverflowTriggerDirective,
  measureWidth,
  observedWidth,
  revealForMeasurement,
} from "../overflow-list";
import { BitTableV2Component } from "../table/v2/table-v2.component";

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
    MenuDividerComponent,
    IconComponent,
    OverflowListDirective,
    OverflowItemDirective,
    OverflowTriggerDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(document:keydown)": "handleShortcut($event)",
  },
})
export class BulkActionsBarComponent {
  private readonly document = inject(DOCUMENT);
  private readonly i18nService = inject(I18nService);

  /**
   * Optional ancestor table. When present, the bar reads selection state from
   * `table.selectionModel()` and clears it on dismiss, so consumers don't need to
   * wire `[selectedCount]` or `(clear)` explicitly. Used standalone or as a
   * sibling, the bar falls back to the consumer-provided input.
   */
  private readonly table = inject(BitTableV2Component, { optional: true });

  /**
   * Number of currently-selected items. Optional: when projected into a
   * `<bit-table-v2>` with a `[selection]` model, the bar derives this from
   * the table automatically (see {@link effectiveCount}).
   */
  readonly selectedCount = input<number | undefined>(undefined);

  /** Explicit input wins; otherwise infer from ancestor table; otherwise 0. */
  protected readonly effectiveCount = computed(
    () => this.selectedCount() ?? this.table?.selectionModel()?.count() ?? 0,
  );

  private readonly clear$ = new Subject<void>();
  readonly clear = outputFromObservable(this.clear$);

  protected readonly bar = viewChild<ElementRef<HTMLElement>>("bar");
  protected readonly wrapper = viewChild.required<ElementRef<HTMLElement>>("wrapper");
  protected readonly closeBtn = viewChild(BulkActionButtonComponent);
  protected readonly overflowList = viewChild.required(OverflowListDirective);
  private readonly overflowHost = viewChild<ElementRef<HTMLElement>>("overflowHost");

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

  protected readonly visible = computed(() => this.effectiveCount() > 0);

  /**
   * The bar's intrinsic width (in px), remeasured whenever the rendered toolbar
   * buttons change. Used both as the cap (`max-width`) and as the threshold for
   * entering compact mode.
   */
  protected readonly initialBarWidth = signal(0);

  /** Wrapper's live width — fed into both the compact threshold and `overflowContainerWidth`. */
  private readonly wrapperWidth = observedWidth(() => this.wrapper());

  /**
   * Width of the bar's non-overflow shell (count display + clear button + bar
   * padding and gaps), only ever measured at compact density.
   */
  private readonly reservedShellWidth = signal(0);

  /**
   * Available width for the primary-actions row, fed to the `OverflowListDirective`.
   * Deriving it from the wrapper rather than letting the directive observe its own
   * host avoids a feedback loop, where hiding an item shrinks the host and
   * overflows another. `null` until measured, keeping the directive at its
   * all-displayed default.
   */
  protected readonly overflowContainerWidth = computed<number | null>(() => {
    const wrapperW = this.wrapperWidth();
    const reserved = this.reservedShellWidth();
    if (wrapperW === 0 || reserved === 0) {
      return null;
    }
    return Math.max(0, wrapperW - reserved);
  });

  /**
   * True when the wrapper is narrower than the bar's intrinsic width. Defaults
   * to `true` so the first measurement pass captures compact widths and the
   * compact shell; `measureIntrinsicWidth` flips it off when the wrapper fits
   * the full-label bar.
   */
  readonly compact = signal(true);

  // Seeded from navigator so the first announcement (which can fire before any
  // keypress) has a sensible label; `handleShortcut` upgrades this to ground
  // truth as soon as a real Cmd/Ctrl-bearing keydown is observed.
  private readonly modifierKey = signal<"Command" | "Ctrl">(this.detectInitialModifier());

  protected readonly announcement = computed(() => {
    if (this.effectiveCount() === 0) {
      return this.i18nService.t("selectionCleared");
    }
    return this.i18nService.t(
      "bulkActionsBarAnnouncement",
      this.effectiveCount(),
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
  /** The items backing the current `keyManager`, in the order it navigates them. */
  private readonly managedItems = signal<BulkActionButtonComponent[]>([]);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const injector = inject(Injector);

    // Compact engages when the wrapper is narrower than the bar's intrinsic width.
    // `initialBarWidth` is read untracked: it's a snapshot threshold, and tracking it
    // would re-evaluate compact on every remeasure — and since intrinsic width itself
    // depends on density (button padding follows `compact`), that closes a flip loop.
    // Both zero guards mean "not measured yet"; `measureIntrinsicWidth` sets the
    // initial state itself.
    effect(() => {
      const width = this.wrapperWidth();
      const intrinsic = untracked(this.initialBarWidth);
      if (width === 0 || intrinsic === 0) {
        return;
      }
      this.compact.set(width < intrinsic + COMPACT_THRESHOLD_BUFFER_PX);
    });

    // Remeasure whenever the projected action set changes. Gated on
    // `overflowList.ready()` so this function's forced-label DOM mutation
    // doesn't race with the directive's own first-pass measurement.
    effect(() => {
      const buttons = this.primaryButtons();
      if (buttons.length === 0 || !this.overflowList().ready()) {
        return;
      }
      afterNextRender(() => this.measureIntrinsicWidth(), { injector });
    });

    // `compact` swaps label visibility and button padding, so item widths change
    // with it, but the directive only remeasures on item-set changes. Without
    // this, widths cached while wide would drive packing once we narrow.
    effect(() => {
      this.compact();
      this.overflowList().remeasure();
    });

    // The shell contains the count text and the clear button, so its width tracks
    // digit count and density — a reserve captured at `9` is wrong at `100`.
    effect(() => {
      this.effectiveCount();
      // Only a compact reading is usable: a non-compact shell (clear button
      // showing its label) would inflate the reserve.
      if (!this.overflowList().ready() || !this.compact()) {
        return;
      }
      afterNextRender(
        () => {
          const shellWidth = this.measureShellWidth();
          // Detached / unrendered layout — keep the last usable reading.
          if (shellWidth > 0) {
            this.reservedShellWidth.set(shellWidth);
          }
        },
        { injector },
      );
    });

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
        .withHomeAndEnd()
        .skipPredicate((item) => item.disabled || item.elementRef.nativeElement.hidden !== false);
      this.keyManager.set(manager);
      this.managedItems.set(items);
      manager.updateActiveItem(0);
      this.applyRovingTabIndex(0, items);

      manager.change
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((idx) => this.applyRovingTabIndex(idx, items));

      onCleanup(() => manager.destroy());
    });

    // Packing a button into the menu — or hiding the trigger once nothing
    // overflows — hides it without rebuilding the manager, so a roving tabindex
    // left on it drops the toolbar out of the tab order.
    effect(() => {
      const hidden = this.overflowList().hiddenElements();
      const unavailable = (item: BulkActionButtonComponent) =>
        item.disabled || hidden.has(item.elementRef.nativeElement);

      const manager = this.keyManager();
      const items = this.managedItems();
      const active = items[manager?.activeItemIndex ?? -1];

      if (manager == null || active == null || !unavailable(active)) {
        return;
      }

      // `updateActiveItem` bypasses `skipPredicate`, so pick a target that is
      // actually focusable rather than assuming the close button.
      const next = items.findIndex((item) => !unavailable(item));
      if (next === -1) {
        return;
      }

      const hadFocus = active.elementRef.nativeElement === this.document.activeElement;
      manager.updateActiveItem(next);
      this.applyRovingTabIndex(next, items);
      if (hadFocus) {
        items[next].focus();
      }
    });
  }

  protected onClear(): void {
    this.table?.selectionModel()?.clear();
    this.clear$.next();
    this.restorePreviousFocus();
  }

  protected onToolbarKeydown(event: KeyboardEvent): void {
    this.keyManager()?.onKeydown(event);
  }

  /**
   * Width of everything in the bar except the overflow item row. With the items
   * revealed, the overflow host's content is the full item row, so `bar - host`
   * isolates the shell. Returns 0 for an unmeasurable layout (detached, jsdom).
   */
  private measureShellWidth(): number {
    const barEl = this.bar()?.nativeElement;
    const overflowEl = this.overflowHost()?.nativeElement;
    if (!barEl || !overflowEl) {
      return 0;
    }

    // Hidden items report zero width, so reveal them for the read. The directive
    // re-applies the right hidden states on its next reactive pass.
    const restore = this.primaryButtons().map((btn) =>
      revealForMeasurement(btn.elementRef.nativeElement),
    );
    const shellWidth = measureWidth(barEl) - measureWidth(overflowEl);
    restore.forEach((restoreItem) => restoreItem());

    return shellWidth;
  }

  private measureIntrinsicWidth(): void {
    const barEl = this.bar()?.nativeElement;
    const wrapperEl = this.wrapper().nativeElement;
    if (!barEl) {
      return;
    }

    const trigger = this.additionalActionsTrigger();
    const primaries = this.primaryButtons();
    const labeledButtons = primaries.filter((btn) => btn !== trigger);

    // Hidden items report zero width, so reveal them for the read. `min-width:
    // max-content` stops a constrained flex parent from compressing the bar
    // below its content. Mutate → measure → restore is synchronous, so the
    // expanded state never paints. The additional-actions trigger stays
    // icon-only by design.
    const restorePrimaries = primaries.map((btn) =>
      revealForMeasurement(btn.elementRef.nativeElement),
    );
    const previousMinWidth = barEl.style.minWidth;
    barEl.style.minWidth = "max-content";
    labeledButtons.forEach((btn) => btn.forceLabelVisible(true));
    const barWidth = measureWidth(barEl);
    labeledButtons.forEach((btn) => btn.forceLabelVisible(false));
    barEl.style.minWidth = previousMinWidth;
    restorePrimaries.forEach((restore) => restore());

    // Detached / unrendered layout — bail rather than flip `compact` on a
    // zero-width read.
    if (barWidth === 0) {
      return;
    }
    this.initialBarWidth.set(barWidth);
    this.compact.set(wrapperEl.clientWidth < barWidth + COMPACT_THRESHOLD_BUFFER_PX);
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
    // Pin in place when the bar narrows below its natural content — the
    // overflow host (the bar's flex-auto child) is the only thing that
    // should give ground.
    "tw-shrink-0",
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
