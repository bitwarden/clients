import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  input,
  output,
  viewChild,
} from "@angular/core";
import { QueryParamsHandling } from "@angular/router";

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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbComponent {
  /**
   * Optional icon to display before the breadcrumb text.
   */
  readonly icon = input<string>();

  /**
   * Router link for the breadcrumb. Can be a string or an array of route segments.
   */
  readonly route = input<string | any[]>();

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

  onClick(args: unknown) {
    this.click.emit(args);
  }
}
