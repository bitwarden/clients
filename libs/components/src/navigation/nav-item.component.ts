import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, inject, signal, computed } from "@angular/core";
import { RouterModule, RouterLinkActive } from "@angular/router";

import { IconButtonModule } from "../icon-button";

import { NavBaseComponent } from "./nav-base.component";
import { SideNavService } from "./side-nav.service";

// Resolves a circular dependency between `NavItemComponent` and `NavItemGroup` when using standalone components.
export abstract class NavGroupAbstraction {
  abstract setOpen(open: boolean): void;
}

@Component({
  selector: "bit-nav-item",
  templateUrl: "./nav-item.component.html",
  providers: [{ provide: NavBaseComponent, useExisting: NavItemComponent }],
  imports: [CommonModule, IconButtonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(focusin)": "onFocusIn($event.target)",
    "(focusout)": "onFocusOut()",
  },
})
export class NavItemComponent extends NavBaseComponent {
  /**
   * Forces active styles to be shown, regardless of the `routerLinkActiveOptions`
   */
  readonly forceActiveStyles = input<boolean>(false);

  protected readonly sideNavService = inject(SideNavService);
  private readonly parentNavGroup = inject(NavGroupAbstraction, { optional: true });

  /**
   * Is `true` if `to` matches the current route
   */
  private _isActive = false;
  protected setIsActive(isActive: boolean) {
    this._isActive = isActive;
    if (this._isActive && this.parentNavGroup) {
      this.parentNavGroup.setOpen(true);
    }
  }
  protected get showActiveStyles() {
    return this.forceActiveStyles() || (this._isActive && !this.hideActiveStyles());
  }

  /**
   * Allow overriding of the RouterLink['ariaCurrentWhenActive'] property.
   *
   * Useful for situations like nav-groups that navigate to their first child page and should
   * not be marked `current` while the child page is marked as `current`
   */
  readonly ariaCurrentWhenActive = input<RouterLinkActive["ariaCurrentWhenActive"]>("page");

  /**
   * The design spec calls for the an outline to wrap the entire element when the template's
   * anchor/button has :focus-visible. Usually, we would use :focus-within for this. However, that
   * matches when a child element has :focus instead of :focus-visible.
   *
   * Currently, the browser does not have a pseudo selector that combines these two, e.g.
   * :focus-visible-within (WICG/focus-visible#151). To make our own :focus-visible-within
   * functionality, we use event delegation on the host and manually check if the focus target
   * (denoted with the data-fvw attribute) matches :focus-visible. We then map that state to some
   * styles, so the entire component can have an outline.
   */
  protected readonly focusVisibleWithin = signal(false);
  protected readonly fvwStyles = computed(() =>
    this.focusVisibleWithin()
      ? "tw-z-10 tw-rounded tw-outline-none tw-ring tw-ring-inset tw-ring-text-alt2"
      : "",
  );

  protected onFocusIn(target: HTMLElement) {
    this.focusVisibleWithin.set(target.matches("[data-fvw]:focus-visible"));
  }

  protected onFocusOut() {
    this.focusVisibleWithin.set(false);
  }
}
