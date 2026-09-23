import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserService,
} from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA } from "@bitwarden/components";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";

import { BulkRestoreRevokeComponent } from "./bulk-restore-revoke.component";
import { BulkUserDetails } from "./bulk-status.component";

const mockUsers: BulkUserDetails[] = [
  {
    id: "user-1",
    name: "Alice Smith",
    email: "alice@example.com",
    status: OrganizationUserStatusType.Confirmed,
    hasMasterPassword: true,
  },
  {
    id: "user-2",
    name: "",
    email: "bob@example.com",
    status: OrganizationUserStatusType.Confirmed,
    hasMasterPassword: true,
  },
  {
    id: "user-3",
    name: "Carol Jones",
    email: "carol@example.com",
    status: OrganizationUserStatusType.Confirmed,
    hasMasterPassword: false,
  },
];

const mockOrganizationUserApiService = {
  revokeManyOrganizationUsers: () =>
    Promise.resolve({
      data: [
        { id: "user-1", error: "" },
        { id: "user-2", error: "" },
        { id: "user-3", error: "" },
      ],
    }),
};

const mockOrganizationUserService = {
  bulkRestoreUsers: () =>
    of({
      data: [
        { id: "user-1", error: "" },
        { id: "user-2", error: "" },
        { id: "user-3", error: "SSO is required for this organization" },
      ],
    }),
};

const mockAccountService = {
  activeAccount$: of({ id: "user-1" as UserId, email: "alice@example.com" }),
};

const mockOrganizationService = {
  organizations$: () => of([{ id: "org-1" as OrganizationId, name: "Acme Corp" } as Organization]),
};

export default {
  title: "Admin Console/Organizations/Members/Bulk Actions/Bulk Restore Revoke Dialog",
  component: BulkRestoreRevokeComponent,
  decorators: [
    moduleMetadata({
      imports: [BulkRestoreRevokeComponent],
      providers: [
        { provide: OrganizationUserApiService, useValue: mockOrganizationUserApiService },
        { provide: OrganizationUserService, useValue: mockOrganizationUserService },
        { provide: AccountService, useValue: mockAccountService },
        { provide: OrganizationService, useValue: mockOrganizationService },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<BulkRestoreRevokeComponent>;

/**
 * In revoke mode, shows a warning description and a "Revoke Members" action.
 */
export const Revoke: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            organizationId: "org-1",
            users: mockUsers,
            isRevoking: true,
          },
        },
      ],
    },
    template: `<member-bulk-restore-revoke></member-bulk-restore-revoke>`,
  }),
};

/**
 * In restore mode, shows a "Restore Members" action without the revoke warning.
 */
export const Restore: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            organizationId: "org-1",
            users: mockUsers,
            isRevoking: false,
          },
        },
      ],
    },
    template: `<member-bulk-restore-revoke></member-bulk-restore-revoke>`,
  }),
};

/**
 * In restore mode with users who have no master password, shows the Details column warning.
 */
export const RestoreWithNoMasterPasswordWarning: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            organizationId: "org-1",
            users: [
              {
                id: "user-1",
                name: "Alice Smith",
                email: "alice@example.com",
                status: OrganizationUserStatusType.Confirmed,
                hasMasterPassword: false,
              },
              {
                id: "user-2",
                name: "Bob Brown",
                email: "bob@example.com",
                status: OrganizationUserStatusType.Confirmed,
                hasMasterPassword: false,
              },
            ] as BulkUserDetails[],
            isRevoking: false,
          },
        },
      ],
    },
    template: `<member-bulk-restore-revoke></member-bulk-restore-revoke>`,
  }),
};

/**
 * When the selection is empty, shows the "no applicable users" callout.
 */
export const EmptySelection: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            organizationId: "org-1",
            users: [],
            isRevoking: true,
          },
        },
      ],
    },
    template: `<member-bulk-restore-revoke></member-bulk-restore-revoke>`,
  }),
};
