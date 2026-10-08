import {
  Directive,
  ElementRef,
  OnDestroy,
  ViewContainerRef,
  afterNextRender,
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
import { PopoverService } from "./popover.service";

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

  private readonly popoverElementProvider = inject<PopoverElementProvider>(PopoverElementProvider, {
    host: true,
    optional: true,
  });
  private readonly elementRef = this.popoverElementProvider
    ? this.popoverElementProvider.popoverAnchorElementRef
    : inject<ElementRef<HTMLElement>>(ElementRef);

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

    // Read at open time, since a `PopoverElementProvider` may rebind it after init
    const ref = this.popoverService.open(this.popover(), this.elementRef.nativeElement, {
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

  private disposeRef() {
    const ref = this.ref;
    this.ref = null;
    ref?.close();
  }
}
