// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { Component, EventEmitter, Output, TemplateRef, ViewChild, input } from "@angular/core";
import { QueryParamsHandling } from "@angular/router";

@Component({
  selector: "bit-breadcrumb",
  templateUrl: "./breadcrumb.component.html",
})
export class BreadcrumbComponent {
  readonly icon = input<string>();

  readonly route = input<string | any[]>();

  readonly queryParams = input<Record<string, string>>({});

  readonly queryParamsHandling = input<QueryParamsHandling>();

  @Output()
  click = new EventEmitter();

  @ViewChild(TemplateRef, { static: true }) content: TemplateRef<unknown>;

  onClick(args: unknown) {
    this.click.next(args);
  }
}
