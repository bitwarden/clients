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
import { OverflowItemDirective } from "../overflow-list/overflow-item.directive";
import { OverflowListDirective } from "../overflow-list/overflow-list.directive";
import { OverflowTriggerDirective } from "../overflow-list/overflow-trigger.directive";

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

  readonly selectedCount = input.required<number>();

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

  protected readonly visible = computed(() => this.selectedCount() > 0);

  /**
   * The bar's intrinsic width (in px), remeasured whenever the rendered toolbar
   * buttons change. Used both as the cap (`max-width`) and as the threshold for
   * entering compact mode.
   */
  protected readonly initialBarWidth = signal(0);

  /** Wrapper's live `clientWidth` — fed into both the compact threshold and `overflowContainerWidth`. */
  private readonly wrapperWidth = signal(0);

  /**
   * Width of the bar's non-overflow shell (count display + clear button + bar
   * padding + bar gaps), measured once at compact state. Subtracted from
   * `wrapperWidth` to derive the overflow list's container width.
   */
  private readonly reservedShellWidth = signal(0);

  /**
   * Available width for the primary-actions row, fed to the `OverflowListDirective`.
   * Pointing the directive at the wrapper-derived width avoids a feedback loop:
   * if it observed its own host, hiding an item would shrink the host and
   * trigger more overflow. Returns `null` until measurements land — keeps the
   * directive in its "all displayed" default for the brief pre-measure window.
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
   * True when the wrapper is narrower than the bar's intrinsic width.
   *
   * Defaults to `true` so the OverflowListDirective measures items at their
   * compact widths on the first pass — those cached widths drive packing once
   * the bar is in compact mode. `measureIntrinsicWidth` flips this off when
   * the wrapper is wide enough to fit the full-label bar.
   */
  readonly compact = signal(true);

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
    const injector = inject(Injector);
    this.initResizeObserver();

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
      const wrapperEl = this.wrapper().nativeElement;
      // Prime the signal so dependent computed signals (compact threshold,
      // container width) have a real value before the first RO dispatch.
      this.wrapperWidth.set(wrapperEl.clientWidth);

      const observer = new ResizeObserver(() => {
        const width = wrapperEl.clientWidth;
        this.wrapperWidth.set(width);
        // Don't touch `compact` until `measureIntrinsicWidth` has produced a
        // real threshold — otherwise we'd flip to non-compact while items are
        // still rendering compact, and the overflow directive would cache the
        // wrong widths during that window.
        if (this.initialBarWidth() === 0) {
          return;
        }
        this.compact.set(width < this.initialBarWidth() + COMPACT_THRESHOLD_BUFFER_PX);
      });
      observer.observe(wrapperEl);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private measureIntrinsicWidth(): void {
    const barEl = this.bar()?.nativeElement;
    const wrapperEl = this.wrapper().nativeElement;
    const overflowEl = this.overflowHost()?.nativeElement;
    if (!barEl) {
      return;
    }

    const trigger = this.additionalActionsTrigger();
    const primaries = this.primaryButtons();
    const labeledButtons = primaries.filter((btn) => btn !== trigger);

    // Items hidden by the overflow directive (attribute + inline display)
    // report zero from `getBoundingClientRect`. Reveal them for both passes
    // and restore on the way out; the directive re-applies the right hidden
    // states on the next reactive pass.
    const restorePrimaries = primaries.map((btn) => reveal(btn.elementRef.nativeElement));

    // Pass 1: compact shell width. With items revealed and the bar in its
    // natural (compact) state, the overflow host's content is `items_total`,
    // so `bar - host` isolates the shell (count + clear + bar padding + gaps).
    // Must run before Pass 2, which inflates the bar.
    const shellWidth = overflowEl ? measureWidth(barEl) - measureWidth(overflowEl) : 0;

    // Pass 2: full bar width. Force labels visible and pin `min-width:
    // max-content` so a constrained flex parent can't compress the bar below
    // its full content. Mutate → measure → restore is synchronous, so the
    // browser never paints the expanded state. The additional-actions
    // trigger stays icon-only by design.
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
    if (shellWidth > 0) {
      this.reservedShellWidth.set(shellWidth);
    }
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

function measureWidth(el: HTMLElement): number {
  return Math.ceil(el.getBoundingClientRect().width);
}

/**
 * Temporarily unhide an element so its natural width can be read. Returns a
 * function that restores the prior `hidden` and inline `display` state.
 */
function reveal(el: HTMLElement): () => void {
  const prevHidden = el.hidden;
  const prevDisplay = el.style.display;
  el.hidden = false;
  el.style.display = "";
  return () => {
    el.hidden = prevHidden;
    el.style.display = prevDisplay;
  };
}
