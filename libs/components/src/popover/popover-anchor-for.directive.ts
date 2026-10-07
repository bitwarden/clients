import {
  Directive,
  ElementRef,
  OnDestroy,
  ViewContainerRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from "@angular/core";

import { PositionIdentifier } from "./default-positions";
import { PopoverPanelComponent } from "./popover-panel.component";
import { PopoverRef } from "./popover-ref";
import { PopoverComponent } from "./popover.component";
import { PopoverAnchorRef, PopoverService, resolveAnchor } from "./popover.service";

/** Default for `anchor`; templates can't produce it, so unbound is distinguishable from a bound `null`. */
const UNBOUND = Symbol("unbound anchor");

/** Implement and provide as `useExisting` to redirect `[bitPopoverAnchorFor]` from the host to another element. */
export abstract class PopoverElementProvider {
  abstract readonly popoverAnchorElementRef: ElementRef<HTMLElement>;
}

/**
 * Directive that anchors a popover to any element with programmatic open/close control.
 * Use `[(popoverOpen)]` for two-way binding to control visibility from the host component.
 *
 * @example
 * Basic usage:
 * ```html
 * <div [bitPopoverAnchorFor]="myPopover" [(popoverOpen)]="isOpen">
 *   Anchor element
 * </div>
 * <bit-popover #myPopover>Popover content</bit-popover>
 * ```
 *
 * @example
 * With spotlight effect:
 * ```html
 * <div [bitPopoverAnchorFor]="myPopover"
 *      [(popoverOpen)]="isOpen"
 *      [spotlight]="true"
 * >
 *   Anchor element
 * </div>
 * ```
 *
 * @example
 * Anchored to an element a component exposes, from an `<ng-container>` anywhere in the template:
 * ```html
 * <bit-table-toolbar #toolbar>…</bit-table-toolbar>
 * <ng-container [bitPopoverAnchorFor]="myPopover" [anchor]="toolbar.filterButton"
 *   [(popoverOpen)]="isOpen" />
 * ```
 *
 * Use `PopoverTriggerForDirective` instead if the popover should open on user click, or
 * `PopoverService` to open one from code.
 */
@Directive({
  selector: "[bitPopoverAnchorFor]",
  exportAs: "popoverAnchor",
})
export class PopoverAnchorForDirective implements OnDestroy {
  /** Controls popover visibility. Supports two-way binding with `[(popoverOpen)]` */
  readonly popoverOpen = model(false);

  /** The popover component to display */
  readonly popover = input.required<PopoverComponent | PopoverPanelComponent>({
    alias: "bitPopoverAnchorFor",
  });

  /** Whether clicking the backdrop closes the popover. Defaults to true. */
  readonly closeOnBackdropClick = input<boolean>(true);

  /** Preferred popover position (e.g., "right-start", "below-center") */
  readonly position = input<PositionIdentifier>();

  /** Enable spotlight effect that dims everything except the anchor element */
  readonly spotlight = input<boolean>(false);

  /**
   * Anchor to this element, or a signal of one such as a component's public `viewChild`, instead
   * of the host. Unbound anchors to the host; a bound `null` or `undefined` waits until it resolves.
   */
  readonly anchor = input<PopoverAnchorRef | typeof UNBOUND>(UNBOUND);

  private readonly popoverElementProvider = inject<PopoverElementProvider>(PopoverElementProvider, {
    host: true,
    optional: true,
  });
  private readonly hostElementRef = this.popoverElementProvider
    ? this.popoverElementProvider.popoverAnchorElementRef
    : inject<ElementRef<HTMLElement>>(ElementRef);

  /** The bound `anchor`'s element; `undefined` while unbound or unresolved. */
  private readonly anchorElement = computed(() => {
    const anchor = this.anchor();
    return anchor === UNBOUND ? undefined : resolveAnchor(anchor);
  });

  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly popoverService = inject(PopoverService);

  private ref: PopoverRef | null = null;
  private readonly hasInitialized = signal(false);
  private isDestroyed = false;

  constructor() {
    // Wait for the first render to complete so layout is stable before opening.
    // Sets a signal so the effect below re-evaluates once the layout is ready.
    afterNextRender(() => this.hasInitialized.set(true));

    effect(() => {
      if (this.isDestroyed) {
        return;
      }
      if (!this.popoverOpen()) {
        untracked(() => this.disposeRef());
        return;
      }
      if (this.hasInitialized()) {
        untracked(() => this.openPopover());
      }
    });
  }

  /** Programmatically opens the popover */
  openPopover() {
    if (this.ref) {
      return;
    }
    this.popoverOpen.set(true);

    // The host is read at open time, since a `PopoverElementProvider` may rebind it after init
    const anchor = this.anchor() === UNBOUND ? this.hostElement() : this.anchorElement;
    const ref = this.popoverService.open(this.popover(), anchor, {
      position: this.position(),
      spotlight: this.spotlight(),
      closeOnBackdropClick: this.closeOnBackdropClick(),
      viewContainerRef: this.viewContainerRef,
    });
    this.ref = ref;
    ref.closed.subscribe(() => {
      if (this.ref === ref) {
        this.ref = null;
        this.popoverOpen.set(false);
      }
    });
  }

  /** Programmatically closes the popover */
  closePopover() {
    this.popoverOpen.set(false);
    this.disposeRef();
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.disposeRef();
  }

  private hostElement(): HTMLElement | undefined {
    // An `<ng-container>` host is a comment node, which can't be anchored to
    const host = this.hostElementRef.nativeElement;
    return host instanceof HTMLElement ? host : undefined;
  }

  private disposeRef() {
    const ref = this.ref;
    this.ref = null;
    ref?.close();
  }
}
