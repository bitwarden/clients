import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { SelectionReadOnlyRequest } from "@bitwarden/common/admin-console/models/request/selection-read-only.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { GroupView } from "../../core";

@Component({
  selector: "app-group-badge",
  templateUrl: "group-name-badge.component.html",
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupNameBadgeComponent {
  readonly selectedGroups = input<SelectionReadOnlyRequest[]>([]);
  readonly allGroups = input<GroupView[]>([]);

  protected readonly groupNames = computed(() => {
    const allGroups = this.allGroups();
    if (!allGroups) {
      return [];
    }

    return this.selectedGroups()
      .map((g) => {
        return allGroups.find((o) => o.id === g.id)?.name;
      })
      .filter((name): name is string => name !== undefined)
      .sort(this.i18nService.collator.compare);
  });

  constructor(private i18nService: I18nService) {}
}
