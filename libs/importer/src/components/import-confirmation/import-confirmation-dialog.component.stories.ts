import { NoopAnimationsModule } from "@angular/platform-browser/animations";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DIALOG_DATA, DialogRef, I18nMockService } from "@bitwarden/components";

import {
  ImportConfirmationDialogComponent,
  ImportConfirmationDialogData,
} from "./import-confirmation-dialog.component";

// The counts in Figma's "Import successful" dialog (6618:93330): 74 items, 4 shared folders.
const summary: ImportConfirmationDialogData["summary"] = {
  total: 74,
  rows: [
    { icon: "globe", labelKey: "typeLogin", count: 30 },
    { icon: "id-card", labelKey: "typeCard", count: 14 },
    { icon: "id-card", labelKey: "typeIdentity", count: 10 },
    { icon: "sticky-note", labelKey: "typeNote", count: 10 },
    { icon: "key", labelKey: "typeSshKey", count: 10 },
    { icon: "collection-shared", labelKey: "sharedFolder", count: 4 },
  ],
};

const withData = (data: ImportConfirmationDialogData) =>
  moduleMetadata({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: { close: () => {} } },
    ],
  });

export default {
  title: "Tools/Import/Confirmation dialog",
  component: ImportConfirmationDialogComponent,
  decorators: [
    moduleMetadata({
      imports: [NoopAnimationsModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              importSuccessful: "Import successful",
              importConfirmationBody: (count?: string) =>
                `You’ve successfully imported ${count} items into Bitwarden.`,
              importConfirmationBodySingular: "You’ve successfully imported 1 item into Bitwarden.",
              importConfirmationTipLabel: "Tip:",
              importDeleteFileTip: (name?: string) =>
                `Don't forget to delete ${name}. It contains sensitive data and may be unencrypted.`,
              importDeleteFileTipGeneric:
                "Don't forget to delete your import file. It contains sensitive data and may be unencrypted.",
              ok: "Ok",
              typeLogin: "Login",
              typeCard: "Card",
              typeIdentity: "Identity",
              typeNote: "Note",
              typeSshKey: "SSH key",
              folders: "Folders",
              sharedFolder: "Shared folder",
              close: "Close",
              callout: "Callout",
              loading: "Loading",
              more: "More",
            }),
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/XSVfwUs74g0353SKulKmWN/Import?node-id=6618-93330",
    },
  },
} as Meta<ImportConfirmationDialogComponent>;

type Story = StoryObj<ImportConfirmationDialogComponent>;

/** A file import: the tip names the file (Figma 6618:93330). */
export const FileImport: Story = {
  decorators: [withData({ summary, importedFile: { name: "passwords.csv" } })],
};

/** Direct import or pasted text: no tip, and the content reflows with no gap (Figma 6618:93578). */
export const NoTip: Story = {
  decorators: [withData({ summary })],
};

export const SingleItem: Story = {
  decorators: [
    withData({
      summary: { total: 1, rows: [{ icon: "globe", labelKey: "typeLogin", count: 1 }] },
      importedFile: { name: "passwords.csv" },
    }),
  ],
};

/** An unbroken file name must wrap inside the dialog. */
export const LongFileName: Story = {
  decorators: [
    withData({
      summary,
      importedFile: {
        name: "a_very_long_export_file_name_with_no_spaces_that_must_still_wrap_inside_the_callout_2026-11-02.csv",
      },
    }),
  ],
};

/** The file has no name to show. */
export const UnnamedFile: Story = {
  decorators: [withData({ summary, importedFile: {} })],
};
