import { signal } from "@angular/core";
import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, componentWrapperDecorator, moduleMetadata } from "@storybook/angular";
import { BehaviorSubject } from "rxjs";
import { getByRole, userEvent } from "storybook/test";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { BitwardenIcon, I18nMockService } from "@bitwarden/components";

import { RoutedVaultFilterModel } from "../../models/routed-vault-filter.model";
import { RoutedVaultFilterService } from "../../services/routed-vault-filter.service";
import { Vfo1TerminologyService } from "../../services/vfo1-terminology.service";

import { SharedFolderCardGridComponent } from "./shared-folder-card-grid.component";

function folderNode(name: string, id = name): TreeNode<CollectionView> {
  const collection = new CollectionView({
    id: id as CollectionId,
    organizationId: "org-1" as OrganizationId,
    name,
  });

  return new TreeNode(collection, undefined as unknown as TreeNode<CollectionView>);
}

function folderNodes(names: string[]): TreeNode<CollectionView>[] {
  return names.map((name, i) => folderNode(name, `folder-${i}`));
}

const DEFAULT_FOLDERS = folderNodes([
  "Engineering",
  "Design",
  "Marketing",
  "Finance",
  "People Ops",
]);

/** Fourteen children — nine fill the first three rows, five collapse behind the trigger. */
const MANY_FOLDERS = folderNodes([
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

const LONG_NAME_FOLDERS = folderNodes([
  "Engineering — Platform, Infrastructure, and Developer Experience",
  "Design — Brand, Product, and Marketing Systems",
  "A folder name with no spaces atallwhichcannotwrapanywhere",
]);

/**
 * The terminology mock is swapped per story. `Vfo1TerminologyService.enabled` is a signal, so the
 * mock exposes one too, and derives its icon mapping from it exactly as the real service does.
 */
function terminologyProvider(enabled: boolean) {
  const enabledSignal = signal(enabled);

  return {
    provide: Vfo1TerminologyService,
    useValue: {
      enabled: enabledSignal,
      iconClass: (icon: BitwardenIcon): BitwardenIcon =>
        enabledSignal() ? "bwi-shared-folder" : icon,
    },
  };
}

export default {
  title: "Vault/Shared Folder Card Grid",
  component: SharedFolderCardGridComponent,
  decorators: [
    moduleMetadata({
      imports: [RouterTestingModule],
      providers: [
        terminologyProvider(false),
        {
          provide: RoutedVaultFilterService,
          useValue: {
            filter$: new BehaviorSubject<RoutedVaultFilterModel>({}),
            createRoute: (filter: RoutedVaultFilterModel) => [
              ["/vault"],
              {
                queryParams: { sharedFolderId: filter.collectionId ?? null },
                queryParamsHandling: "merge",
              },
            ],
          },
        },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              collections: "Collections",
              sharedFolders: "Shared folders",
              collectionsInParent: (name) => `Collections in ${name}`,
              sharedFoldersInParent: (name) => `Shared folders in ${name}`,
              collectionCount: (count) => `${count} collections`,
              sharedFolderCount: (count) => `${count} shared folders`,
              moreCollectionsShownAbove: (count) =>
                `${count} more collections shown above this button`,
              moreSharedFoldersShownAbove: (count) =>
                `${count} more shared folders shown above this button`,
              showAll: "Show all",
              showLess: "Show less",
            }),
        },
      ],
    }),
    componentWrapperDecorator((story) => `<div class="tw-max-w-5xl">${story}</div>`),
  ],
  args: {
    folders: DEFAULT_FOLDERS,
    parentName: "Departments",
  },
} as Meta<SharedFolderCardGridComponent>;

type Story = StoryObj<SharedFolderCardGridComponent>;

/** Five children — one full row of three plus a partial row, no overflow. */
export const Default: Story = {};

export const SingleChild: Story = {
  args: {
    folders: folderNodes(["Engineering"]),
  },
};

/** Renders nothing at all, so the host needs no `@if` of its own. */
export const NoChildren: Story = {
  args: {
    folders: [],
  },
};

export const ManyChildrenCollapsed: Story = {
  args: {
    folders: MANY_FOLDERS,
  },
};

export const ManyChildrenExpanded: Story = {
  args: {
    folders: MANY_FOLDERS,
  },
  play: async (context) => {
    const trigger = getByRole(context.canvasElement, "button", { name: "Show all" });
    await userEvent.click(trigger);
  },
};

/** Names truncate rather than blowing out the track width. */
export const LongNames: Story = {
  args: {
    folders: LONG_NAME_FOLDERS,
  },
};

export const TerminologyFlagOn: Story = {
  decorators: [
    moduleMetadata({
      providers: [terminologyProvider(true)],
    }),
  ],
  args: {
    folders: MANY_FOLDERS,
  },
};

export const Rtl: Story = {
  decorators: [
    moduleMetadata({
      providers: [terminologyProvider(true)],
    }),
    componentWrapperDecorator((story) => `<div dir="rtl">${story}</div>`),
  ],
  args: {
    folders: MANY_FOLDERS,
  },
};
