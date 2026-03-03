import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  input,
  inject,
  signal,
  computed,
  model,
} from "@angular/core";
import { RouterModule, RouterLinkActive } from "@angular/router";

import { IconButtonModule } from "../icon-button";

import { NavBaseComponent } from "./nav-base.component";
import { SideNavService } from "./side-nav.service";

// Resolves a circular dependency between `NavItemComponent` and `NavItemGroup` when using standalone components.
export abstract class NavGroupAbstraction {
  abstract setOpen(open: boolean): void;
  abstract treeDepth: ReturnType<typeof model<number>>;
}

@Component({
  selector: "bit-nav-item",
  templateUrl: "./nav-item.component.html",
  providers: [{ provide: NavBaseComponent, useExisting: NavItemComponent }],
  imports: [NgTemplateOutlet, IconButtonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(focusin)": "onFocusIn($event.target)",
    "(focusout)": "onFocusOut()",
  },
})
export class NavItemComponent extends NavBaseComponent {
  /**
   * Base padding for tree variant items (in rem)
   * This provides the initial indentation for tree items before depth-based padding
   */
  protected readonly TREE_BASE_PADDING = 2.5;

  /**
   * Padding increment per tree depth level (in rem)
   * Each nested level adds this amount of padding to visually indicate hierarchy
   */
  protected readonly TREE_DEPTH_PADDING = 1.75;

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
   * adding calculation for tree variant due to needing visual alignment on different indentation levels needed between the first level and subsequent levels
   */
  protected readonly navItemIndentationPadding = computed(() => {
    const open = this.sideNavService.open();
    const depth = this.treeDepth() ?? 0;

    if (open && this.variant() === "tree") {
      return depth === 1
        ? `${this.TREE_BASE_PADDING}rem`
        : `${this.TREE_BASE_PADDING + (depth - 1) * this.TREE_DEPTH_PADDING}rem`;
    }

    return `${this.TREE_BASE_PADDING * depth}rem`;
  });

  /**
   * Allow overriding of the RouterLink['ariaCurrentWhenActive'] property.
   *
   * Useful for situations like nav-groups that navigate to their first child page and should
   * not be marked `current` while the child page is marked as `current`
   */
  readonly ariaCurrentWhenActive = input<RouterLinkActive["ariaCurrentWhenActive"]>("page");

  /**
   * By default, a navigation will put the user's focus on the `main` element.
   *
   * If the user's focus should be moved to another element upon navigation end, pass a selector
   * here (i.e. `#elementId`).
   *
   * Pass `false` to opt out of moving the focus entirely. Focus will stay on the nav item.
   *
   * See router-focus-manager.service for implementation of focus management
   */
  readonly focusAfterNavTarget = input<string | boolean>();

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
      ? "tw-z-10 tw-rounded tw-outline-none tw-ring tw-ring-inset tw-ring-border-focus"
      : "",
  );

  protected onFocusIn(target: HTMLElement) {
    this.focusVisibleWithin.set(target.matches("[data-fvw]:focus-visible"));
  }

  protected onFocusOut() {
    this.focusVisibleWithin.set(false);
  }

  constructor() {
    super();

    // Set tree depth based on parent's depth
    if (this.parentNavGroup) {
      this.treeDepth.set(this.parentNavGroup.treeDepth() + 1);
    }
  }
}
