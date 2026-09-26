import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { map, Observable } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { I18nMockService } from "@bitwarden/components";

import { DataLoader, Loader } from "../../metadata";
import { ImportOption, ImportType } from "../../models";
import { ImportMetadataServiceAbstraction, ImportServiceAbstraction } from "../../services";

import { ImportControlsComponent } from "./import-controls.component";

function buildOption(overrides: Partial<ImportOption> & { id: string }): ImportOption {
  return {
    name: overrides.id,
    featuredImporter: false,
    isBrowser: false,
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    hasDirectImporter: false,
    loaders: [Loader.file],
    ...overrides,
  };
}

const options: Record<string, ImportOption> = {
  keeper: buildOption({
    id: "keeper",
    name: "Keeper",
    hasDirectImporter: true,
    acceptedFileTypes: ["csv", "json"],
    pasteFormats: ["csv", "json"],
    sourceName: "Keeper",
    instructionLink: "https://bitwarden.com/help/import-from-keeper/",
  }),
  keepercsv: buildOption({
    id: "keepercsv",
    name: "Keeper (csv)",
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
  }),
  keeperjson: buildOption({
    id: "keeperjson",
    name: "Keeper (json)",
    acceptedFileTypes: ["json"],
    pasteFormats: ["json"],
  }),
  lastpasscsv: buildOption({
    id: "lastpasscsv",
    name: "LastPass",
    hasDirectImporter: true,
    acceptedFileTypes: ["csv", "html"],
    pasteFormats: ["csv"],
    sourceName: "LastPass",
    instructionLink: "https://bitwarden.com/help/import-from-lastpass/",
  }),
  chromecsv: buildOption({
    id: "chromecsv",
    name: "Chrome",
    isBrowser: true,
    hasDirectImporter: true,
    sourceName: "Chrome",
    instructionLink: "https://bitwarden.com/help/import-from-chrome/",
  }),
  dashlanecsv: buildOption({
    id: "dashlanecsv",
    name: "Dashlane (csv)",
    sourceName: "Dashlane",
    instructionKey: "importDashlaneCsvInstructions",
  }),
  dashlanejson: buildOption({
    id: "dashlanejson",
    name: "Dashlane (json)",
    acceptedFileTypes: ["json"],
    pasteFormats: ["json"],
    instructionKey: "importDashlaneJsonInstructions",
  }),
  "1password1pux": buildOption({
    id: "1password1pux",
    name: "1Password (1pux/json)",
    acceptedFileTypes: ["1pux", "json"],
    pasteFormats: ["json"],
    sourceName: "1Password",
    instructionLink: "https://bitwarden.com/help/import-from-1password/",
  }),
  "1password1pif": buildOption({
    id: "1password1pif",
    name: "1Password (1pif)",
    acceptedFileTypes: ["1pif"],
    pasteFormats: ["1pif"],
  }),
  "1passwordwincsv": buildOption({
    id: "1passwordwincsv",
    name: "1Password 6 and 7 Windows (csv)",
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
  }),
  "1passwordmaccsv": buildOption({
    id: "1passwordmaccsv",
    name: "1Password 6 and 7 Mac (csv)",
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
  }),
  keepass2xml: buildOption({
    id: "keepass2xml",
    name: "KeePass 2 (xml)",
    acceptedFileTypes: ["xml"],
    pasteFormats: ["xml"],
    instructionKey: "importKeepass2Instructions",
  }),
  keepasskdbx: buildOption({
    id: "keepasskdbx",
    name: "KeePass (kdbx)",
    acceptedFileTypes: ["kdbx"],
    pasteFormats: [],
    sourceName: "KeePass",
    instructionLink: "https://bitwarden.com/help/import-from-keepass/",
  }),
};

const importServiceStub: Partial<ImportServiceAbstraction> = {
  getImportOption: (id: ImportType) => options[id],
};

function metadataService(loaders: readonly DataLoader[] = [Loader.file]) {
  return {
    init: () => Promise.resolve(),
    metadata$: (type$: Observable<ImportType>) => type$.pipe(map((type) => ({ type, loaders }))),
  } as unknown as ImportMetadataServiceAbstraction;
}

function decoratorsFor(clientType: ClientType, loaders: readonly DataLoader[] = [Loader.file]) {
  return [
    moduleMetadata({
      providers: [
        { provide: ImportServiceAbstraction, useValue: importServiceStub },
        { provide: ImportMetadataServiceAbstraction, useValue: metadataService(loaders) },
        {
          provide: PlatformUtilsService,
          useValue: { getClientType: () => clientType } as Partial<PlatformUtilsService>,
        },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              back: "Back",
              continue: "Continue",
              method: "Method",
              uploadFile: "Upload file",
              pasteAsPlainText: "Paste as plain text",
              plainText: "Plain text",
              profile: "Profile",
              keeperEmail: "Email",
              dataCenterLocation: "Data center location",
              lastPassEmail: "Email",
              includeSharedFolders: "Include shared folders",
              importManuallyInstead: "Import manually instead",
              directlyImportInstead: "Directly import instead",
              importDataTitle: "Import your data",
              importDataDirectTitle: "Import your data in minutes",
              importDataDirectSubtitle: (vendor?: string) =>
                `Import your items directly from ${vendor} to get all your data.`,
              importDataManualSubtitle: (vendor?: string) =>
                `Export from ${vendor} or copy and paste the export content.`,
              importDataChromiumSubtitle: "Select the profile you wish to import passwords from.",
              importDataLoginTitle: (vendor?: string) => `Log in to ${vendor}`,
              importDataLoginSubtitle:
                "Your credentials are encrypted in transit and never stored.",
              importDataSecureByDesignTitle: "Secure by design",
              importDataSecureByDesignBody: (vendor?: string) =>
                `End-to-end encrypted handoff. Bitwarden never sees your ${vendor} login details.`,
              importDataLoginInfoTitle: "We'll ask for your login info",
              importDataLoginInfoBody: (vendor?: string) =>
                `In the next step, log in to your ${vendor} account.`,
              importDataEverythingTransfersTitle: "Everything transfers",
              importDataEverythingTransfersBody:
                "Logins, cards, identities, secure notes, and TOTPs with their folder structure preserved.",
              importHelpCenterInstructions: (vendor?: string) =>
                `See detailed ${vendor} instructions in our`,
              importHelpCenterLinkText: "Help Center",
              importDashlaneCsvInstructions:
                'Log in to Dashlane, click on "My Account" → "Settings" → "Export file" and select "Export as a CSV file". This will download a zip archive containing various CSV files. Unzip the archive and import each CSV file individually.',
              importDashlaneJsonInstructions:
                "Dashlane no longer supports the JSON format. Only use this if you have an existing JSON for import. Use the CSV importer when creating new exports.",
              importKeepass2Instructions:
                'Using the KeePass 2 desktop application, navigate to "File" → "Export" and select the "KeePass XML (2.x)" option.',
              importAcceptedFormats: (formats?: string) => `Accepted: ${formats}`,
              importWhichFormat: "Which of these matches what you're importing?",
              importSourceStepCount: (current?: string, total?: string) =>
                `Step ${current} of ${total}`,
              fastest: "Fastest",
              keePassMasterPassword: "Master password",
              keyFileUpload: "Key file",
              addKeyFile: "Add key file",
            }),
        },
      ],
    }),
  ];
}

export default {
  title: "Tools/Import/Controls",
  component: ImportControlsComponent,
} as Meta<ImportControlsComponent>;

type Story = StoryObj<ImportControlsComponent>;

/** Keeper on Desktop/Browser — defaults to the direct-importer promo card. */
export const VendorDirect: Story = {
  decorators: decoratorsFor(ClientType.Desktop),
  render: (args) => ({
    props: args,
    template: `<importer-controls importType="keeper"></importer-controls>`,
  }),
};

/** LastPass on Web — a direct importer exists, but Web never shows it. */
export const VendorDirectHiddenOnWeb: Story = {
  decorators: decoratorsFor(ClientType.Web),
  render: (args) => ({
    props: args,
    template: `<importer-controls importType="lastpasscsv"></importer-controls>`,
  }),
};

/** Chrome on Desktop with a chromium profile detected — the profile-picker view. */
export const Chromium: Story = {
  decorators: decoratorsFor(ClientType.Desktop, [Loader.file, Loader.chromium]),
  render: (args) => ({
    props: args,
    template: `<importer-controls importType="chromecsv"></importer-controls>`,
  }),
};

/** Dashlane — no direct importer at all; no footer toggle link. */
export const FileOnly: Story = {
  decorators: decoratorsFor(ClientType.Web),
  render: (args) => ({
    props: args,
    template: `<importer-controls importType="dashlanecsv"></importer-controls>`,
  }),
};

/** 1Password — the vendor-format-grouping case. Choose a .csv file to see the Windows/Mac
 *  disambiguation control appear. */
export const VendorFormatGrouping: Story = {
  decorators: decoratorsFor(ClientType.Web),
  render: (args) => ({
    props: args,
    template: `<importer-controls importType="1password1pux"></importer-controls>`,
  }),
};

/** KeePass — grouped with its kdbx sibling (no collision with the .xml format, so no
 *  disambiguation control). Choose a .kdbx file to see the master-password and "Add key file"
 *  fields appear. */
export const KdbxCredentials: Story = {
  decorators: decoratorsFor(ClientType.Web),
  render: (args) => ({
    props: args,
    template: `<importer-controls importType="keepass2xml"></importer-controls>`,
  }),
};
