import { hasModifierKey } from "@angular/cdk/keycodes";
import {
  ConnectedPosition,
  FlexibleConnectedPositionStrategy,
  Overlay,
  OverlayConfig,
  OverlayRef,
} from "@angular/cdk/overlay";
import { TemplatePortal } from "@angular/cdk/portal";
import {
  DOCUMENT,
  Directive,
  ElementRef,
  OnDestroy,
  Signal,
  ViewContainerRef,
  inject,
  input,
  signal,
} from "@angular/core";
import { outputToObservable } from "@angular/core/rxjs-interop";
import { fromEvent, merge, Subscription } from "rxjs";
import { filter, skipUntil, takeUntil } from "rxjs/operators";

import { TooltipDirective } from "../tooltip/tooltip.directive";

import { MenuPositionIdentifier, defaultPositions } from "./default-positions";
import { MenuComponent } from "./menu.component";

/**
 * Shared overlay plumbing for the menu triggers. Concrete directives choose what opens the menu
 * and where it anchors; attaching, keyboard navigation, closing, and teardown live here.
 */
@Directive()
export abstract class MenuTriggerBaseDirective implements OnDestroy {
  /** Declared as an input by each concrete directive so it can carry that directive's own alias. */
  abstract readonly menu: Signal<MenuComponent>;

  /** Preferred opening position. CDK falls back through the remaining positions if the preferred one doesn't fit. */
  readonly menuPosition = input<MenuPositionIdentifier>();

  private readonly _isOpen = signal(false);

  /**
   * Whether the menu is currently open. A signal because the menu can close from events outside
   * the trigger's view (backdrop click, escape), which would otherwise leave an `OnPush` host
   * styling off this state unaware that it changed.
   */
  readonly isOpen = this._isOpen.asReadonly();

  protected readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly document = inject(DOCUMENT);

  /** Suppressed while the menu is open so a `bitTooltip` on the same host can't pop over it. */
  private readonly hostTooltip = inject(TooltipDirective, { self: true, optional: true });

  private overlayRef: OverlayRef | null = null;

  private closedEventsSub: Subscription | null = null;
  private keyDownEventsSub: Subscription | null = null;
  private menuCloseListenerSub: Subscription | null = null;

  protected get positions(): ConnectedPosition[] {
    const preferred = this.menuPosition();
    if (!preferred) {
      return defaultPositions;
    }
    const match = defaultPositions.find((p) => p.id === preferred);
    return match ? [match, ...defaultPositions.filter((p) => p !== match)] : defaultPositions;
  }

  private get baseMenuConfig(): OverlayConfig {
    return {
      panelClass: "bit-menu-panel",
      backdropClass: ["cdk-overlay-transparent-backdrop", "bit-menu-panel-backdrop"],
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
    };
  }

  ngOnDestroy() {
    this.disposeAll();
  }

  protected elementPositionStrategy(): FlexibleConnectedPositionStrategy {
    return this.overlay
      .position()
      .flexibleConnectedTo(this.elementRef)
      .withPositions(this.positions)
      .withLockedPosition(true)
      .withFlexibleDimensions(false)
      .withPush(true);
  }

  /**
   * For a zero-size point anchor, originX/originY collapse onto the coordinate — only
   * overlayX/overlayY drive placement, so the element positions work here unchanged.
   */
  private pointPositionStrategy(x: number, y: number): FlexibleConnectedPositionStrategy {
    return this.overlay
      .position()
      .flexibleConnectedTo({ x, y })
      .withPositions(this.positions)
      .withLockedPosition(false)
      .withFlexibleDimensions(false)
      .withPush(true);
  }

  /**
   * Whether the open menu is anchored to a cursor position rather than to the trigger element.
   * Going without a backdrop is what distinguishes the two.
   */
  protected get cursorAnchored(): boolean {
    return this.overlayRef?.getConfig().hasBackdrop === false;
  }

  /** Opens the menu at the cursor, or moves an already-open menu to it. */
  protected toggleAtCursor(event: MouseEvent) {
    const positionStrategy = this.pointPositionStrategy(event.clientX, event.clientY);

    if (this.isOpen()) {
      this.overlayRef?.updatePositionStrategy(positionStrategy);
      return;
    }

    this.attachMenu({ positionStrategy, hasBackdrop: false });
  }

  // `hasBackdrop` is required because `cursorAnchored` reads it back: an omitted value would
  // silently disagree with the no-backdrop branch below.
  protected attachMenu(config: Required<Pick<OverlayConfig, "positionStrategy" | "hasBackdrop">>) {
    const menu = this.menu();
    if (menu == null) {
      throw new Error("Cannot find bit-menu element");
    }

    this._isOpen.set(true);
    this.hostTooltip?.suppressed.set(true);

    this.overlayRef = this.overlay.create({ ...this.baseMenuConfig, ...config });
    this.overlayRef.attach(new TemplatePortal(menu.templateRef(), this.viewContainerRef));

    this.setupClosingActions();

    // Going without a backdrop is what lets the click after a cursor-anchored menu reach whatever
    // sits underneath it, so dismissal has to run off outside pointer events instead.
    if (!config.hasBackdrop) {
      this.setupMenuCloseListener();
    }

    const menuKeyManager = menu.keyManager();
    if (menuKeyManager) {
      menuKeyManager.setFirstItemActive();
      this.keyDownEventsSub = this.overlayRef
        .keydownEvents()
        .subscribe((event: KeyboardEvent) => menuKeyManager.onKeydown(event));
    }
  }

  protected destroyMenu() {
    if (this.overlayRef == null || !this.isOpen()) {
      return;
    }

    this._isOpen.set(false);
    this.hostTooltip?.suppressed.set(false);
    this.disposeAll();
    this.menu().closed.emit();
  }

  private setupClosingActions() {
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

    const closeEvents = this.overlayRef.getConfig().hasBackdrop
      ? merge(detachments, keyEvents, this.overlayRef.backdropClick(), menuClosed)
      : merge(detachments, keyEvents, menuClosed);

    this.closedEventsSub = closeEvents
      .pipe(takeUntil(this.overlayRef.detachments()))
      .subscribe((event) => {
        // destroyMenu already closes the menu; without this, escape would also close a parent
        // dialog or the extension window.
        if (event instanceof KeyboardEvent && event.key === "Escape" && !hasModifierKey(event)) {
          event.preventDefault();
        }

        // Move focus to the menu trigger, since any active menu items are about to be destroyed
        this.restoreFocus();

        this.destroyMenu();
      });
  }

  /**
   * Arming on the next pointerdown keeps the opening gesture from closing the menu. Counting
   * emissions can't: CDK registers its outside-click listeners on first attach, so how many of
   * that gesture's events they catch varies by platform and by whether an overlay was already up.
   */
  private setupMenuCloseListener() {
    if (!this.overlayRef) {
      return;
    }

    const nextGesture = fromEvent(this.document, "pointerdown", { capture: true });
    const host = this.elementRef.nativeElement;

    this.menuCloseListenerSub = this.overlayRef
      .outsidePointerEvents()
      .pipe(
        skipUntil(nextGesture),
        // CDK's dispatcher emits for contextmenu too, from a body capture listener that beats the
        // host's own. Dismissing there would tear down and re-emit `closed` on every reposition.
        filter((event) => !(event.type === "contextmenu" && host.contains(event.target as Node))),
        takeUntil(this.overlayRef.detachments()),
      )
      .subscribe((_) => {
        this.destroyMenu();
      });
  }

  /**
   * Focusing a non-focusable host would strand focus on the body instead. Any `tabindex` counts —
   * context menu hosts often use `-1` to be focusable without joining the tab order.
   */
  private restoreFocus() {
    const element = this.elementRef.nativeElement;
    if (element.tabIndex >= 0 || element.hasAttribute("tabindex")) {
      element.focus();
    }
  }

  private disposeAll() {
    this.closedEventsSub?.unsubscribe();
    this.keyDownEventsSub?.unsubscribe();
    this.menuCloseListenerSub?.unsubscribe();
    this.overlayRef?.dispose();
  }
}
