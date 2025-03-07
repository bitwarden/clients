// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnChanges } from "@angular/core";

import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { GroupView } from "../../core";

@Component({
  selector: "app-group-badge",
  templateUrl: "group-name-badge.component.html",
})
export class GroupNameBadgeComponent implements OnChanges {
  @Input() selectedGroups: SelectionReadOnlyRequest[];
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
