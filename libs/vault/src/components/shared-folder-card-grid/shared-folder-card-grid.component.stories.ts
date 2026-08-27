import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, componentWrapperDecorator, moduleMetadata } from "@storybook/angular";
import { getByRole, userEvent } from "storybook/test";

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

/** Fourteen children — nine fill the first three rows, five collapse behind the trigger. */
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
 * Narrow enough to drop the grid to two columns: below 744px each track bottoms out at 240px, so the
 * container fits `floor((width + 24px) / 264px)` of them — two anywhere from 504px to 744px.
 */
const NARROW_WRAPPER = "tw-max-w-xl";

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

type Story = StoryObj<SharedFolderCardGridComponent>;

/**
 * Reveals the cards held behind the trigger. Both the accordion's open state and the overflow's live
 * inside the component, so stories reach them by driving the same controls a user would — which means
 * a story paints in its default state for a frame before its play function lands.
 */
const expandOverflow: Story["play"] = async (context) => {
  const trigger = getByRole(context.canvasElement, "button", { name: "Show all" });
  await userEvent.click(trigger);
};

/** Collapses the whole section by clicking the accordion's own header. */
const collapseAccordion: Story["play"] = async (context) => {
  const header = getByRole(context.canvasElement, "button", { name: /in Departments/ });
  await userEvent.click(header);
};

/**
 * Docs pages skip play functions by default, which would leave every story driven by one above
 * showing its default state — the exact opposite of what it is there to document. Stories with a
 * play function opt into running it inline on the docs page too.
 */
const autoplayInDocs: Story["parameters"] = {
  docs: {
    story: {
      autoplay: true,
    },
  },
};

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
  },
  play: expandOverflow,
  parameters: autoplayInDocs,
};

/**
 * The section closed. `bit-accordion` opens by default, so this collapses it the way a user would —
 * the header stays readable, count and all, with every card hidden behind it.
 */
export const AccordionCollapsed: Story = {
  args: {
    collections: MANY_FOLDERS,
  },
  play: collapseAccordion,
  parameters: autoplayInDocs,
};

/**
 * Two columns, so the nine collapsed cards span five rows and the last one sits alone — the slot
 * beside it is empty while the grid is collapsed.
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
 * The same two-column grid expanded. The tenth card fills the empty slot left beside the ninth
 * rather than starting a row of its own, because the revealed cards join the grid that is already
 * there instead of forming a second one beneath it.
 */
export const NarrowContainerExpanded: Story = {
  decorators: [
    componentWrapperDecorator((story) => `<div class="${NARROW_WRAPPER}">${story}</div>`),
  ],
  args: {
    collections: MANY_FOLDERS,
  },
  play: expandOverflow,
  parameters: autoplayInDocs,
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
