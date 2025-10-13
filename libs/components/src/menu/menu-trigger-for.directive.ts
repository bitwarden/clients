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
  input,
} from "@angular/core";
import { merge, Subscription } from "rxjs";
import { filter, skip, takeUntil } from "rxjs/operators";

import { MenuComponent } from "./menu.component";

/**
 * Position strategies for context menus.
 * Tries positions in order: below-right, above-right, below-left, above-left
 */
const CONTEXT_MENU_POSITIONS: ConnectedPosition[] = [
  // below-right
  {
    originX: "start",
    originY: "top",
    overlayX: "start",
    overlayY: "top",
  },
  // above-right
  {
    originX: "start",
    originY: "bottom",
    overlayX: "start",
    overlayY: "bottom",
  },
  // below-left
  {
    originX: "end",
    originY: "top",
    overlayX: "end",
    overlayY: "top",
  },
  // above-left
  {
    originX: "end",
    originY: "bottom",
    overlayX: "end",
    overlayY: "bottom",
  },
];

@Directive({
  selector: "[bitMenuTriggerFor]",
  exportAs: "menuTrigger",
  standalone: true,
  host: { "[attr.role]": "this.role()" },
})
export class MenuTriggerForDirective implements OnDestroy {
  @HostBinding("attr.aria-expanded") isOpen = false;
  @HostBinding("attr.aria-haspopup") get hasPopup(): "menu" | "dialog" {
    return this.menu()?.ariaRole() || "menu";
  }

  readonly role = input("button");

  readonly menu = input.required<MenuComponent>({ alias: "bitMenuTriggerFor" });

  private overlayRef: OverlayRef | null = null;
  private defaultMenuConfig: OverlayConfig = {
    panelClass: "bit-menu-panel",
    hasBackdrop: true,
    backdropClass: ["cdk-overlay-transparent-backdrop", "bit-menu-panel-backdrop"],
    scrollStrategy: this.overlay.scrollStrategies.reposition(),
    positionStrategy: this.overlay
      .position()
      .flexibleConnectedTo(this.elementRef)
      .withPositions([
        { originX: "start", originY: "bottom", overlayX: "start", overlayY: "top" },
        { originX: "end", originY: "bottom", overlayX: "end", overlayY: "top" },
        { originX: "start", originY: "top", overlayX: "start", overlayY: "bottom" },
        { originX: "end", originY: "top", overlayX: "end", overlayY: "bottom" },
      ])
      .withLockedPosition(true)
      .withFlexibleDimensions(false)
      .withPush(true),
  };
  private closedEventsSub: Subscription | null = null;
  private keyDownEventsSub: Subscription | null = null;
  private menuCloseListenerSub: Subscription | null = null;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private viewContainerRef: ViewContainerRef,
    private overlay: Overlay,
  ) {}

  @HostListener("click") toggleMenu() {
    this.isOpen ? this.destroyMenu() : this.openMenu();
  }

  /**
   * Toggles the menu on right click event.
   * If the menu is already open, it updates the menu position.
   * @param event The MouseEvent from the right-click interaction
   */
  toggleMenuOnRightClick(event: MouseEvent) {
    event.preventDefault(); // Prevent default context menu
    this.isOpen ? this.updateMenuPosition(event) : this.openMenu(event);
  }

  ngOnDestroy() {
    this.disposeAll();
  }

  private openMenu(event?: MouseEvent) {
    const menu = this.menu();
    if (menu == null) {
      throw new Error("Cannot find bit-menu element");
    }

    this.isOpen = true;

    const positionStrategy = event
      ? this.overlay
          .position()
          .flexibleConnectedTo({ x: event.clientX, y: event.clientY })
          .withPositions(CONTEXT_MENU_POSITIONS)
          .withLockedPosition(false)
          .withFlexibleDimensions(false)
          .withPush(true)
      : this.defaultMenuConfig.positionStrategy;

    const config = { ...this.defaultMenuConfig, positionStrategy, hasBackdrop: !event };

    this.overlayRef = this.overlay.create(config);

    const templatePortal = new TemplatePortal(menu.templateRef(), this.viewContainerRef);
    this.overlayRef.attach(templatePortal);

    const isContextMenu = !!event;
    this.setupClosingActions(isContextMenu);
    this.setupMenuCloseListener();

    if (menu.keyManager) {
      menu.keyManager.setFirstItemActive();
      this.keyDownEventsSub = this.overlayRef
        .keydownEvents()
        .subscribe((event: KeyboardEvent) => this.menu().keyManager?.onKeydown(event));
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
      .withPositions([
        {
          originX: "start",
          originY: "top",
          overlayX: "start",
          overlayY: "top",
        },
      ]);

    this.overlayRef.updatePositionStrategy(positionStrategy);
  }

  private destroyMenu() {
    if (this.overlayRef == null || !this.isOpen) {
      return;
    }

    this.isOpen = false;
    this.disposeAll();
    this.menu().closed.emit();
  }

  private setupClosingActions(isContextMenu: boolean) {
    if (!this.overlayRef) {
      return;
    }

    const escKey = this.overlayRef.keydownEvents().pipe(
      filter((event: KeyboardEvent) => {
        const keys = this.menu().ariaRole() === "menu" ? ["Escape", "Tab"] : ["Escape"];
        return keys.includes(event.key);
      }),
    );
    const menuClosed = this.menu().closed;
    const detachments = this.overlayRef.detachments();

    const closeEvents = isContextMenu
      ? merge(detachments, escKey, menuClosed)
      : merge(detachments, escKey, this.overlayRef.backdropClick(), menuClosed);

    this.closedEventsSub = closeEvents
      .pipe(takeUntil(this.overlayRef.detachments()))
      .subscribe((event) => {
        // Closing the menu is handled in this.destroyMenu, so we want to prevent the escape key
        // from doing its normal default action, which would otherwise cause a parent component
        // (like a dialog) or extension window to close
        if (event instanceof KeyboardEvent && event.key === "Escape" && !hasModifierKey(event)) {
          event.preventDefault();
        }

        if (event instanceof KeyboardEvent && (event.key === "Tab" || event.key === "Escape")) {
          this.elementRef.nativeElement.focus();
        }
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

  private disposeAll() {
    this.closedEventsSub?.unsubscribe();
    this.keyDownEventsSub?.unsubscribe();
    this.menuCloseListenerSub?.unsubscribe();
    this.overlayRef?.dispose();
  }
}
