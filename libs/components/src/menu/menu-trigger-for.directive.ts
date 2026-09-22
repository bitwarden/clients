import { hasModifierKey } from "@angular/cdk/keycodes";
import { ConnectedPosition, Overlay, OverlayConfig, OverlayRef } from "@angular/cdk/overlay";
import { TemplatePortal } from "@angular/cdk/portal";
import {
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  OnDestroy,
  ViewContainerRef,
  inject,
  input,
  signal,
} from "@angular/core";
import { outputToObservable } from "@angular/core/rxjs-interop";
import { fromEvent, merge, Subscription } from "rxjs";
import { filter, skip, takeUntil } from "rxjs/operators";

import { TooltipDirective } from "../tooltip/tooltip.directive";

import { MenuPositionIdentifier, defaultPositions } from "./default-positions";
import { MenuComponent } from "./menu.component";

@Directive({
  selector: "[bitMenuTriggerFor]",
  exportAs: "menuTrigger",
  host: {
    "[attr.role]": "this.role()",
    "[attr.aria-expanded]": "isOpen()",
  },
})
export class MenuTriggerForDirective implements OnDestroy {
  private readonly _isOpen = signal(false);

  /**
   * Whether the menu is currently open.
   *
   * A signal so that consumers styling the trigger off its open state stay in sync: the menu
   * can close from events outside the trigger's view (backdrop click, escape), which would
   * otherwise leave an `OnPush` host unaware that the state changed.
   */
  readonly isOpen = this._isOpen.asReadonly();

  @HostBinding("attr.aria-haspopup") get hasPopup(): "menu" | "dialog" {
    return this.menu()?.ariaRole() || "menu";
  }

  readonly role = input("button");

  readonly menu = input.required<MenuComponent>({ alias: "bitMenuTriggerFor" });

  /** Preferred opening position. CDK falls back through the remaining positions if the preferred one doesn't fit. */
  readonly menuPosition = input<MenuPositionIdentifier>();

  private overlayRef: OverlayRef | null = null;

  /**
   * Host tooltip (if any) on the same element. Suppressed while the menu is open so
   * a `bitTooltip` can't pop over the active menu.
   */
  private readonly hostTooltip = inject(TooltipDirective, { self: true, optional: true });

  private get positions(): ConnectedPosition[] {
    const preferred = this.menuPosition();
    if (!preferred) {
      return defaultPositions;
    }
    const match = defaultPositions.find((p) => p.id === preferred);
    return match ? [match, ...defaultPositions.filter((p) => p !== match)] : defaultPositions;
  }

  private get defaultMenuConfig(): OverlayConfig {
    return {
      panelClass: "bit-menu-panel",
      hasBackdrop: true,
      backdropClass: ["cdk-overlay-transparent-backdrop", "bit-menu-panel-backdrop"],
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(this.elementRef)
        .withPositions(this.positions)
        .withLockedPosition(true)
        .withFlexibleDimensions(false)
        .withPush(true),
    };
  }
  private closedEventsSub: Subscription | null = null;
  private keyDownEventsSub: Subscription | null = null;
  private menuCloseListenerSub: Subscription | null = null;
  private scrollBlockListenerSub: Subscription | null = null;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private viewContainerRef: ViewContainerRef,
    private overlay: Overlay,
  ) {}

  @HostListener("click") toggleMenu() {
    this.isOpen() ? this.destroyMenu() : this.openMenu();
  }

  /**
   * Toggles the menu on right click event.
   * If the menu is already open, it updates the menu position.
   * @param event The MouseEvent from the right-click interaction
   */
  toggleMenuOnRightClick(event: MouseEvent) {
    event.preventDefault(); // Prevent default context menu
    this.isOpen() ? this.updateMenuPosition(event) : this.openMenu(event);
  }

  ngOnDestroy() {
    this.disposeAll();
  }

  private openMenu(event?: MouseEvent) {
    const menu = this.menu();
    if (menu == null) {
      throw new Error("Cannot find bit-menu element");
    }

    this._isOpen.set(true);
    this.hostTooltip?.suppressed.set(true);

    const baseConfig = this.defaultMenuConfig;
    // For a zero-size point anchor (right-click), originX/originY collapse onto the
    // click coordinate — only overlayX/overlayY drive placement, so the same positions
    // we use for element anchors work here too.
    const positionStrategy = event
      ? this.overlay
          .position()
          .flexibleConnectedTo({ x: event.clientX, y: event.clientY })
          .withPositions(this.positions)
          .withLockedPosition(false)
          .withFlexibleDimensions(false)
          .withPush(true)
      : baseConfig.positionStrategy;

    const config = { ...baseConfig, positionStrategy, hasBackdrop: !event };

    this.overlayRef = this.overlay.create(config);

    const templatePortal = new TemplatePortal(menu.templateRef(), this.viewContainerRef);
    this.overlayRef.attach(templatePortal);

    // Context menus are opened with a MouseEvent
    const isContextMenu = !!event;
    this.setupClosingActions(isContextMenu);
    this.setupMenuCloseListener();
    if (isContextMenu) {
      this.setupScrollBlockListener();
    }

    const menuKeyManager = menu.keyManager();
    if (menuKeyManager) {
      menuKeyManager.setFirstItemActive();
      this.keyDownEventsSub = this.overlayRef
        .keydownEvents()
        .subscribe((event: KeyboardEvent) => menuKeyManager.onKeydown(event));
    }
  }

  /**
   * Updates the position of the menu overlay based on the mouse event coordinates.
   * This is typically called when the menu is already open and the user right-clicks again,
   * allowing the menu to reposition itself to the new cursor location.
   * @param event The MouseEvent containing the new clientX and clientY coordinates
   */
  private updateMenuPosition(event: MouseEvent) {
    if (this.overlayRef == null) {
      return;
    }

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo({ x: event.clientX, y: event.clientY })
      .withPositions(this.positions);

    this.overlayRef.updatePositionStrategy(positionStrategy);
  }

  private destroyMenu() {
    if (this.overlayRef == null || !this.isOpen()) {
      return;
    }

    this._isOpen.set(false);
    this.hostTooltip?.suppressed.set(false);
    this.disposeAll();
    this.menu().closed.emit();
  }

  private setupClosingActions(isContextMenu: boolean) {
    if (!this.overlayRef) {
      return;
    }

    const keyEvents = this.overlayRef.keydownEvents().pipe(
      filter((event: KeyboardEvent) => {
        const keys = this.menu().ariaRole() === "menu" ? ["Escape", "Tab"] : ["Escape"];
        return keys.includes(event.key);
      }),
    );
    const menuClosed = outputToObservable(this.menu().closed);
    const detachments = this.overlayRef.detachments();

    const closeEvents = isContextMenu
      ? merge(detachments, keyEvents, menuClosed)
      : merge(detachments, keyEvents, this.overlayRef.backdropClick(), menuClosed);

    this.closedEventsSub = closeEvents
      .pipe(takeUntil(this.overlayRef.detachments()))
      .subscribe((event) => {
        // Closing the menu is handled in this.destroyMenu, so we want to prevent the escape key
        // from doing its normal default action, which would otherwise cause a parent component
        // (like a dialog) or extension window to close
        if (event instanceof KeyboardEvent && event.key === "Escape" && !hasModifierKey(event)) {
          event.preventDefault();
        }

        // Move focus to the menu trigger, since any active menu items are about to be destroyed
        this.elementRef.nativeElement.focus();

        this.destroyMenu();
      });
  }

  /**
   * Sets up a listener for clicks outside the menu overlay.
   * We skip(1) because the initial right-click event that opens the menu is also
   * considered an outside click event, which would immediately close the menu
   */
  private setupMenuCloseListener() {
    if (!this.overlayRef) {
      return;
    }

    this.menuCloseListenerSub = this.overlayRef
      .outsidePointerEvents()
      .pipe(skip(1), takeUntil(this.overlayRef.detachments()))
      .subscribe((_) => {
        this.destroyMenu();
      });
  }

  /**
   * Blocks scrolling outside a context menu: it's anchored to a viewport point, so it would
   * otherwise float over other content. Scroll inputs are cancelled since inner containers can scroll.
   */
  private setupScrollBlockListener() {
    if (!this.overlayRef) {
      return;
    }

    const overlayElement = this.overlayRef.overlayElement;
    const options = { capture: true, passive: false };
    this.scrollBlockListenerSub = merge(
      fromEvent(document, "wheel", options),
      fromEvent(document, "touchmove", options),
    )
      .pipe(
        filter((event) => !(event.target instanceof Node && overlayElement.contains(event.target))),
        takeUntil(this.overlayRef.detachments()),
      )
      .subscribe((event) => event.preventDefault());
  }

  private disposeAll() {
    this.closedEventsSub?.unsubscribe();
    this.scrollBlockListenerSub?.unsubscribe();
    this.keyDownEventsSub?.unsubscribe();
    this.menuCloseListenerSub?.unsubscribe();
    this.overlayRef?.dispose();
  }
}
