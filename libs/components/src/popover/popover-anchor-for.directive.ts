import { hasModifierKey } from "@angular/cdk/keycodes";
import { Overlay, OverlayConfig, OverlayRef } from "@angular/cdk/overlay";
import { TemplatePortal } from "@angular/cdk/portal";
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
} from "@angular/core";
import { outputToObservable } from "@angular/core/rxjs-interop";
import { Observable, Subscription, filter, mergeWith } from "rxjs";

import { PositionIdentifier, defaultPositions } from "./default-positions";
import { PopoverPanelComponent } from "./popover-panel.component";
import { PopoverComponent } from "./popover.component";
import { SpotlightService } from "./spotlight.service";

/** Finite animations running on the element or its ancestors, e.g. a dialog sliding in. */
function runningAnimations(element: HTMLElement): Animation[] {
  // `getAnimations` is missing in jsdom
  return (document.getAnimations?.() ?? []).filter((animation) => {
    const effect = animation.effect as KeyframeEffect | null;
    return effect?.target?.contains(element) && effect.getComputedTiming().endTime !== Infinity;
  });
}

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
 * <ng-container [bitPopoverAnchorFor]="myPopover" [anchor]="toolbar.anchors.get('filters')"
 *   [(popoverOpen)]="isOpen" />
 * ```
 *
 * Use `PopoverTriggerForDirective` instead if the popover should open on user click.
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
   * Anchor to this rendered element instead of the host, once it finishes animating in.
   * Unbound anchors to the host; a bound `null` or `undefined` hides the popover until it resolves.
   */
  readonly anchor = input<HTMLElement | null | undefined | typeof UNBOUND>(UNBOUND);

  private readonly popoverElementProvider = inject<PopoverElementProvider>(PopoverElementProvider, {
    host: true,
    optional: true,
  });
  private readonly hostElementRef = this.popoverElementProvider
    ? this.popoverElementProvider.popoverAnchorElementRef
    : inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly anchorElement = computed(() => {
    const anchor = this.anchor();
    return anchor === UNBOUND ? undefined : (anchor ?? undefined);
  });
  /** `anchorElement` once it has finished animating into place. */
  private readonly settledAnchor = signal<HTMLElement | undefined>(undefined);
  /** The element the open popover is attached to. */
  private openAnchor: HTMLElement | null = null;

  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly overlay = inject(Overlay);

  private overlayRef: OverlayRef | null = null;
  private closedEventsSub: Subscription | null = null;
  private readonly hasInitialized = signal(false);
  private isDestroyed = false;
  private spotlightService = inject(SpotlightService);

  get positions() {
    if (!this.position()) {
      return defaultPositions;
    }

    const preferredPosition = defaultPositions.find((position) => position.id === this.position());

    if (preferredPosition) {
      return [preferredPosition, ...defaultPositions];
    }

    return defaultPositions;
  }

  get defaultPopoverConfig(): OverlayConfig {
    return {
      hasBackdrop: !this.spotlight(), // Spotlight manages its own backdrop
      backdropClass: "cdk-overlay-transparent-backdrop",
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(
          this.spotlight() && this.spotlightService.overlayElement
            ? new ElementRef(this.spotlightService.overlayElement)
            : (this.openAnchor ?? this.hostElementRef),
        )
        .withPositions(this.positions)
        .withLockedPosition(true)
        .withFlexibleDimensions(false)
        .withPush(true),
    };
  }

  constructor() {
    // Wait for the first render to complete so layout is stable before opening.
    // Sets a signal so the effect below re-evaluates once the layout is ready.
    afterNextRender(() => this.hasInitialized.set(true));

    // Measuring an anchor mid-animation would pin the popover to where it started
    effect(() => {
      const anchor = this.anchorElement();
      const running = anchor ? runningAnimations(anchor) : [];
      if (!running.length) {
        this.settledAnchor.set(anchor);
        return;
      }
      this.settledAnchor.set(undefined);
      void Promise.allSettled(running.map((animation) => animation.finished)).then(() => {
        if (this.anchorElement() === anchor) {
          this.settledAnchor.set(anchor);
        }
      });
    });

    effect(() => {
      if (this.isDestroyed) {
        return;
      }
      const anchor = this.readyAnchor();

      // Losing the anchor keeps `popoverOpen` set, so the popover reattaches when one is ready
      if (this.overlayRef && (!this.popoverOpen() || anchor !== this.openAnchor)) {
        this.disposeAll();
      }

      // Handle opening — hasInitialized() ensures layout is stable on first open
      if (!this.popoverOpen() || this.overlayRef || !this.hasInitialized()) {
        return;
      }

      this.openPopover();
    });
  }

  /** Programmatically opens the popover */
  openPopover() {
    const anchor = this.readyAnchor();
    if (this.overlayRef || !anchor) {
      return;
    }
    this.openAnchor = anchor;

    // Create the spotlight border overlay first so the popover overlay sits above it in DOM order
    if (this.spotlight()) {
      this.spotlightService.register(this);
      this.spotlightService.showSpotlight(anchor);
    }

    this.popoverOpen.set(true);
    this.overlayRef = this.overlay.create(this.defaultPopoverConfig);

    const templatePortal = new TemplatePortal(this.popover().templateRef(), this.viewContainerRef);

    this.overlayRef.attach(templatePortal);
    this.closedEventsSub = this.getClosedEvents().subscribe((event) => {
      // Closing the popover is handled in this.destroyPopover, so we want to prevent the escape
      // key from doing its normal default action, which would otherwise cause a parent component
      // (like a dialog) or extension window to close
      if (event instanceof KeyboardEvent && event.key === "Escape" && !hasModifierKey(event)) {
        event.preventDefault();
      }
      this.destroyPopover();
    });
  }

  /** Read on each call, since a `PopoverElementProvider` may rebind its element after init. */
  private hostElement(): HTMLElement | undefined {
    // An `<ng-container>` host is a comment node, which can't be anchored to
    const host = this.hostElementRef.nativeElement;
    return host instanceof HTMLElement ? host : undefined;
  }

  /** Undefined while an explicit `anchor` is missing or still animating. */
  private readyAnchor(): HTMLElement | undefined {
    return this.anchor() === UNBOUND ? this.hostElement() : this.settledAnchor();
  }

  private getClosedEvents(): Observable<any> {
    if (!this.overlayRef) {
      throw new Error("Overlay reference is not available");
    }

    const detachments = this.overlayRef.detachments();
    const escKey = this.overlayRef
      .keydownEvents()
      .pipe(filter((event: KeyboardEvent) => event.key === "Escape" && !this.spotlight()));
    const backdrop = this.overlayRef
      .backdropClick()
      .pipe(filter(() => !this.spotlight() && this.closeOnBackdropClick()));
    const popoverClosed = outputToObservable(this.popover().closed);

    return detachments.pipe(mergeWith(escKey, backdrop, popoverClosed));
  }

  private destroyPopover() {
    if (!this.popoverOpen()) {
      return;
    }

    this.popoverOpen.set(false);
    this.disposeAll();
  }

  private disposeAll() {
    this.closedEventsSub?.unsubscribe();
    this.closedEventsSub = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.openAnchor = null;

    if (this.spotlight()) {
      this.spotlightService.unregister(this);
      this.spotlightService.hideSpotlight();
    }
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.disposeAll();
  }

  /** Programmatically closes the popover */
  closePopover() {
    this.destroyPopover();
  }
}
