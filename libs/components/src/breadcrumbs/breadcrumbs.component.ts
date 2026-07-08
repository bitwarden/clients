import { CommonModule } from "@angular/common";
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
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
} from "../overflow-list";
import { TypographyModule } from "../typography";

import { BreadcrumbComponent } from "./breadcrumb.component";

/** Approximate width reserved for the trailing separator arrow (icon + margins), in pixels. */
const TRAILING_ARROW_RESERVE_PX = 48;

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
  private readonly destroyRef = inject(DestroyRef);
  protected readonly ariaLabel = this.i18nService.t("breadcrumbs");

  /** Live width of the host element, observed from a stable ancestor. */
  private readonly hostWidth = signal(0);

  /**
   * Width handed to the overflow list. Derived from the host rather than letting the list
   * observe its own element: the list host is content-sized (it shrinks as items hide), so
   * self-observation would feed the packing decision back into its own input and, once
   * collapsed, never re-expand. Reserve room for the trailing arrow when it's shown.
   */
  protected readonly availableWidth = computed(() =>
    Math.max(0, this.hostWidth() - (this.showTrailingArrow() ? TRAILING_ARROW_RESERVE_PX : 0)),
  );

  /**
   * @deprecated Breadcrumb overflow is now width-driven — breadcrumbs collapse into the
   * "More" menu when they don't fit the available space, regardless of count. This input
   * is ignored and will be removed. See {@link OverflowListDirective}.
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

  constructor() {
    const hostEl = this.hostRef.nativeElement;
    const ro = new ResizeObserver((entries) =>
      this.hostWidth.set(entries[0].contentBoxSize[0].inlineSize),
    );
    afterNextRender(() => {
      this.hostWidth.set(hostEl.clientWidth);
      ro.observe(hostEl);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });
  }

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
