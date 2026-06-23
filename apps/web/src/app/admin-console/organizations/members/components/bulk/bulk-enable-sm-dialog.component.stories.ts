import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import {
  OrganizationUserStatusType,
  OrganizationUserType,
} from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { Guid, UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA, DialogRef, ToastService } from "@bitwarden/components";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";
import { OrganizationUserView } from "../../../core/views/organization-user.view";

import { BulkEnableSecretsManagerDialogComponent } from "./bulk-enable-sm-dialog.component";

function makeUser(
  id: string,
  name: string | null,
  email: string,
  type: OrganizationUserType,
): OrganizationUserView {
  return new OrganizationUserView({
    id: id as Guid,
    userId: `${id}-uid` as UserId,
    name: name ?? "",
    email,
    type,
    revocationReason: null,
    status: OrganizationUserStatusType.Confirmed,
    permissions: new PermissionsApi(),
    avatarColor: null,
  });
}

const mockUsers: OrganizationUserView[] = [
  makeUser("user-1", "Alice Smith", "alice@example.com", OrganizationUserType.User),
  makeUser("user-2", null, "bob@example.com", OrganizationUserType.Admin),
  makeUser("user-3", "Carol Jones", "carol@example.com", OrganizationUserType.Custom),
];

const mockOrganizationUserApiService = {
  putOrganizationUserBulkEnableSecretsManager: () => Promise.resolve(),
};

const mockToastService = {
  showToast: () => {},
};

const mockDialogRef = {
  close: () => {},
};

export default {
  title: "Admin Console/Organizations/Members/Bulk Enable Secrets Manager Dialog",
  component: BulkEnableSecretsManagerDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [BulkEnableSecretsManagerDialogComponent],
      providers: [
        { provide: OrganizationUserApiService, useValue: mockOrganizationUserApiService },
        { provide: ToastService, useValue: mockToastService },
        { provide: DialogRef, useValue: mockDialogRef },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<BulkEnableSecretsManagerDialogComponent>;

/**
 * Default state — lists members who will have Secrets Manager access enabled.
 */
export const Default: Story = {
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: { orgId: "org-1", users: mockUsers },
        },
      ],
    },
    template: `<member-bulk-enable-sm-dialog></member-bulk-enable-sm-dialog>`,
  }),
};
