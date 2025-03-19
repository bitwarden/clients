// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, EventEmitter, Input, Output } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";

/**
 * `NavGroupComponent` builds upon `NavItemComponent`. This class represents the properties that are passed down to `NavItemComponent`.
 */
@Directive()
export abstract class NavBaseComponent {
  /**
   * Text to display in main content
   */
  @Input() text: string;

  /**
   * `aria-label` for main content
   */
  @Input() ariaLabel: string;

  /**
   * Optional icon, e.g. `"bwi-collection"`
   */
  @Input() icon: string;

  /**
   * Optional route to be passed to internal `routerLink`. If not provided, the nav component will render as a button.
   *
   * See: {@link RouterLink.routerLink}
   *
   * ---
   *
   * We can't name this "routerLink" because Angular will mount the `RouterLink` directive.
   *
   * See: {@link https://github.com/angular/angular/issues/24482}
   */
  @Input() route?: RouterLink["routerLink"];

  /**
   * Passed to internal `routerLink`
   *
   * See {@link RouterLink.relativeTo}
   */
  @Input() relativeTo?: RouterLink["relativeTo"];

  /**
   * Passed to internal `routerLink`
   *
   * See {@link RouterLinkActive.routerLinkActiveOptions}
   */
  @Input() routerLinkActiveOptions?: RouterLinkActive["routerLinkActiveOptions"] = {
    paths: "subset",
    queryParams: "ignored",
    fragment: "ignored",
    matrixParams: "ignored",
  };

  /**
   * If this item is used within a tree, set `variant` to `"tree"`
   */
  @Input() variant: "default" | "tree" = "default";

  /**
   * Depth level when nested inside of a `'tree'` variant
   */
  @Input() treeDepth = 0;

  /**
   * If `true`, do not change styles when nav item is active.
   */
  @Input() hideActiveStyles = false;

  /**
   * Fires when main content is clicked
   */
  @Output() mainContentClicked: EventEmitter<MouseEvent> = new EventEmitter();
}
