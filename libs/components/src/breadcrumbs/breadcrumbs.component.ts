import { CommonModule } from "@angular/common";
import { Component, ContentChildren, QueryList, input } from "@angular/core";
import { RouterModule } from "@angular/router";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule } from "../icon-button";
import { LinkModule } from "../link";
import { MenuModule } from "../menu";

import { BreadcrumbComponent } from "./breadcrumb.component";

/**
 * Breadcrumbs are used to help users understand where they are in a products navigation. Typically
 * Bitwarden uses this component to indicate the user's current location in a set of data organized in
 * containers (Collections, Folders, or Projects).
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-breadcrumbs",
  templateUrl: "./breadcrumbs.component.html",
  imports: [I18nPipe, CommonModule, LinkModule, RouterModule, IconButtonModule, MenuModule],
})
export class BreadcrumbsComponent {
  readonly show = input(3);

  private breadcrumbs: BreadcrumbComponent[] = [];

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ContentChildren(BreadcrumbComponent)
  protected set breadcrumbList(value: QueryList<BreadcrumbComponent>) {
    this.breadcrumbs = value.toArray();
  }

  protected get beforeOverflow() {
    if (this.hasOverflow) {
      return this.breadcrumbs.slice(0, this.show() - 1);
    }

    return this.breadcrumbs;
  }

  protected get overflow() {
    return this.breadcrumbs.slice(this.show() - 1, -1);
  }

  protected get afterOverflow() {
    return this.breadcrumbs.slice(-1);
  }

  protected get hasOverflow() {
    return this.breadcrumbs.length > this.show();
  }
}
