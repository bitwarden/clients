import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, componentWrapperDecorator, moduleMetadata } from "@storybook/angular";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { I18nMockService } from "@bitwarden/components";

import { VaultScope, VaultScopeType } from "../../models/vault-scope";

import { SharedFolderCardGridComponent } from "./shared-folder-card-grid.component";

const organizationId = "org-1" as OrganizationId;

/** The folder every story drills into — the one whose children the grid renders. */
const PARENT = { id: "departments" as CollectionId, name: "Departments" };

const SCOPE: VaultScope = {
  type: VaultScopeType.Organization,
  organizationId,
  collectionId: PARENT.id,
};

function collection(id: string, name: string): CollectionView {
  return new CollectionView({ id: id as CollectionId, organizationId, name });
}

/**
 * The folder in view and its children, flat and nested by name — the shape the collection services
 * hold, which the grid resolves into a tree of its own. Cards come out sorted by name rather than
 * in the order given here.
 */
function childFolders(names: string[]): CollectionView[] {
  return [
    collection(PARENT.id, PARENT.name),
    ...names.map((name, i) => collection(`folder-${i}`, `${PARENT.name}/${name}`)),
  ];
}

const DEFAULT_FOLDERS = childFolders([
  "Engineering",
  "Design",
  "Marketing",
  "Finance",
  "People Ops",
]);

/**
 * Fourteen children — more than the three rows on show hold at any width, so the rest always
 * collapse behind the trigger: five of them at three columns, eight at two, eleven at one.
 */
const MANY_FOLDERS = childFolders([
  "Engineering",
  "Design",
  "Marketing",
  "Finance",
  "People Ops",
  "Legal",
  "Support",
  "Sales",
  "Security",
  "Infrastructure",
  "Data Platform",
  "Mobile",
  "Partnerships",
  "Research",
]);

/**
 * Narrow enough to drop the grid to two columns, and to one: below 744px each track bottoms out at
 * 240px, so the container fits `floor((width + 12px) / 252px)` of them — two from 492px to 744px,
 * one below that. `tw-max-w-xl` is 576px and `tw-max-w-sm` 384px.
 */
const NARROW_WRAPPER = "tw-max-w-xl";
const NARROWEST_WRAPPER = "tw-max-w-sm";

const LONG_NAME_FOLDERS = childFolders([
  "Engineering — Platform, Infrastructure, and Developer Experience",
  "Design — Brand, Product, and Marketing Systems",
  "A folder name with no spaces atallwhichcannotwrapanywhere",
]);

export default {
  title: "Vault/Shared Folder Card Grid",
  component: SharedFolderCardGridComponent,
  decorators: [
    moduleMetadata({
      imports: [RouterTestingModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              sharedFolders: "Shared folders",
              sharedFoldersInParent: (name) => `Shared folders in ${name}`,
              sharedFolderCount: (count) => `${count} shared folders`,
              sharedFolderSingular: (count) => `${count} shared folder`,
              moreSharedFoldersShownAbove: (count) =>
                `${count} more shared folders shown above this button`,
              moreSharedFoldersShownAboveSingular: `1 more shared folder shown above this button`,
              showAll: "Show all",
              showLess: "Show less",
            }),
        },
      ],
    }),
    componentWrapperDecorator((story) => `<div class="tw-max-w-5xl">${story}</div>`),
  ],
  args: {
    collections: DEFAULT_FOLDERS,
    scope: SCOPE,
  },
} as Meta<SharedFolderCardGridComponent>;

/**
 * Both the accordion's open state and the overflow's are the component's own, but each takes its
 * starting value from an input — so a story renders the state it documents on its first frame
 * rather than painting a default and then clicking its way out of it.
 */
type Story = StoryObj<SharedFolderCardGridComponent>;

/** Five children — one full row of three plus a partial row, no overflow. */
export const Default: Story = {};

export const SingleChild: Story = {
  args: {
    collections: childFolders(["Engineering"]),
  },
};

/** Renders nothing at all, so the host needs no `@if` of its own. */
export const NoChildren: Story = {
  args: {
    collections: childFolders([]),
  },
};

export const ManyChildrenCollapsed: Story = {
  args: {
    collections: MANY_FOLDERS,
  },
};

export const ManyChildrenExpanded: Story = {
  args: {
    collections: MANY_FOLDERS,
    initiallyExpanded: true,
  },
};

/**
 * The section closed — the header stays readable, count and all, with every card hidden behind it.
 * Users can still open it from the header; only the starting state differs.
 */
export const AccordionCollapsed: Story = {
  args: {
    collections: MANY_FOLDERS,
    open: false,
  },
};

/**
 * Two columns, so three rows are six cards rather than nine — the cutoff follows the width instead
 * of leaving the same nine cards to spill over five rows.
 */
export const NarrowContainerCollapsed: Story = {
  decorators: [
    componentWrapperDecorator((story) => `<div class="${NARROW_WRAPPER}">${story}</div>`),
  ],
  args: {
    collections: MANY_FOLDERS,
  },
};

/**
 * The same two-column grid expanded. The revealed cards join the grid that is already there instead
 * of forming a second one beneath it, so they carry on from the seventh slot rather than restarting
 * at a column of their own.
 */
export const NarrowContainerExpanded: Story = {
  decorators: [
    componentWrapperDecorator((story) => `<div class="${NARROW_WRAPPER}">${story}</div>`),
  ],
  args: {
    collections: MANY_FOLDERS,
    initiallyExpanded: true,
  },
};

/** One column, the narrowest the grid goes — three rows are three cards, and the rest collapse. */
export const SingleColumnCollapsed: Story = {
  decorators: [
    componentWrapperDecorator((story) => `<div class="${NARROWEST_WRAPPER}">${story}</div>`),
  ],
  args: {
    collections: MANY_FOLDERS,
  },
};

/** Names truncate rather than blowing out the track width. */
export const LongNames: Story = {
  args: {
    collections: LONG_NAME_FOLDERS,
  },
};

export const Rtl: Story = {
  decorators: [componentWrapperDecorator((story) => `<div dir="rtl">${story}</div>`)],
  args: {
    collections: MANY_FOLDERS,
  },
};
