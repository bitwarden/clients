import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  TemplateRef,
  contentChild,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ActivatedRoute,
  NavigationEnd,
  QueryParamsHandling,
  Router,
  RouterLink,
  UrlTree,
} from "@angular/router";
import { filter } from "rxjs";

import { IconModule } from "../icon";
import { IconTileComponent } from "../icon-tile";
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
export class BreadcrumbComponent implements OnInit {
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

  /** An icon tile projected into the `start` slot, whose size we keep in sync with the container. */
  private readonly startIconTile = contentChild(IconTileComponent);

  /**
   * The size of the crumb, set by the parent `bit-breadcrumbs`. Used to size a projected
   * icon tile in step with the breadcrumbs `size`. Defaults to "base" for standalone use.
   */
  readonly size = signal<"small" | "base">("base");

  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly isActiveRoute = signal(false);

  checkActiveRoute() {
    const route = this.route();

    if (!route) {
      return;
    }

    // Resolve the target the same way `RouterLink` does — a bare string is a single command, and
    // `queryParams`/`queryParamsHandling` are part of the URL the crumb navigates to. Comparing
    // against the path alone marks every crumb sharing that path as active, which is the norm for
    // crumbs that navigate via query params (ex. `[route]="[]"` plus a differing `collectionId`).
    const urlTree =
      route instanceof UrlTree
        ? route
        : this.router.createUrlTree(Array.isArray(route) ? route : [route], {
            relativeTo: this.activatedRoute,
            queryParams: this.queryParams(),
            queryParamsHandling: this.queryParamsHandling(),
          });

    const result = this.router.isActive(urlTree, {
      paths: "exact",
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

    // Drive the projected icon tile's size from the crumb size (pushed by the parent
    // `bit-breadcrumbs`) so it stays in sync. Runs once the content query resolves.
    effect(() => {
      const tile = this.startIconTile();
      if (tile) {
        tile.size.set(this.size() === "small" ? "xs" : "sm");
      }
    });
  }

  ngOnInit() {
    // Check again, when inputs are populated, to catch the case where a `bit-breadcrumb` created
    // *after* the `NavigationEnd` for the current URL has already fired (ex. async data revealing
    // an `@if`, a lazily-shown breadcrumb list, a Storybook story with no subsequent navigation).
    this.checkActiveRoute();
  }

  onClick(args: unknown) {
    this.click.emit(args);
  }
}
