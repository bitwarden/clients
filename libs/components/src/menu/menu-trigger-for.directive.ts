import { Overlay, OverlayConfig, OverlayRef } from "@angular/cdk/overlay";
import { TemplatePortal } from "@angular/cdk/portal";
import {
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  ViewContainerRef,
} from "@angular/core";
import { merge, Subscription } from "rxjs";
import { filter, takeUntil } from "rxjs/operators";

import { MenuComponent } from "./menu.component";

@Directive({
  selector: "[bitMenuTriggerFor]",
  exportAs: "menuTrigger",
})
export class MenuTriggerForDirective implements OnDestroy {
  @HostBinding("attr.aria-expanded") isOpen = false;
  @HostBinding("attr.aria-haspopup") get hasPopup(): "menu" | "dialog" {
    return this.menu?.ariaRole || "menu";
  }
  @HostBinding("attr.role")
  @Input()
  role = "button";

  @Input("bitMenuTriggerFor") menu: MenuComponent;

  private overlayRef: OverlayRef;
  private defaultMenuConfig: OverlayConfig = {
    panelClass: "bit-menu-panel",
    hasBackdrop: false,
    scrollStrategy: this.overlay.scrollStrategies.reposition(),
    positionStrategy: this.overlay
      .position()
      .flexibleConnectedTo(this.elementRef)
      .withPositions([
        {
          originX: "start",
          originY: "bottom",
          overlayX: "start",
          overlayY: "top",
        },
        {
          originX: "end",
          originY: "bottom",
          overlayX: "end",
          overlayY: "top",
        },
      ])
      .withLockedPosition(true)
      .withFlexibleDimensions(false)
      .withPush(true),
  };
  private closedEventsSub: Subscription;
  private keyDownEventsSub: Subscription;
  private globalListenersSub: Subscription;

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
    if (this.menu == null) {
      throw new Error("Cannot find bit-menu element");
    }

    this.isOpen = true;

    const positionStrategy = event
      ? this.overlay
          .position()
          .flexibleConnectedTo({ x: event.clientX, y: event.clientY })
          .withPositions([
            {
              originX: "start",
              originY: "top",
              overlayX: "start",
              overlayY: "top",
            },
          ])
      : this.defaultMenuConfig.positionStrategy;

    const config = { ...this.defaultMenuConfig, positionStrategy };

    this.overlayRef = this.overlay.create(config);

    const templatePortal = new TemplatePortal(this.menu.templateRef, this.viewContainerRef);
    this.overlayRef.attach(templatePortal);

    this.setupClosingActions();
    this.setupGlobalListeners();

    if (this.menu.keyManager) {
      this.menu.keyManager.setFirstItemActive();
      this.keyDownEventsSub = this.overlayRef
        .keydownEvents()
        .subscribe((event: KeyboardEvent) => this.menu.keyManager.onKeydown(event));
    }
  }

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
  }

  private setupClosingActions() {
    const escKey = this.overlayRef.keydownEvents().pipe(
      filter((event: KeyboardEvent) => {
        const keys = this.menu.ariaRole === "menu" ? ["Escape", "Tab"] : ["Escape"];
        return keys.includes(event.key);
      }),
    );

    const backdrop = this.overlayRef.backdropClick();
    const menuClosed = this.menu.closed;
    const detachments = this.overlayRef.detachments();

    this.closedEventsSub = merge(detachments, escKey, backdrop, menuClosed)
      .pipe(takeUntil(this.overlayRef.detachments()))
      .subscribe((event) => {
        if (event instanceof KeyboardEvent && (event.key === "Tab" || event.key === "Escape")) {
          this.elementRef.nativeElement.focus();
        }
        this.destroyMenu();
      });
  }

  private setupGlobalListeners() {
    this.overlayRef
      .outsidePointerEvents()
      .pipe(takeUntil(this.overlayRef.detachments()))
      .subscribe((event) => {
        this.destroyMenu();
      });
  }

  private disposeAll() {
    this.closedEventsSub?.unsubscribe();
    this.overlayRef?.dispose();
    this.keyDownEventsSub?.unsubscribe();
    this.globalListenersSub?.unsubscribe();
  }
}
