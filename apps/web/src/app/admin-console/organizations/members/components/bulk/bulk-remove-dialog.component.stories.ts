import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { DIALOG_DATA } from "@bitwarden/components";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";

import { BulkRemoveDialogComponent } from "./bulk-remove-dialog.component";
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
    hasMasterPassword: true,
  },
];

const mockOrganizationUserApiService = {
  removeManyOrganizationUsers: () =>
    Promise.resolve({
      data: [
        { id: "user-1", error: "" },
        { id: "user-2", error: "" },
        { id: "user-3", error: "" },
      ],
    }),
};

export default {
  title: "Admin Console/Organizations/Members/Bulk Actions/Bulk Remove Dialog",
  component: BulkRemoveDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [BulkRemoveDialogComponent],
      providers: [
        { provide: OrganizationUserApiService, useValue: mockOrganizationUserApiService },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<BulkRemoveDialogComponent>;

/**
 * Before submitting, shows the warning callout and member list.
 */
export const Default: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: { organizationId: "org-1", users: mockUsers },
        },
      ],
    },
    template: `<member-bulk-remove-dialog></member-bulk-remove-dialog>`,
  }),
};

/**
 * When some members have no master password, shows the Details column with a warning icon.
 */
export const WithNoMasterPasswordWarning: Story = {
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
                hasMasterPassword: true,
              },
            ] as BulkUserDetails[],
          },
        },
      ],
    },
    template: `<member-bulk-remove-dialog></member-bulk-remove-dialog>`,
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
          useValue: { organizationId: "org-1", users: [] },
        },
      ],
    },
    template: `<member-bulk-remove-dialog></member-bulk-remove-dialog>`,
  }),
};
