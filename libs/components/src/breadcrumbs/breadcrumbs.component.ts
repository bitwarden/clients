import { CommonModule } from "@angular/common";
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
} from "@angular/core";
import { RouterModule } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { IconModule } from "../icon";
import { IconButtonModule } from "../icon-button";
import { MenuModule } from "../menu";
import {
  OverflowItemDirective,
  OverflowListDirective,
  OverflowTriggerDirective,
  observedWidth,
} from "../overflow-list";
import { TypographyModule } from "../typography";

import { BreadcrumbComponent } from "./breadcrumb.component";

/** Approximate width reserved for the trailing separator arrow (icon + margins), per size, in pixels. */
const TRAILING_ARROW_RESERVE_PX = { base: 48, small: 34 } as const;

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
    RouterModule,
    IconModule,
    IconButtonModule,
    MenuModule,
    TypographyModule,
    OverflowListDirective,
    OverflowItemDirective,
    OverflowTriggerDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-flex tw-items-center",
    role: "navigation",
    "[attr.aria-label]": "ariaLabel",
  },
})
export class BreadcrumbsComponent {
  private readonly i18nService = inject(I18nService);
  private readonly hostRef = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly ariaLabel = this.i18nService.t("breadcrumbs");

  /** Live width of the host element, observed from a stable ancestor. */
  private readonly hostWidth = observedWidth(this.hostRef);

  /**
   * Width handed to the overflow list. Derived from the host rather than letting the list
   * observe its own element: the list host is content-sized (it shrinks as items hide), so
   * self-observation would feed the packing decision back into its own input and, once
   * collapsed, never re-expand. Reserve room for the trailing arrow when it's shown; the arrow
   * shrinks with `size`, so the reserve tracks it too.
   */
  protected readonly availableWidth = computed(() =>
    Math.max(
      0,
      this.hostWidth() - (this.showTrailingArrow() ? TRAILING_ARROW_RESERVE_PX[this.size()] : 0),
    ),
  );

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

  private readonly overflowList = viewChild.required(OverflowListDirective);

  constructor() {
    // Push our size down to each child crumb so they can size projected icon tiles in step.
    effect(() => {
      const size = this.size();
      this.breadcrumbs().forEach((breadcrumb) => breadcrumb.size.set(size));
    });

    // `size` swaps crumb typography and separator margins, so item widths change with it,
    // but the directive only remeasures on item-set changes. Without this, widths cached at
    // one density would drive packing at the other. `reset` is required because a collapsed
    // crumb stamps no content, so measuring without it captures just the separator arrow.
    effect(() => {
      this.size();
      this.overflowList().remeasure({ reset: true });
    });
  }

  protected readonly baseStyles = [
    "tw-inline-block",
    "tw-min-w-0",
    "!tw-m-0",
    "tw-rounded",
    "focus-visible:!tw-text-fg-brand",
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
