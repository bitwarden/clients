import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";
import type { CollectionId } from "@bitwarden/sdk-internal";

import { AccessRuleCollectionBadgesComponent } from "./access-rule-collection-badges.component";

/** A minimal collection stand-in — the component only reads `id` and `name`. */
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

/** A single governed collection. */
export const Single: Story = {
  args: { collectionIds: ids("col-1") },
};

/** A handful of collections, all shown. */
export const Multiple: Story = {
  args: { collectionIds: ids("col-1", "col-2", "col-3") },
};

/** More than `MAX_VISIBLE_COLLECTIONS` — the rest collapse into a "+N more" badge. */
export const Overflow: Story = {
  args: { collectionIds: ids("col-1", "col-2", "col-3", "col-4", "col-5") },
};

/** No collections targeted — a muted placeholder is shown instead of badges. */
export const None: Story = {
  args: { collectionIds: ids() },
};

/** An id with no matching loaded collection (e.g. one the user can't see) falls back to the raw id. */
export const UnresolvedCollection: Story = {
  args: { collectionIds: ids("col-1", "col-unknown") },
};
