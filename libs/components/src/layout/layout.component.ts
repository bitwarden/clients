import { A11yModule, CdkTrapFocus } from "@angular/cdk/a11y";
import { PortalModule } from "@angular/cdk/portal";
import { CommonModule } from "@angular/common";
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";

import { DrawerService } from "../dialog/drawer.service";
import { LinkComponent, LinkModule } from "../link";
import { SideNavService } from "../navigation/side-nav.service";
import { getRootFontSizePx, SharedModule } from "../shared";

import { ScrollLayoutHostDirective } from "./scroll-layout.directive";

/** Matches tw-min-w-96 on <main>. */
const MAIN_MIN_WIDTH_REM = 24;

/** Approximate rendered width of the closed nav (siderail / icon strip).
 *  Derived from tw-w-[3.75rem] + tw-mx-0.5 margins in side-nav.component.html. */
const SIDERAIL_WIDTH_REM = 4;

/** Minimum drawer push-mode width in rem, matching drawerSizeToWidthRem.small in
 *  dialog.component.  The drawer shrinks from its declared max down to this before
 *  switching to overlay mode. */
const DRAWER_MIN_PUSH_WIDTH_REM = 24;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-layout",
  templateUrl: "layout.component.html",
  imports: [
    CommonModule,
    SharedModule,
    LinkModule,
    RouterModule,
    PortalModule,
    A11yModule,
    CdkTrapFocus,
    ScrollLayoutHostDirective,
  ],
  host: {
    "(document:keydown.tab)": "handleKeydown($event)",
    class: "tw-block tw-h-screen",
  },
})
export class LayoutComponent {
  protected sideNavService = inject(SideNavService);
  private readonly drawerService = inject(DrawerService);
  protected drawerPortal = this.drawerService.portal;

  /**
   * True as soon as a portal is active; false when no drawer is open.
   * Derived directly from the portal signal so col 3 gets a non-zero track
   * immediately on open — without waiting for the ResizeObserver to fire.
   * This breaks the chicken-and-egg: col 3 = 0px → no resize event → drawer
   * never appears.
   */
  private readonly drawerIsActive = computed(() => this.drawerPortal() != null);

  private readonly destroyRef = inject(DestroyRef);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>("container");
  private readonly mainContent = viewChild.required<ElementRef<HTMLElement>>("main");
  private readonly drawerContainer = viewChild.required<ElementRef<HTMLElement>>("drawerContainer");

  /**
   * Current nav width as a signal, sourced from the resizable width observable.
   * Used to set the nav grid column track width.
   */
  private readonly navWidthRem = toSignal(this.sideNavService.width$, {
    initialValue: this.sideNavService.DEFAULT_OPEN_WIDTH,
  });

  /**
   * Container width in px, updated by the ResizeObserver on every layout change.
   * Exposed as a signal so gridTemplateColumns can reactively compute push vs
   * overlay for the drawer without waiting for a ResizeObserver tick.
   */
  private readonly containerWidthPx = signal(0);

  /**
   * Whether there is enough horizontal space to show the side nav in push mode.
   * Set by the ResizeObserver. When false the nav switches to overlay.
   */
  private readonly navIsPushMode = signal(false);

  /**
   * Whether the siderail (closed-nav icon strip) fits in its own column.
   * Has a lower threshold than full-nav isPushMode because the siderail is
   * much narrower — it should remain visible on intermediate viewport widths.
   */
  protected readonly siderailIsPushMode = signal(false);

  /**
   * Minimum drawer push width in px (= small drawer size × root font size).
   * Set by the ResizeObserver so it scales with the user's font preference.
   */
  private readonly drawerMinPushWidthPx = signal(0);

  /**
   * Siderail width in px (= SIDERAIL_WIDTH_REM × root font size).
   * Set by the ResizeObserver so it scales with the user's font preference.
   */
  private readonly siderailWidthPx = signal(SIDERAIL_WIDTH_REM * getRootFontSizePx());

  /**
   * Main content minimum width in px (= MAIN_MIN_WIDTH_REM × root font size).
   * Set by the ResizeObserver so it scales with the user's font preference.
   */
  private readonly mainMinWidthPx = signal(MAIN_MIN_WIDTH_REM * getRootFontSizePx());

  /**
   * The CSS grid-template-columns value for the three-panel layout.
   *
   * Column 1 (nav):    navWidthRem when nav is push+open
   *                    auto         when nav is push+closed (icon strip) OR
   *                                 when only the siderail fits; a dummy placeholder
   *                                 div keeps col 1 stable when the nav is fixed (overlay)
   *                    0px          when even the siderail doesn't fit
   * Column 2 (main):   minmax(mainMinWidthPx, 1fr) normally — the minmax base reserves
   *                    space for main so CSS grid can shrink col 3 without JS arithmetic;
   *                    0px when drawer is in overlay mode (drawer takes the full row)
   * Column 3 (drawer): auto when push (CSS shrinks naturally from declared max down to
   *                    drawerMinPushWidthPx before JS switches to overlay);
   *                    1fr when overlay (takes over main's space); 0px when no drawer
   */
  protected readonly gridTemplateColumns = computed(() => {
    const navOpen = this.sideNavService.open();
    const navPush = this.navIsPushMode();
    const siderailPush = this.siderailIsPushMode();

    // --- Drawer push/shrink/overlay ---
    const drawerActive = this.drawerIsActive();
    const declaredDrawerWidth = this.drawerService.pushWidthPx();
    const containerWidth = this.containerWidthPx();

    // Push vs overlay: switch to overlay only when the minimum push width won't fit.
    // The shrink zone between the declared max-width and the minimum is handled
    // entirely by CSS grid: col2 uses minmax(mainMinWidthPx, 1fr) so its base
    // size reserves space for main before col3 auto grows.  When the container
    // shrinks, col3 naturally receives less free space and narrows without any JS
    // pixel arithmetic.
    //
    // dialog.component declares its push width via an effect() that runs during
    // Angular's CD — before the ResizeObserver fires and before the browser paints.
    // Falls back to the ResizeObserver-driven signal when not yet declared.
    let drawerPush: boolean;
    if (!drawerActive) {
      drawerPush = false;
    } else if (declaredDrawerWidth > 0 && containerWidth > 0) {
      drawerPush =
        containerWidth - this.siderailWidthPx() - this.drawerMinPushWidthPx() >=
        this.mainMinWidthPx();
    } else {
      drawerPush = this.drawerService.isPushMode();
    }

    // --- Col 1 (nav / siderail) ---
    // When the nav enters overlay mode (position:fixed) it leaves the grid's normal
    // flow.  A dummy placeholder div in the template keeps the col 1 auto track
    // stable without needing an explicit px value here.
    const col1 =
      navOpen && navPush
        ? `${this.navWidthRem()}rem` // full nav, push+open
        : navPush || siderailPush
          ? "auto" // siderail in flow, size naturally
          : "0px"; // viewport too narrow even for siderail

    // col3: minmax(0px, declaredMax) instead of "auto" so the track is sized by its
    // explicit bounds rather than by the item's content-based size.  This lets CSS
    // grid shrink the drawer column down to 0 when the available space is limited,
    // while col2's minmax base reserves mainMinWidthPx for main first.
    // The dialog uses tw-w-full so it fills the column without overflowing it.
    const col3 = !drawerActive
      ? "0px"
      : !drawerPush
        ? "1fr"
        : declaredDrawerWidth > 0
          ? `minmax(0px, ${declaredDrawerWidth}px)`
          : "auto"; // fallback before dialog's effect declares its width
    const col2 = !drawerActive || drawerPush ? `minmax(${this.mainMinWidthPx()}px, 1fr)` : "0px";

    return `${col1} ${col2} ${col3}`;
  });

  constructor() {
    // Keep the service's isOverlay signal in sync so SideNavComponent can read it.
    effect(() => {
      this.sideNavService.isOverlay.set(this.sideNavService.open() && !this.navIsPushMode());
    });

    afterNextRender(() => {
      const container = this.container().nativeElement;
      const drawerContainer = this.drawerContainer().nativeElement;

      const update = () => {
        const rootFontSizePx = getRootFontSizePx();
        const containerWidth = container.clientWidth;
        const siderailPx = SIDERAIL_WIDTH_REM * rootFontSizePx;
        const mainMinPx = MAIN_MIN_WIDTH_REM * rootFontSizePx;
        this.containerWidthPx.set(containerWidth);
        this.drawerMinPushWidthPx.set(DRAWER_MIN_PUSH_WIDTH_REM * rootFontSizePx);
        this.siderailWidthPx.set(siderailPx);
        this.mainMinWidthPx.set(mainMinPx);
        const navWidthPx = this.navWidthRem() * rootFontSizePx;
        const drawerMinPx = DRAWER_MIN_PUSH_WIDTH_REM * rootFontSizePx;

        // Use the push width declared by the drawer content (e.g. bit-dialog) via
        // DrawerService.declarePushWidth(). This is more reliable than DOM measurement
        // because the drawerContainer's firstElementChild is the outer portal host
        // component (e.g. app-vault-item), which fills the full 1fr column in overlay
        // mode — making its offsetWidth useless for push-vs-overlay decisions.
        const drawerWidthPx = this.drawerService.pushWidthPx();

        // Can the full nav push alongside main (ignoring the drawer)?
        const navAloneCanPush = containerWidth - navWidthPx >= mainMinPx;

        // Can the drawer push at full width with the full nav?
        const drawerFullWidthNavCanPush =
          drawerWidthPx > 0 && containerWidth - navWidthPx - drawerWidthPx >= mainMinPx;

        // Can the drawer push at full width with just the siderail?
        const drawerFullWidthSiderailCanPush =
          drawerWidthPx > 0 && containerWidth - siderailPx - drawerWidthPx >= mainMinPx;

        // Can the drawer push at minimum width with the full nav (shrink zone)?
        const drawerMinWithNavCanPush =
          drawerWidthPx > 0 && containerWidth - navWidthPx - drawerMinPx >= mainMinPx;

        // Can the drawer push at minimum width with just the siderail (shrink zone)?
        const drawerMinWithSiderailCanPush =
          drawerWidthPx > 0 && containerWidth - siderailPx - drawerMinPx >= mainMinPx;

        // When the drawer is open and space is limited, the full nav yields first —
        // it closes to its siderail so the drawer can remain in push mode.  When even
        // the minimum push width doesn't fit, the drawer goes overlay.
        let navPush: boolean;
        let drawerPush: boolean;

        if (drawerFullWidthNavCanPush) {
          // Plenty of room: full nav and drawer both push at full width.
          navPush = true;
          drawerPush = true;
        } else if (drawerFullWidthSiderailCanPush) {
          // Full-width drawer fits with just the siderail: collapse the full nav.
          navPush = false;
          drawerPush = true;
        } else if (drawerMinWithNavCanPush) {
          // Shrink push with full nav: drawer narrows to fit alongside full nav + main.
          navPush = true;
          drawerPush = true;
        } else if (drawerMinWithSiderailCanPush) {
          // Shrink push with siderail: drawer narrows; nav collapses to siderail.
          navPush = false;
          drawerPush = true;
        } else {
          // Drawer can't push even at minimum width.
          // If the drawer is active (overlay), force nav to overlay too so it
          // doesn't squeeze the drawer's 1fr column.  Without a drawer, fall
          // back to nav-first priority.
          navPush = drawerWidthPx > 0 ? false : navAloneCanPush;
          drawerPush = false;
        }

        // In shrink-push mode the drawer occupies less than its declared max, so use
        // the actual available space as the effective drawer width for the siderail check.
        const drawerEffectivePx = drawerPush
          ? Math.min(drawerWidthPx, Math.max(0, containerWidth - siderailPx - mainMinPx))
          : 0;
        const siderailCanPush = drawerPush
          ? containerWidth - siderailPx - drawerEffectivePx >= mainMinPx
          : containerWidth - siderailPx >= mainMinPx;

        // Only close the nav when it is transitioning out of push mode.  If
        // the nav is already in overlay (isPushMode was already false), let it
        // remain open — it is intentionally overlaying the main content.
        if (!navPush && this.sideNavService.open() && this.navIsPushMode()) {
          this.sideNavService.open.set(false);
        }
        this.navIsPushMode.set(navPush);
        this.siderailIsPushMode.set(siderailCanPush);
        this.drawerService.isPushMode.set(drawerPush);
      };

      const resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(container);
      resizeObserver.observe(drawerContainer);
      this.destroyRef.onDestroy(() => resizeObserver.disconnect());
    });
  }

  /**
   * Rounded top left corner for the main content area
   */
  readonly rounded = input(false, { transform: booleanAttribute });

  protected focusMainContent() {
    this.mainContent().nativeElement.focus();
  }

  /**
   * Angular CDK's focus trap utility is silly and will not respect focus order.
   * This is a workaround to explicitly focus the skip link when tab is first pressed, if no other item already has focus.
   *
   * @see https://github.com/angular/components/issues/10247#issuecomment-384060265
   **/
  private readonly skipLink = viewChild.required<LinkComponent>("skipLink");
  handleKeydown(ev: KeyboardEvent) {
    if (isNothingFocused()) {
      ev.preventDefault();
      this.skipLink().el.nativeElement.focus();
    }
  }
}

const isNothingFocused = (): boolean => {
  return [document.documentElement, document.body, null].includes(
    document.activeElement as HTMLElement,
  );
};
