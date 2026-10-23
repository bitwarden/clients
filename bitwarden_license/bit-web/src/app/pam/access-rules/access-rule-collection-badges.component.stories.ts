import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";
import type { CollectionId } from "@bitwarden/sdk-internal";

import { AccessRuleCollectionBadgesComponent } from "./access-rule-collection-badges.component";

/** The component reads only `id` and `name`. */
function collection(id: string, name: string): CollectionAdminView {
  return { id, name } as CollectionAdminView;
}

const collections = [
  collection("col-1", "Engineering"),
  collection("col-2", "Finance"),
  collection("col-3", "Marketing"),
  collection("col-4", "Legal"),
  collection("col-5", "Operations"),
];

const ids = (...values: string[]): CollectionId[] => values as unknown as CollectionId[];

export default {
  title: "Web/PAM/Access Rule Collection Badges",
  component: AccessRuleCollectionBadgesComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              pamAccessRuleCollectionsNone: "Unassigned",
              pamAccessRuleCollectionCountSingular: "1 collection",
              pamAccessRuleCollectionCount: (count) => `${count} collections`,
            }),
        },
      ],
    }),
  ],
  args: {
    collections,
    collectionIds: ids("col-1", "col-2"),
  },
} as Meta<AccessRuleCollectionBadgesComponent>;

type Story = StoryObj<AccessRuleCollectionBadgesComponent>;

export const Single: Story = {
  args: { collectionIds: ids("col-1") },
};

export const Multiple: Story = {
  args: { collectionIds: ids("col-1", "col-2", "col-3") },
};

/** The count badge keeps the column width flat. */
export const Many: Story = {
  args: { collectionIds: ids("col-1", "col-2", "col-3", "col-4", "col-5") },
};

/** A muted placeholder replaces the badge. */
export const None: Story = {
  args: { collectionIds: ids() },
};

/** An id the user can't see falls back to the raw id. */
export const UnresolvedCollection: Story = {
  args: { collectionIds: ids("col-1", "col-unknown") },
};
