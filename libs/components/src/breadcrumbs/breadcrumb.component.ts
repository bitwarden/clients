// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import {
  Component,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
  ViewChild,
  input,
} from "@angular/core";
import { QueryParamsHandling } from "@angular/router";

@Component({
  selector: "bit-breadcrumb",
  templateUrl: "./breadcrumb.component.html",
})
export class BreadcrumbComponent {
  // TODO: Skipped for migration because:
  //  This input is used in a control flow expression (e.g. `@if` or `*ngIf`)
  //  and migrating would break narrowing currently.
  @Input()
  icon?: string;

  // TODO: Skipped for migration because:
  //  This input is used in a control flow expression (e.g. `@if` or `*ngIf`)
  //  and migrating would break narrowing currently.
  @Input()
  route?: string | any[] = undefined;

  readonly queryParams = input<Record<string, string>>({});

  readonly queryParamsHandling = input<QueryParamsHandling>(undefined);

  @Output()
  click = new EventEmitter();

  @ViewChild(TemplateRef, { static: true }) content: TemplateRef<unknown>;

  onClick(args: unknown) {
    this.click.next(args);
  }
}
