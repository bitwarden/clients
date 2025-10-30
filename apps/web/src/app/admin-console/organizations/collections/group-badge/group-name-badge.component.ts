// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnChanges } from "@angular/core";

import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { GroupView } from "../../core";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-group-badge",
  templateUrl: "group-name-badge.component.html",
  standalone: false,
})
export class GroupNameBadgeComponent implements OnChanges {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() selectedGroups: SelectionReadOnlyRequest[];
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() allGroups: GroupView[];

  protected groupNames: string[] = [];

  constructor(private i18nService: I18nService) {}

  ngOnChanges() {
    this.groupNames = this.selectedGroups
      .map((g) => {
        return this.allGroups.find((o) => o.id === g.id)?.name;
      })
      .sort(this.i18nService.collator.compare);
  }
}
