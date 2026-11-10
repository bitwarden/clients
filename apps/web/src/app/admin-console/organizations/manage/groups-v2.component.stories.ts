import { ChangeDetectionStrategy, Component, importProvidersFrom } from "@angular/core";
import { provideRouter, Routes, RouterOutlet, withHashLocation } from "@angular/router";
import { applicationConfig, Decorator, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

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

const routes: Routes = [
  {
    path: "organizations/:organizationId/groups",
    component: GroupsV2Component,
  },
];

/** Renders the story at `url`; hash routing keeps Storybook's own query string intact. */
const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
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
        RouterOutlet,
      ],
      providers: [
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
        provideRouter(routes, withHashLocation()),
      ],
    }),
    atUrl(`/organizations/${ORG_ID}/groups`),
  ],
} as Meta;

type Story = StoryObj<GroupsV2Component>;

const render: Story["render"] = () => ({
  template: `<div bitScrollLayoutHost class="tw-h-screen tw-overflow-auto"><router-outlet></router-outlet></div>`,
});

function withGroups(groups: GroupDetailsView[], loading = false): Decorator {
  return moduleMetadata({
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
  });
}

/** The groups list with a couple of groups, each with different collection access. */
export const Default: Story = {
  render,
  decorators: [withGroups(mockGroups)],
};

/** The table while the initial groups/collections fetch is still in flight. */
export const Loading: Story = {
  render,
  decorators: [withGroups(mockGroups, true)],
};

/** No groups have been created yet — the custom "No groups yet" empty state, not the table's
 * generic "Nothing to show" fallback. */
export const Empty: Story = {
  render,
  decorators: [withGroups([])],
};
