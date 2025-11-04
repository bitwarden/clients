import { CommonModule } from "@angular/common";
import { Component, HostListener, Optional, input, model } from "@angular/core";
import { RouterLinkActive, RouterModule } from "@angular/router";
import { BehaviorSubject, map } from "rxjs";

import { IconButtonModule } from "../icon-button";

import { NavBaseComponent } from "./nav-base.component";
import { SideNavService } from "./side-nav.service";

// Resolves a circular dependency between `NavItemComponent` and `NavItemGroup` when using standalone components.
export abstract class NavGroupAbstraction {
  abstract setOpen(open: boolean): void;
  abstract treeDepth: ReturnType<typeof model<number>>;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-nav-item",
  templateUrl: "./nav-item.component.html",
  providers: [{ provide: NavBaseComponent, useExisting: NavItemComponent }],
  imports: [CommonModule, IconButtonModule, RouterModule],
})
export class NavItemComponent extends NavBaseComponent {
  /**
   * Base padding for tree variant items (in rem)
   * This provides the initial indentation for tree items before depth-based padding
   */
  protected readonly TREE_BASE_PADDING = 1.25;

  /**
   * Padding increment per tree depth level (in rem)
   * Each nested level adds this amount of padding to visually indicate hierarchy
   */
  protected readonly TREE_DEPTH_PADDING = 1.25;

  /** Forces active styles to be shown, regardless of the `routerLinkActiveOptions` */
  readonly forceActiveStyles = input<boolean>(false);

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
  protected focusVisibleWithin$ = new BehaviorSubject(false);
  protected fvwStyles$ = this.focusVisibleWithin$.pipe(
    map((value) =>
      value ? "tw-z-10 tw-rounded tw-outline-none tw-ring tw-ring-inset tw-ring-text-alt2" : "",
    ),
  );
  @HostListener("focusin", ["$event.target"])
  onFocusIn(target: HTMLElement) {
    this.focusVisibleWithin$.next(target.matches("[data-fvw]:focus-visible"));
  }
  @HostListener("focusout")
  onFocusOut() {
    this.focusVisibleWithin$.next(false);
  }

  constructor(
    protected sideNavService: SideNavService,
    @Optional() private parentNavGroup: NavGroupAbstraction,
  ) {
    super();

    // Set tree depth based on parent's depth
    if (this.parentNavGroup) {
      this.treeDepth.set(this.parentNavGroup.treeDepth() + 1);
    }
  }
}
