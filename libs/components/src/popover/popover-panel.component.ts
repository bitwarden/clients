import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  TemplateRef,
  viewChild,
  ViewContainerRef,
  inject,
} from "@angular/core";

import { PopoverBaseComponent } from "./popover-base.component";

/**
 * Minimal popover panel used for overflow lists, like badge group and chip group. Only meant to be
 * used internally in the CL. Prefer using bit-popover instead.
 */
@Component({
  selector: "bit-popover-panel",
  imports: [PopoverBaseComponent],
  templateUrl: "./popover-panel.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverPanelComponent {
  /** Reference to the popover content template */
  readonly templateRef = viewChild.required(TemplateRef);

  /** Where `PopoverService` renders the content by default. */
  readonly viewContainerRef = inject(ViewContainerRef);

  /** Emitted when the popover closes */
  readonly closed = output();

  /**
   * Screen-reader-accessible name for the popover dialog.
   */
  readonly accessibleName = input.required<string>();
}
