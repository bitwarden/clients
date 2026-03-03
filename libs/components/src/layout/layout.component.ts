import { A11yModule, CdkTrapFocus } from "@angular/cdk/a11y";
import { PortalModule } from "@angular/cdk/portal";
import { CommonModule } from "@angular/common";
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { RouterModule } from "@angular/router";

import { drawerSizeToWidthRem } from "../dialog/dialog/dialog.component";
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

  /** Rendered only when nothing is projected into the side-nav slot (ng-content fallback). */
  private readonly sideNavSlotFallback = viewChild<ElementRef>("sideNavSlotFallback");
  protected readonly hasSideNav = computed(() => this.sideNavSlotFallback() == null);

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
   * Container width in px, updated by the ResizeObserver on every layout change.
   * Exposed as a signal so gridTemplateColumns can reactively compute push vs
   * overlay for the drawer without waiting for a ResizeObserver tick.
   */
  private readonly containerWidthPx = signal(0);

  /**
   * Whether the siderail (closed-nav icon strip) fits in its own column.
   * Has a lower threshold than full-nav isPushMode because the siderail is
   * much narrower — it should remain visible on intermediate viewport widths.
   */
  protected readonly siderailIsPushMode = signal(false);

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
    const navPush = this.sideNavService.isPushMode();
    const siderailPush = this.siderailIsPushMode();

    // --- Drawer push/shrink/overlay ---
    const drawerActive = this.drawerIsActive();
    const declaredDrawerWidth = this.drawerService.pushWidthPx();
    const containerWidth = this.containerWidthPx();
    const rootFontSizePx = getRootFontSizePx();
    const siderailWidthPx = SIDERAIL_WIDTH_REM * rootFontSizePx;
    const drawerMinWidthPx = drawerSizeToWidthRem.small * rootFontSizePx;
    const mainMinWidthPx = MAIN_MIN_WIDTH_REM * rootFontSizePx;

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
      drawerPush = containerWidth - siderailWidthPx - drawerMinWidthPx >= mainMinWidthPx;
    } else {
      drawerPush = this.drawerService.isPushMode();
    }

    // --- Col 1 (nav / siderail) ---
    // When the nav enters overlay mode (position:fixed) it leaves the grid's normal
    // flow.  A dummy placeholder div in the template keeps the col 1 auto track
    // stable without needing an explicit px value here.
    let col1: string;
    if (!this.hasSideNav()) {
      col1 = "0px"; // no side nav projected — collapse the column entirely
    } else if (navOpen && navPush) {
      col1 = `${this.sideNavService.widthRem()}rem`; // full nav, push+open
    } else if (navPush || siderailPush) {
      col1 = "auto"; // siderail in flow, size naturally
    } else {
      col1 = "0px"; // viewport too narrow even for siderail
    }

    // col3: minmax(0px, declaredMax) instead of "auto" so the track is sized by its
    // explicit bounds rather than by the item's content-based size.  This lets CSS
    // grid shrink the drawer column down to 0 when the available space is limited,
    // while col2's minmax base reserves mainMinWidthPx for main first.
    // The dialog uses tw-w-full so it fills the column without overflowing it.
    let col3: string;
    if (!drawerActive) {
      col3 = "0px";
    } else if (!drawerPush) {
      col3 = "1fr";
    } else if (declaredDrawerWidth > 0) {
      col3 = `minmax(0px, ${declaredDrawerWidth}px)`;
    } else {
      col3 = "auto"; // fallback before dialog's effect declares its width
    }
    const col2 = !drawerActive || drawerPush ? `minmax(${mainMinWidthPx}px, 1fr)` : "0px";

    return `${col1} ${col2} ${col3}`;
  });

  constructor() {
    afterNextRender(() => {
      const container = this.container().nativeElement;
      const drawerContainer = this.drawerContainer().nativeElement;

      const update = () => {
        const rootFontSizePx = getRootFontSizePx();
        const containerWidth = container.clientWidth;
        const siderailPx = SIDERAIL_WIDTH_REM * rootFontSizePx;
        const mainMinPx = MAIN_MIN_WIDTH_REM * rootFontSizePx;
        const navWidthPx = this.sideNavService.widthRem() * rootFontSizePx;
        const drawerMinPx = drawerSizeToWidthRem.small * rootFontSizePx;

        this.containerWidthPx.set(containerWidth);

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
        // drawerPush: true if the drawer fits at any width (full or shrunk) alongside either nav or siderail.
        // navPush: true if the full nav fits alongside the drawer; false if only the siderail fits.
        //          When no drawer is active, falls back to navAloneCanPush.
        const drawerPush =
          drawerFullWidthNavCanPush ||
          drawerFullWidthSiderailCanPush ||
          drawerMinWithNavCanPush ||
          drawerMinWithSiderailCanPush;
        const navPush = drawerPush
          ? drawerFullWidthNavCanPush || drawerMinWithNavCanPush
          : navAloneCanPush && drawerWidthPx === 0;

        // In shrink-push mode the drawer occupies less than its declared max, so use
        // the actual available space as the effective drawer width for the siderail check.
        const drawerEffectivePx = drawerPush
          ? Math.min(drawerWidthPx, Math.max(0, containerWidth - siderailPx - mainMinPx))
          : 0;
        const siderailCanPush = drawerPush
          ? containerWidth - siderailPx - drawerEffectivePx >= mainMinPx
          : containerWidth - siderailPx >= mainMinPx;

        const wasInPushMode = this.sideNavService.isPushMode();

        // Transitioning out of push mode → close the nav.
        // (If already in overlay and open, leave it — it's intentionally overlaying content.)
        if (!navPush && this.sideNavService.open() && wasInPushMode) {
          this.sideNavService.open.set(false);
        }

        // Transitioning into push mode → reopen unless the user explicitly closed it.
        if (
          navPush &&
          !wasInPushMode &&
          this.sideNavService.userCollapsePreference() !== "closed"
        ) {
          this.sideNavService.open.set(true);
        }

        this.sideNavService.isPushMode.set(navPush);
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
