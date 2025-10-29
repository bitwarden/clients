import { Component, EventEmitter, Output, TemplateRef, input, viewChild } from "@angular/core";
import { QueryParamsHandling } from "@angular/router";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-breadcrumb",
  templateUrl: "./breadcrumb.component.html",
})
export class BreadcrumbComponent {
  readonly icon = input<string>();

  readonly route = input<string | any[]>();

  readonly queryParams = input<Record<string, string>>({});

  readonly queryParamsHandling = input<QueryParamsHandling>();

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  click = new EventEmitter();

  readonly content = viewChild(TemplateRef);

  onClick(args: unknown) {
    this.click.next(args);
  }
}
