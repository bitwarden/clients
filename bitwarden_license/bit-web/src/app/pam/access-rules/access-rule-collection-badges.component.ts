import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { ChipGroupComponent, ChipGroupItem } from "@bitwarden/components";
import type { CollectionId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * A rule's shared folders as action chips, matching the Shared folders column on All items: the
 * first folder, a "+N" overflow chip, and a popover listing every folder.
 *
 * The chips are read-only here: selecting one does nothing.
 */
@Component({
  selector: "pam-access-rule-collection-badges",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChipGroupComponent, I18nPipe],
  template: `
    @if (chips().length === 0) {
      <span class="tw-text-muted">{{ "pamAccessRuleCollectionsNone" | i18n }}</span>
    } @else {
      <bit-chip-group
        class="tw-block tw-w-full tw-min-w-0"
        [chips]="chips()"
        [accessibleName]="'pamAccessRuleAppliesTo' | i18n"
      />
    }
  `,
})
export class AccessRuleCollectionBadgesComponent {
  readonly collectionIds = input.required<CollectionId[]>();
  readonly collections = input.required<CollectionAdminView[]>();

  /** An id the user can't see falls back to the raw id as its label. */
  protected readonly chips = computed<ChipGroupItem[]>(() => {
    const collections = this.collections();
    return this.collectionIds()
      .map(uuidAsString)
      .map((id) => ({
        id,
        label: collections.find((c) => c.id === id)?.name ?? id,
        variant: "subtle" as const,
        startIcon: "bwi-shared-folder" as const,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });
}
