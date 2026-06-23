import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import {
  OrganizationUserApiService,
  OrganizationUserService,
} from "@bitwarden/admin-console/common";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";

import { BulkConfirmDialogComponent } from "./bulk-confirm-dialog.component";
import { BulkUserDetails } from "./bulk-status.component";

const mockOrg = {
  id: "org-1" as OrganizationId,
  name: "Acme Corp",
  permissions: new PermissionsApi(),
} as Organization;

const mockUsers: BulkUserDetails[] = [
  {
    id: "user-1",
    name: "Alice Smith",
    email: "alice@example.com",
    status: OrganizationUserStatusType.Accepted,
    hasMasterPassword: true,
  },
  {
    id: "user-2",
    name: "Carol Jones",
    email: "carol@example.com",
    status: OrganizationUserStatusType.Accepted,
    hasMasterPassword: true,
  },
];

const invitedUser: BulkUserDetails = {
  id: "user-3",
  name: null,
  email: "bob@example.com",
  status: OrganizationUserStatusType.Invited,
  hasMasterPassword: false,
};

const mockAccountService = {
  activeAccount$: of({ id: "user-1" as UserId, email: "alice@example.com" }),
};

const mockKeyService = {
  orgKeys$: () => of({ "org-1": {} }),
  getFingerprint: () => Promise.resolve(["apple", "mango", "orange", "lemon", "grape"]),
};

const mockEncryptService = {
  encapsulateKeyUnsigned: () => Promise.resolve({ encryptedString: "2.encrypted-key-data==" }),
};

const mockOrganizationUserApiService = {
  postOrganizationUsersPublicKey: () =>
    Promise.resolve({
      data: [
        { id: "user-1", userId: "user-1", key: btoa("fake-public-key-1") },
        { id: "user-2", userId: "user-2", key: btoa("fake-public-key-2") },
      ],
    }),
};

const mockOrganizationUserService = {
  bulkConfirmUsers: () =>
    of({
      data: [
        { id: "user-1", error: "" },
        { id: "user-2", error: "" },
      ],
    }),
};

export default {
  title: "Admin Console/Organizations/Members/Bulk Confirm Dialog",
  component: BulkConfirmDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [BulkConfirmDialogComponent],
      providers: [
        { provide: AccountService, useValue: mockAccountService },
        { provide: KeyService, useValue: mockKeyService },
        { provide: EncryptService, useValue: mockEncryptService },
        { provide: OrganizationUserApiService, useValue: mockOrganizationUserApiService },
        { provide: OrganizationUserService, useValue: mockOrganizationUserService },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<BulkConfirmDialogComponent>;

/**
 * Pre-confirm state — shows fingerprints for accepted members and "not applicable" for non-accepted.
 */
export const WithFingerprints: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            organization: mockOrg,
            users: mockUsers,
          },
        },
      ],
    },
    template: `<member-bulk-comfirm-dialog></member-bulk-comfirm-dialog>`,
  }),
};

/**
 * Mixed accepted/non-accepted users — accepted users show fingerprints, invited user is excluded.
 */
export const WithMixedStatuses: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            organization: mockOrg,
            users: [...mockUsers, invitedUser],
          },
        },
      ],
    },
    template: `<member-bulk-comfirm-dialog></member-bulk-comfirm-dialog>`,
  }),
};

/**
 * No accepted users — shows the "no applicable users" callout immediately.
 */
export const NoAcceptedUsers: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            organization: mockOrg,
            users: [invitedUser],
          },
        },
      ],
    },
    template: `<member-bulk-comfirm-dialog></member-bulk-comfirm-dialog>`,
  }),
};
