import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, QueryParamsHandling, Router, RouterLink, UrlTree } from "@angular/router";
import { filter } from "rxjs";

import { IconModule } from "../icon";
import { BitwardenIcon } from "../shared/icon";

/**
 * Individual breadcrumb item used within the `bit-breadcrumbs` component.
 * Represents a single navigation step in the breadcrumb trail.
 *
 * This component should be used as a child of `bit-breadcrumbs` and supports both
 * router navigation and custom click handlers.
 */
@Component({
  selector: "bit-breadcrumb",
  templateUrl: "./breadcrumb.component.html",
  imports: [IconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbComponent {
  /**
   * Optional icon to display before the breadcrumb text.
   */
  readonly icon = input<BitwardenIcon>();

  /**
   * Router link for the breadcrumb. Can be a string or an array of route segments.
   */
  readonly route = input<RouterLink["routerLink"]>();

  /**
   * Query parameters to include in the router link.
   */
  readonly queryParams = input<Record<string, string>>({});

  /**
   * How to handle query parameters when navigating. Options include 'merge' or 'preserve'.
   */
  readonly queryParamsHandling = input<QueryParamsHandling>();

  /**
   * Emitted when the breadcrumb is clicked.
   */
  readonly click = output<unknown>();

  /** Used by the BreadcrumbsComponent to access the breadcrumb content */
  readonly content = viewChild(TemplateRef);

  private readonly router = inject(Router);

  readonly isActiveRoute = signal(false);

  checkActiveRoute() {
    const route = this.route();

    if (!route) {
      return;
    }

    let routeStringOrUrlTree: string | UrlTree = "";

    if (typeof route === "string" || route instanceof UrlTree) {
      routeStringOrUrlTree = route;
    } else {
      routeStringOrUrlTree = this.router.createUrlTree(route);
    }

    const result = this.router.isActive(routeStringOrUrlTree, {
      paths: "subset",
      queryParams: "exact",
      fragment: "ignored",
      matrixParams: "ignored",
    });

    this.isActiveRoute.set(result);
  }

  constructor() {
    this.router.events
      .pipe(
        takeUntilDestroyed(),
        filter((event) => event instanceof NavigationEnd),
      )
      .subscribe((_) => this.checkActiveRoute());
  }

  onClick(args: unknown) {
    this.click.emit(args);
  }
}
