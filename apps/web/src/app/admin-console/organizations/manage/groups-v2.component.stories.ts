import { ChangeDetectionStrategy, Component, importProvidersFrom } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";
import { getAllByRole, getByRole, userEvent } from "storybook/test";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  IconModule,
  ScrollLayoutDirective,
  ScrollLayoutHostDirective,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { Vfo1I18nPipe, Vfo1IconPipe } from "@bitwarden/vault";

import { PreloadedEnglishI18nModule } from "../../../core/tests";
import { InternalGroupApiService } from "../core";
import { GroupDetailsView } from "../core/views/group-details.view";
import { SharedOrganizationModule } from "../shared";

import { GroupsV2Component } from "./groups-v2.component";

/**
 * The real `app-header` (`WebHeaderComponent`) pulls in `<app-product-switcher>` and
 * `<app-account-menu>`, which depend on many app-wide services that aren't worth stubbing out
 * for this story. Stub it out instead, matching the pattern in
 * `groups.component.stories.ts` / `vault-header.component.stories.ts`.
 */
@Component({
  selector: "app-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class StubHeaderComponent {}

const ORG_ID = "org-1" as OrganizationId;
const USER_ID = "user-1" as UserId;

const mockCollections: CollectionView[] = [
  new CollectionView({ id: "col-1" as CollectionId, organizationId: ORG_ID, name: "Engineering" }),
  new CollectionView({ id: "col-2" as CollectionId, organizationId: ORG_ID, name: "Design" }),
];

const mockGroups: GroupDetailsView[] = [
  new GroupDetailsView({
    id: "group-1",
    organizationId: ORG_ID,
    name: "Engineering Team",
    collections: [{ id: "col-1", readOnly: false, hidePasswords: false, manage: true }],
  }),
  new GroupDetailsView({
    id: "group-2",
    organizationId: ORG_ID,
    name: "Design Team",
    collections: [
      { id: "col-1", readOnly: true, hidePasswords: false, manage: false },
      { id: "col-2", readOnly: false, hidePasswords: false, manage: true },
    ],
  }),
];

const mockApiService = {
  getCollections: () => Promise.resolve({ data: [] }),
};

const mockCollectionService = {
  decryptMany$: () => of(mockCollections),
};

const mockKeyService = {
  orgKeys$: () => of({}),
};

const mockAccountService = {
  activeAccount$: of({ id: USER_ID, email: "alice@example.com" }),
};

const mockOrganizationService = {
  organizations$: () => of([{ id: ORG_ID, name: "Acme Inc" }]),
};

const mockToastService = { showToast: () => {} };
const mockLogService = { error: () => {} };

const mockActivatedRoute = {
  params: of({ organizationId: ORG_ID }),
  queryParams: of({}),
  data: of({}),
};

function makeGroupService(groups: GroupDetailsView[]) {
  return {
    getAllDetails: () => Promise.resolve(groups),
    delete: () => Promise.resolve(),
    deleteMany: () => Promise.resolve(),
  };
}

export default {
  title: "Admin Console/Organizations/Groups/Groups List V2",
  component: GroupsV2Component,
  decorators: [
    moduleMetadata({
      imports: [
        SharedOrganizationModule,
        StubHeaderComponent,
        ScrollLayoutDirective,
        ScrollLayoutHostDirective,
        IconModule,
        Vfo1IconPipe,
        Vfo1I18nPipe,
        GroupsV2Component,
      ],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: ApiService, useValue: mockApiService },
        { provide: CollectionService, useValue: mockCollectionService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: ToastService, useValue: mockToastService },
        { provide: LogService, useValue: mockLogService },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        // Vfo1TerminologyService is `providedIn: "root"`, so its ConfigService dependency must be
        // overridden at the application root rather than in the story's moduleMetadata child
        // injector, which Vfo1TerminologyService can't see. Defaulted off; stories don't need it on.
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<GroupsV2Component>;

function makeRender(groups: GroupDetailsView[], loading = false): Story["render"] {
  return () => ({
    moduleMetadata: {
      providers: [
        {
          provide: InternalGroupApiService,
          useValue: loading
            ? { getAllDetails: () => new Promise(() => {}) } // never resolves — stays in the loading state
            : makeGroupService(groups),
        },
        // DialogService is intentionally left unmocked (unlike groups.component.stories.ts) so
        // the delete-confirmation stories can drive and render the actual dialog via `play`.
      ],
    },
    template: `<div bitScrollLayoutHost class="tw-h-screen tw-overflow-auto"><app-groups-v2></app-groups-v2></div>`,
  });
}

/** The groups list with a couple of groups, each with different collection access. */
export const Default: Story = {
  render: makeRender(mockGroups),
};

/** The table while the initial groups/collections fetch is still in flight. */
export const Loading: Story = {
  render: makeRender(mockGroups, true),
};

/** No groups have been created yet — the custom "No groups yet" empty state, not the table's
 * generic "Nothing to show" fallback. */
export const Empty: Story = {
  render: makeRender([]),
};

/** Deleting a single group from its row options menu — shows the real "Delete group"
 * confirmation dialog, opened via its actual trigger path (row menu → Delete). */
export const DeleteConfirmationSingle: Story = {
  render: makeRender(mockGroups),
  play: async ({ canvasElement }) => {
    const optionsButton = getAllByRole(canvasElement, "button", { name: "Options" })[0];
    await userEvent.click(optionsButton);

    const deleteItem = await getByRole(document.body, "menuitem", { name: "Delete" });
    await userEvent.click(deleteItem);
  },
};

/** Bulk-deleting the current selection via the bulk-actions bar — shows the real
 * "Delete N groups" confirmation dialog, opened via its actual trigger path (select rows →
 * bulk-actions bar → Delete). */
export const DeleteConfirmationBulk: Story = {
  render: makeRender(mockGroups),
  play: async ({ canvasElement }) => {
    const selectRow = getAllByRole(canvasElement, "checkbox", { name: "Select row" });
    for (const checkbox of selectRow) {
      await userEvent.click(checkbox);
    }

    const deleteButton = await getByRole(document.body, "button", { name: "Delete" });
    await userEvent.click(deleteButton);
  },
};
