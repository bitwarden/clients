import { A11yModule } from "@angular/cdk/a11y";
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  booleanAttribute,
  computed,
  contentChild,
  input,
  output,
  viewChild,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule } from "../icon-button/icon-button.module";
import { TypographyModule } from "../typography";

import { PopoverHeaderComponent } from "./popover-header.component";

/**
 * Popover component for displaying contextual content in an overlay.
 * Used with `bitPopoverAnchorFor` or `bitPopoverTriggerFor` directives.
 */
@Component({
  selector: "bit-popover",
  imports: [A11yModule, I18nPipe, IconButtonModule, TypographyModule],
  templateUrl: "./popover.component.html",
  exportAs: "popoverComponent",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverComponent {
  /** Reference to the popover content template */
  readonly templateRef = viewChild.required(TemplateRef);

  /** Optional title displayed in the popover header */
  readonly title = input("");

  /**
   * Screen-reader-accessible name for the popover dialog. Required when no
   * `title` is supplied so the dialog is still labelled; ignored when a `title`
   * is present, since the title labels the dialog.
   */
  readonly accessibleName = input<string>();

  /**
   * Whether the built-in close button is shown. Set to `false` when the popover
   * is dismissed another way (backdrop click, Escape, or an anchor toggle) and
   * the close affordance is unwanted.
   */
  readonly showCloseButton = input(true, { transform: booleanAttribute });

  /**
   * Tailwind max-height class constraining the popover's height. When set, the
   * content scrolls vertically once it exceeds this height. Must be a valid
   * Tailwind max-height utility (e.g. "tw-max-h-96", "tw-max-h-[25rem]").
   */
  readonly maxHeightClass = input<`tw-max-h-${string}`>();

  /** Emitted when the close button is clicked */
  readonly closed = output();

  protected readonly header = contentChild(PopoverHeaderComponent);

  /** The dialog's accessible name — the title when present, otherwise the explicit fallback. */
  protected readonly dialogLabel = computed(() => this.title() || this.accessibleName());

  protected readonly closeButtonType = computed(() =>
    this.header() ? "secondary" : "primaryGhost",
  );

  protected readonly titleClasses = computed(() =>
    [
      this.showCloseButton() && !this.header() ? "tw-pe-7" : "",
      "tw-text-fg-heading",
      "!tw-mb-0",
    ].join(" "),
  );

  // When there's no title (and no header) to carry it, the content sits at the
  // top and must reserve room for the absolutely-positioned close button so its
  // first line doesn't run underneath it. Only needed while that button is shown.
  protected readonly contentClasses = computed(() =>
    [
      this.showCloseButton() && !this.title() && !this.header() ? "tw-pe-7" : "",
      "tw-text-fg-body",
    ].join(" "),
  );

  protected readonly containerClasses = computed(() =>
    [
      "tw-overflow-y-auto",
      "tw-rounded-xl",
      "tw-shadow-md",
      "tw-border",
      "tw-border-border-base",
      this.maxHeightClass() ?? "",
      /**
       * tailwind's outline-none does not fully remove it because it supports forced colors mode, so
       * we need to do it manually
       */
      "[outline:none]",
    ].join(" "),
  );
}
