import { Directive, input, output } from "@angular/core";
import { RouterLink, RouterLinkActive } from "@angular/router";

/**
 * Base class for navigation components in the side navigation.
 *
 * `NavGroupComponent` builds upon `NavItemComponent`. This class represents the properties
 * that are passed down to `NavItemComponent`.
 */
@Directive()
export abstract class NavBaseComponent {
  /**
   * Text to display in main content
   */
  readonly text = input<string>();

  /**
   * `aria-label` for main content
   */
  readonly ariaLabel = input<string>();

  /**
   * Optional icon, e.g. `"bwi-collection-shared"`
   */
  readonly icon = input<string>();

  /**
   * Optional route to be passed to internal `routerLink`.
   * If not provided, the nav component will render as a button.
   *
   * @remarks
   * We can't name this "routerLink" because Angular will mount the `RouterLink` directive.
   *
   * @see {@link RouterLink.routerLink}
   * @see {@link https://github.com/angular/angular/issues/24482}
   */
  readonly route = input<RouterLink["routerLink"]>();

  /**
   * Passed to internal `routerLink`
   *
   * @see {@link RouterLink.relativeTo}
   */
  readonly relativeTo = input<RouterLink["relativeTo"]>();

  /**
   * Passed to internal `routerLink`
   *
   * @default { paths: "subset", queryParams: "ignored", fragment: "ignored", matrixParams: "ignored" }
   * @see {@link RouterLinkActive.routerLinkActiveOptions}
   */
  readonly routerLinkActiveOptions = input<RouterLinkActive["routerLinkActiveOptions"]>({
    paths: "subset",
    queryParams: "ignored",
    fragment: "ignored",
    matrixParams: "ignored",
  });

  /**
   * If `true`, do not change styles when nav item is active.
   */
  readonly hideActiveStyles = input(false);

  /**
   * Fires when main content is clicked
   */
  readonly mainContentClicked = output<void>();
}
