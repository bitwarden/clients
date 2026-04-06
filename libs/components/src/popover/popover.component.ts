import { A11yModule } from "@angular/cdk/a11y";
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  contentChild,
  input,
  output,
  viewChild,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule } from "../icon-button/icon-button.module";
import { TypographyModule } from "../typography";

import { PopoverFooterDirective } from "./popover-footer.directive";
import { PopoverHeaderDirective } from "./popover-header.directive";

/**
 * Popover component for displaying contextual content in an overlay.
 * Used with `bitPopoverAnchorFor` or `bitPopoverTriggerFor` directives.
 */
@Component({
  selector: "bit-popover",
  imports: [
    A11yModule,
    I18nPipe,
    IconButtonModule,
    TypographyModule,
    PopoverHeaderDirective,
    PopoverFooterDirective,
  ],
  templateUrl: "./popover.component.html",
  styleUrl: "./popover.component.css",
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

  /** @internal — slot detection only */
  protected readonly headerSlot = contentChild(PopoverHeaderDirective);

  /** @internal — slot detection only */
  protected readonly footerSlot = contentChild(PopoverFooterDirective);
}
