import { ScrollingModule } from "@angular/cdk/scrolling";
import { ChangeDetectionStrategy, Component, importProvidersFrom } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  DialogService,
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

import { GroupsComponent } from "./groups.component";

/**
 * The real `app-header` (`WebHeaderComponent`) pulls in `<app-product-switcher>` and
 * `<app-account-menu>`, which depend on many app-wide services that aren't worth stubbing out
 * for this story. Stub it out instead, matching the pattern in
 * `vault-header.component.stories.ts`.
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

const mockDialogService = {
  open: () => ({ closed: of(undefined) }),
  openSimpleDialog: () => Promise.resolve(false),
};

const mockToastService = { showToast: () => {} };
const mockLogService = { error: () => {} };

const mockActivatedRoute = {
  params: of({ organizationId: ORG_ID }),
  queryParams: of({}),
};

function makeGroupService(groups: GroupDetailsView[]) {
  return {
    getAllDetails: () => Promise.resolve(groups),
    delete: () => Promise.resolve(),
    deleteMany: () => Promise.resolve(),
  };
}

export default {
  title: "Admin Console/Organizations/Groups/Groups List",
  component: GroupsComponent,
  decorators: [
    moduleMetadata({
      declarations: [GroupsComponent],
      imports: [
        SharedOrganizationModule,
        StubHeaderComponent,
        ScrollingModule,
        ScrollLayoutDirective,
        ScrollLayoutHostDirective,
        IconModule,
        Vfo1IconPipe,
        Vfo1I18nPipe,
      ],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: ApiService, useValue: mockApiService },
        { provide: CollectionService, useValue: mockCollectionService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: DialogService, useValue: mockDialogService },
        { provide: ToastService, useValue: mockToastService },
        { provide: LogService, useValue: mockLogService },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<GroupsComponent>;

function makeRender(groups: GroupDetailsView[], vfo1Enabled = false): Story["render"] {
  return () => ({
    // Vfo1TerminologyService is `providedIn: "root"`, so its ConfigService dependency must be
    // overridden at the application root (applicationConfig) rather than in the story's
    // moduleMetadata child injector, which Vfo1TerminologyService can't see.
    // Other stories rely on the global feature-flag toolbar (see .storybook/preview.tsx) for
    // their ConfigService. Only force it here to guarantee the "Vfo1Enabled" story always
    // renders with the flag on, regardless of the toolbar.
    ...(vfo1Enabled
      ? {
          applicationConfig: {
            providers: [{ provide: ConfigService, useValue: { getFeatureFlag$: () => of(true) } }],
          },
        }
      : {}),
    moduleMetadata: {
      providers: [{ provide: InternalGroupApiService, useValue: makeGroupService(groups) }],
    },
    template: `<div bitScrollLayoutHost class="tw-h-screen tw-overflow-auto"><app-groups></app-groups></div>`,
  });
}

/** The groups list with a couple of groups, each with different collection access. */
export const Default: Story = {
  render: makeRender(mockGroups),
};

/** No groups have been created yet. */
export const Empty: Story = {
  render: makeRender([]),
};

/**
 * The groups list with the VFO1 terminology flag on — the "Collections" column header and the
 * row menu's "Collections" item render "Shared folders" instead.
 */
export const Vfo1Enabled: Story = {
  render: makeRender(mockGroups, true),
};
