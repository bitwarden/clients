import { DialogRef } from "@angular/cdk/dialog";
import { importProvidersFrom } from "@angular/core";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import {
  OrganizationUserStatusType,
  OrganizationUserType,
  RevocationReasonType,
} from "@bitwarden/common/admin-console/enums";
import { PermissionsApi } from "@bitwarden/common/admin-console/models/api/permissions.api";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { Guid, UserId } from "@bitwarden/common/types/guid";
import { DIALOG_DATA } from "@bitwarden/components";

import { PreloadedEnglishI18nModule } from "../../../../../core/tests";
import { SharedModule } from "../../../../../shared/shared.module";
import { OrganizationUserView } from "../../../core/views/organization-user.view";
import { BulkActionResult } from "../../services/member-actions/member-actions.types";

import { BulkReinviteFailureDialogComponent } from "./bulk-reinvite-failure-dialog.component";

function makeUser(id: string, name: string | undefined, email: string): OrganizationUserView {
  return new OrganizationUserView({
    id: id as Guid,
    userId: `${id}-uid` as UserId,
    name,
    email,
    type: OrganizationUserType.User,
    revocationReason: RevocationReasonType.Unknown,
    status: OrganizationUserStatusType.Invited,
    permissions: new PermissionsApi(),
    avatarColor: "",
  });
}

const allUsers: OrganizationUserView[] = [
  makeUser("user-1", "Alice Smith", "alice@example.com"),
  makeUser("user-2", undefined, "bob@example.com"),
  makeUser("user-3", "Carol Jones", "carol@example.com"),
];

const mockDialogRef = {
  close: () => {},
};

const mockEnvironmentService = {
  environment$: of({ isCloud: () => false }),
};

function makeResult(failedIds: string[]): BulkActionResult {
  const result = new BulkActionResult();
  result.failed = failedIds.map((id) => ({ id, error: "Failed to send invitation" }));
  return result;
}

export default {
  title: "Admin Console/Organizations/Members/Bulk Reinvite Failure Dialog",
  component: BulkReinviteFailureDialogComponent,
  decorators: [
    moduleMetadata({
      declarations: [BulkReinviteFailureDialogComponent],
      imports: [SharedModule],
      providers: [
        { provide: DialogRef, useValue: mockDialogRef },
        { provide: EnvironmentService, useValue: mockEnvironmentService },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<BulkReinviteFailureDialogComponent>;

/**
 * When a single invitation fails, shows the singular title with one member in the table.
 */
export const SingleFailure: Story = {
  name: "Single failure",
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            result: makeResult(["user-1"]),
            users: allUsers,
            organization: { id: "org-1", name: "Acme Corp" },
          },
        },
      ],
    },
    template: `<member-bulk-reinvite-failure-dialog></member-bulk-reinvite-failure-dialog>`,
  }),
};

/**
 * When multiple invitations fail, shows the plural title with all failed members in the table.
 */
export const MultipleFailures: Story = {
  name: "Multiple failures",
  render: () => ({
    moduleMetadata: {
      providers: [
        {
          provide: DIALOG_DATA,
          useValue: {
            result: makeResult(["user-1", "user-2", "user-3"]),
            users: allUsers,
            organization: { id: "org-1", name: "Acme Corp" },
          },
        },
      ],
    },
    template: `<member-bulk-reinvite-failure-dialog></member-bulk-reinvite-failure-dialog>`,
  }),
};
