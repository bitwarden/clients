import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { DIALOG_DATA } from "@bitwarden/components";
import { Vfo1TerminologyService } from "@bitwarden/vault";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";
import { DeleteManagedMemberWarningService } from "../../services/delete-managed-member/delete-managed-member-warning.service";

import { BulkDeleteDialogComponent } from "./bulk-delete-dialog.component";
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
    status: OrganizationUserStatusType.Invited,
    hasMasterPassword: false,
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
  deleteManyOrganizationUsers: () =>
    Promise.resolve({
      data: [
        { id: "user-1", error: "" },
        { id: "user-2", error: "" },
        { id: "user-3", error: "User could not be deleted" },
      ],
    }),
};

const mockDeleteManagedMemberWarningService = {
  acknowledgeWarning: () => Promise.resolve(),
};

type StoryArgs = {
  /** Toggles the vfo1-foundation flag - "Collection" copy becomes "Shared folder" copy. */
  vfo1FoundationEnabled: boolean;
};

export default {
  title: "Admin Console/Organizations/Members/Bulk Actions/Bulk Delete Dialog",
  component: BulkDeleteDialogComponent,
  argTypes: {
    vfo1FoundationEnabled: {
      control: "boolean",
      description: 'Toggle the vfo1-foundation flag ("Collection" → "Shared folder" copy).',
      name: "Shared folder terminology (flag on)",
    },
  },
  args: {
    vfo1FoundationEnabled: false,
  },
  decorators: [
    moduleMetadata({
      imports: [BulkDeleteDialogComponent],
      providers: [
        { provide: OrganizationUserApiService, useValue: mockOrganizationUserApiService },
        {
          provide: DeleteManagedMemberWarningService,
          useValue: mockDeleteManagedMemberWarningService,
        },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

/**
 * Before submitting, lists the members to be deleted along with a warning description.
 */
export const Default: Story = {
  render: ({ vfo1FoundationEnabled }) => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: { organizationId: "org-1", users: mockUsers },
        },
        {
          provide: Vfo1TerminologyService,
          useValue: { enabled: () => vfo1FoundationEnabled },
        },
      ],
    },
    template: `<member-bulk-delete-dialog></member-bulk-delete-dialog>`,
  }),
};

/**
 * When the selection is empty, shows the "no applicable members" callout instead of a table.
 */
export const EmptySelection: Story = {
  render: ({ vfo1FoundationEnabled }) => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: { organizationId: "org-1", users: [] },
        },
        {
          provide: Vfo1TerminologyService,
          useValue: { enabled: () => vfo1FoundationEnabled },
        },
      ],
    },
    template: `<member-bulk-delete-dialog></member-bulk-delete-dialog>`,
  }),
};
