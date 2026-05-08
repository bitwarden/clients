import { A11yModule } from "@angular/cdk/a11y";
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
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

  /** Emitted when the close button is clicked */
  readonly closed = output();

  protected readonly header = contentChild(PopoverHeaderComponent);

  protected readonly closeButtonType = computed(() =>
    this.header() ? "secondary" : "primaryGhost",
  );

  protected readonly titleClasses = computed(() =>
    [this.header() ? "" : "tw-pe-7", "tw-text-fg-heading", "!tw-mb-0"].join(" "),
  );
}
