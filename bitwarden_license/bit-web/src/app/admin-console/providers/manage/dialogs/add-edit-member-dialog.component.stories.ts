import { CommonModule } from "@angular/common";
import { importProvidersFrom } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { applicationConfig, Meta, StoryObj } from "@storybook/angular";
import { action } from "storybook/actions";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProviderUserType } from "@bitwarden/common/admin-console/enums";
import { ProviderUserUserDetailsResponse } from "@bitwarden/common/admin-console/models/response/provider/provider-user.response";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  RadioButtonModule,
  ToastService,
} from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import {
  AddEditMemberDialogComponent,
  AddEditMemberDialogParams,
} from "./add-edit-member-dialog.component";

const PROVIDER_ID = "provider-story-1";

const mockUser = new ProviderUserUserDetailsResponse({
  Id: "provider-user-1",
  UserId: "user-1",
  Name: "Alice Smith",
  Email: "alice@example.com",
  Type: ProviderUserType.ServiceUser,
});

const mockApiService: Partial<ApiService> = {
  postProviderUserInvite: async () => undefined,
  putProviderUser: async () => undefined,
  deleteProviderUser: async () => undefined,
};

function storyMeta(dialogParams: AddEditMemberDialogParams) {
  return {
    moduleMetadata: {
      declarations: [AddEditMemberDialogComponent],
      imports: [
        CommonModule,
        ReactiveFormsModule,
        JslibModule,
        AsyncActionsModule,
        ButtonModule,
        DialogModule,
        FormFieldModule,
        IconButtonModule,
        RadioButtonModule,
      ],
      providers: [
        { provide: DIALOG_DATA, useValue: dialogParams },
        { provide: ApiService, useValue: mockApiService },
        { provide: DialogRef, useValue: { close: action("DialogRef.close") } },
        {
          provide: DialogService,
          useValue: { openSimpleDialog: async () => true },
        },
        { provide: ToastService, useValue: { showToast: action("ToastService.showToast") } },
        UserNamePipe,
      ],
    },
    template: `<add-edit-member-dialog></add-edit-member-dialog>`,
  };
}

export default {
  title: "Admin Console/Providers/Manage/Dialogs/Add Edit Member Dialog",
  component: AddEditMemberDialogComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} satisfies Meta<AddEditMemberDialogComponent>;

type Story = StoryObj<AddEditMemberDialogComponent>;

export const Add: Story = {
  render: () => storyMeta({ providerId: PROVIDER_ID }),
};

export const Edit: Story = {
  render: () => storyMeta({ providerId: PROVIDER_ID, user: mockUser }),
};
