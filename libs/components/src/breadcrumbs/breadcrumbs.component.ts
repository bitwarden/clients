import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  input,
} from "@angular/core";
import { RouterModule } from "@angular/router";

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
  host: { class: "tw-flex tw-items-center" },
})
export class BreadcrumbsComponent {
  /**
   * The maximum number of breadcrumbs to show before overflow.
   */
  readonly show = input(4);

  /**
   * The size of the breadcrumb text and icons. Defaults to "base" size.
   */
  readonly size = input<"small" | "base">("base");

  protected readonly breadcrumbs = contentChildren(BreadcrumbComponent);

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
  protected readonly afterOverflow = computed(() => this.breadcrumbs().slice(-1));

  protected readonly breadcrumbStyles = [
    "tw-inline-block",
    "!tw-m-0",
    "!tw-text-fg-body",
    "hover:!tw-text-fg-brand",
    "focus-visible:!tw-text-fg-brand",
    "focus-visible:!tw-rounded",
    "focus-visible:!tw-outline-none",
    "focus-visible:!tw-ring-2",
    "focus-visible:!tw-ring-border-focus",
  ];
}
