import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DIALOG_DATA } from "@bitwarden/components";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";
import { OrganizationUserView } from "../../../core/views/organization-user.view";

import { BulkStatusComponent } from "./bulk-status.component";

const mockUsers = [
  {
    id: "user-1",
    name: "Alice Smith",
    email: "alice@example.com",
    status: OrganizationUserStatusType.Confirmed,
  },
  {
    id: "user-2",
    name: null,
    email: "bob@example.com",
    status: OrganizationUserStatusType.Confirmed,
  },
  {
    id: "user-3",
    name: "Carol Jones",
    email: "carol@example.com",
    status: OrganizationUserStatusType.Confirmed,
  },
] as OrganizationUserView[];

const mockLogService = {
  error: () => {},
};

export default {
  title: "Admin Console/Organizations/Members/Bulk Actions/Bulk Status Dialog",
  component: BulkStatusComponent,
  decorators: [
    moduleMetadata({
      imports: [BulkStatusComponent],
      providers: [{ provide: LogService, useValue: mockLogService }],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<BulkStatusComponent>;

/**
 * All operations succeeded and every member shows the success message.
 */
export const AllSucceeded: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            users: mockUsers,
            filteredUsers: mockUsers,
            request: Promise.resolve([
              { id: "user-1", error: "" },
              { id: "user-2", error: "" },
              { id: "user-3", error: "" },
            ]),
            successfulMessage: "Operation completed successfully",
          },
        },
      ],
    },
    template: `<member-bulk-status></member-bulk-status>`,
  }),
};

/**
 * Some members succeeded and some encountered errors.
 */
export const MixedResults: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            users: mockUsers,
            filteredUsers: mockUsers,
            request: Promise.resolve([
              { id: "user-1", error: "" },
              { id: "user-2", error: "User not found" },
              { id: "user-3", error: "SSO is required for this organization" },
            ]),
            successfulMessage: "Operation completed successfully",
          },
        },
      ],
    },
    template: `<member-bulk-status></member-bulk-status>`,
  }),
};

/**
 * Some users were skipped because they were not in filteredUsers, so they show the filtered message.
 */
export const WithFilteredUsers: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            users: mockUsers,
            filteredUsers: [mockUsers[0]],
            request: Promise.resolve([{ id: "user-1", error: "" }]),
            successfulMessage: "Operation completed successfully",
          },
        },
      ],
    },
    template: `<member-bulk-status></member-bulk-status>`,
  }),
};
