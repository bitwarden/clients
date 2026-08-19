import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { BadgeModule } from "@bitwarden/components";
import type { CollectionId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";

import { resolveCollectionNames } from "..";

/**
 * Renders the collections a rule governs as one grouped count badge, resolving the rule's
 * collection ids against the org's loaded collections. The resolved names ride along as
 * the badge's tooltip, so the detail stays reachable without widening the column. Shows a
 * muted placeholder when the rule targets none.
 */
@Component({
  selector: "pam-access-rule-collection-badges",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeModule, I18nPipe],
  template: `
    @if (names().length === 0) {
      <span class="tw-text-muted">{{ "pamAccessRuleCollectionsNone" | i18n }}</span>
    } @else {
      <span bitBadge variant="primary" startIcon="bwi-collection-shared" [title]="tooltip()">{{
        label()
      }}</span>
    }
  `,
})
export class AccessRuleCollectionBadgesComponent {
  readonly collectionIds = input.required<CollectionId[]>();
  readonly collections = input.required<CollectionAdminView[]>();

  private readonly i18nService = inject(I18nService);

  protected readonly names = computed(() =>
    resolveCollectionNames(this.collectionIds().map(uuidAsString), this.collections()),
  );

  protected readonly label = computed(() => {
    const count = this.names().length;
    return count === 1
      ? this.i18nService.t("pamAccessRuleCollectionCountSingular")
      : this.i18nService.t("pamAccessRuleCollectionCount", count);
  });

  protected readonly tooltip = computed(() => this.names().join(", "));
}
