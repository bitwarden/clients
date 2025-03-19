// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { A11yModule } from "@angular/cdk/a11y";
import { Component, EventEmitter, Input, Output, TemplateRef, ViewChild } from "@angular/core";

import { IconButtonModule } from "../icon-button/icon-button.module";
import { SharedModule } from "../shared/shared.module";
import { TypographyModule } from "../typography";

@Component({
  standalone: true,
  selector: "bit-popover",
  imports: [A11yModule, IconButtonModule, SharedModule, TypographyModule],
  templateUrl: "./popover.component.html",
  exportAs: "popoverComponent",
})
export class PopoverComponent {
  @ViewChild(TemplateRef) templateRef: TemplateRef<any>;
  @Input() title = "";
  @Output() closed = new EventEmitter();
}
