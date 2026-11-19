import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, I18nMockService } from "@bitwarden/components";

import {
  DeleteFolderDialogComponent,
  DeleteFolderDialogParams,
} from "./delete-folder-dialog.component";

/** Provided per story, since the dialog reads `DIALOG_DATA` once at construction. */
const withParams = (params: DeleteFolderDialogParams) =>
  moduleMetadata({ providers: [{ provide: DIALOG_DATA, useValue: params }] });

export default {
  title: "Vault/Delete Folder Dialog",
  component: DeleteFolderDialogComponent,
  decorators: [
    applicationConfig({ providers: [provideNoopAnimations()] }),
    moduleMetadata({
      imports: [DeleteFolderDialogComponent],
      providers: [
        { provide: DialogRef, useValue: { close: () => {} } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              deleteFolder: "Delete folder",
              deleteFoldersCount: "Delete __$1__ folders",
              deleteFolderDescription:
                "When you delete the __$1__ folder, it will be removed from every item it's been applied to. The items themselves won't be deleted.",
              deleteFoldersDescription:
                "When you delete these folders, they will be removed from every item they've been applied to. The items themselves won't be deleted.",
              delete: "Delete",
              cancel: "Cancel",
            }),
        },
      ],
    }),
  ],
} as Meta<DeleteFolderDialogComponent>;

type Story = StoryObj<DeleteFolderDialogComponent>;

/** One folder: its name is rendered in italics inside the localized sentence. */
export const SingleFolder: Story = {
  decorators: [withParams({ folderName: "Streaming services" })],
};

/** Several folders: the title carries the count and the copy names none of them. */
export const MultipleFolders: Story = {
  decorators: [withParams({ count: 3 })],
};
