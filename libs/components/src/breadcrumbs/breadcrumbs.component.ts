import { CommonModule } from "@angular/common";
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  inject,
  input,
} from "@angular/core";
import { RouterModule } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { IconModule } from "../icon";
import { IconButtonModule } from "../icon-button";
import { LinkModule } from "../link";
import { MenuModule } from "../menu";
import { TypographyModule } from "../typography";

import { BreadcrumbComponent } from "./breadcrumb.component";

/**
 * Breadcrumbs are used to help users understand where they are in a products navigation. Typically
 * Bitwarden uses this component to indicate the user's current location in a set of data organized in
 * containers (Collections, Folders, or Projects).
 */
@Component({
  selector: "bit-breadcrumbs",
  templateUrl: "./breadcrumbs.component.html",
  imports: [
    I18nPipe,
    CommonModule,
    LinkModule,
    RouterModule,
    IconModule,
    IconButtonModule,
    MenuModule,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: "navigation",
    "[attr.aria-label]": "ariaLabel",
  },
})
export class BreadcrumbsComponent {
  private readonly i18nService = inject(I18nService);
  protected readonly ariaLabel = this.i18nService.t("breadcrumbs");
  /**
   * The maximum number of breadcrumbs to show before overflow.
   */
  readonly show = input(4);

  /**
   * The size of the breadcrumb text and icons. Defaults to "base" size.
   */
  readonly size = input<"small" | "base">("base");

  /**
   * Display an arrow after the last breadcrumb in the list.
   *
   * Intended to support usage of the breadcrumbs above our web header component. In this case, the
   * "active" breadcrumb is displayed as the header of the page, so showing an arrow after the last
   * breadcrumb provides better logical continuity of breadcrumbs -> header. Do not use this if the
   * active breadcrumb is actually passed as a breadcrumb to `bit-breadcrumbs`.
   */
  readonly showTrailingArrow = input(false, { transform: booleanAttribute });

  protected readonly breadcrumbs = contentChildren(BreadcrumbComponent);

  protected readonly activeBreadcrumb = computed(() => {
    const result = this.breadcrumbs().find((breadcrumb) => breadcrumb.isActiveRoute());

    return result;
  });

  /** Whether the breadcrumbs exceed the show limit and require an overflow menu */
  protected readonly hasOverflow = computed(() => this.breadcrumbs().length > this.show());

  /** Breadcrumbs shown before the overflow menu */
  protected readonly beforeOverflow = computed(() => {
    const items = this.breadcrumbs();
    const showCount = this.show();

    if (items.length > showCount) {
      return items.slice(0, showCount - 1);
    }
    return items;
  });

  /** Breadcrumbs hidden in the overflow menu */
  protected readonly overflow = computed(() => {
    return this.breadcrumbs().slice(this.show() - 1, -1);
  });

  /** The last breadcrumb, shown after the overflow menu */
  protected readonly afterOverflow = computed(() => this.breadcrumbs().at(-1));

  protected readonly baseStyles = [
    "tw-inline-block",
    "!tw-m-0",
    "focus-visible:!tw-text-fg-brand",
    "focus-visible:!tw-rounded",
    "focus-visible:tw-outline-none",
    "focus-visible:tw-ring-2",
    "focus-visible:tw-ring-border-focus",
  ];

  protected readonly breadcrumbStyles = [
    ...this.baseStyles,
    "!tw-text-fg-body",
    "hover:!tw-text-fg-brand",
  ];

  protected readonly activeBreadcrumbStyles = [...this.baseStyles, "!tw-text-fg-heading"];
}
