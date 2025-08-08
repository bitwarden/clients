import { Component, EventEmitter, Output, TemplateRef, input, viewChild } from "@angular/core";
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

  readonly content = viewChild(TemplateRef);

  onClick(args: unknown) {
    this.click.next(args);
  }
}
