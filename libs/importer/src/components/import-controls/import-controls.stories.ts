import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { map, Observable, of } from "rxjs";
import { action } from "storybook/actions";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ClientType } from "@bitwarden/common/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, I18nMockService, ToastService } from "@bitwarden/components";

import { DataLoader, Loader } from "../../metadata";
import { CredentialKind, ImportOption, ImportType } from "../../models";
import {
  ImporterCapabilities,
  ImportMetadataServiceAbstraction,
  ImportServiceAbstraction,
} from "../../services";
import { KeeperDirectImportService } from "../keeper/keeper-direct-import.service";
import { LastPassDirectImportService } from "../lastpass/lastpass-direct-import.service";

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
  dashlane: buildOption({
    id: "dashlane",
    name: "Dashlane",
    acceptedFileTypes: ["csv", "json"],
    pasteFormats: ["csv", "json"],
    sourceName: "Dashlane",
    instructionKey: "importDashlaneCsvInstructions",
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
  "1password": buildOption({
    id: "1password",
    name: "1Password",
    acceptedFileTypes: ["1pux", "json", "1pif", "csv"],
    pasteFormats: ["json", "1pif", "csv"],
    sourceName: "1Password",
    instructionLink: "https://bitwarden.com/help/import-from-1password/",
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
    name: "1Password 6 and 7 Windows .csv",
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
  }),
  "1passwordmaccsv": buildOption({
    id: "1passwordmaccsv",
    name: "1Password 6 and 7 Mac .csv",
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
  }),
  keepass: buildOption({
    id: "keepass",
    name: "KeePass",
    acceptedFileTypes: ["kdbx", "xml", "csv"],
    pasteFormats: ["xml", "csv"],
    sourceName: "KeePass",
    instructionLink: "https://bitwarden.com/help/import-from-keepass/",
  }),
  keepass2xml: buildOption({
    id: "keepass2xml",
    name: "KeePass 2 (xml)",
    acceptedFileTypes: ["xml"],
    pasteFormats: ["xml"],
    sourceName: "KeePass",
    instructionLink: "https://bitwarden.com/help/import-from-keepass/",
  }),
  keepasskdbx: buildOption({
    id: "keepasskdbx",
    name: "KeePass (kdbx)",
    acceptedFileTypes: ["kdbx"],
    pasteFormats: [],
    // Matches production; without it KdbxCredentials would exercise the wrong (file) branch.
    sdk: { fileTypes: ["kdbx"], credentialKind: CredentialKind.passwordWithKeyFile },
    sourceName: "KeePass",
    instructionLink: "https://bitwarden.com/help/import-from-keepass/",
  }),
  keepassxcsv: buildOption({
    id: "keepassxcsv",
    name: "KeePassX (csv)",
    acceptedFileTypes: ["csv"],
    pasteFormats: ["csv"],
    sourceName: "KeePass",
    instructionLink: "https://bitwarden.com/help/import-from-keepass/",
  }),
};

const importServiceStub: Partial<ImportServiceAbstraction> = {
  getImportOption: (id: ImportType) => options[id],
  // Without these, Continue throws "not a function", swallowed into a silently-empty dialog.
  getImporter: () => ({}) as any,
  import: async () =>
    ({ success: true, ciphers: [], folders: [], collections: [], errors: [] }) as any,
  importImportResult: async (result) => result as any,
  importWithSdk: async () => ({ ciphers: [], folders: 0, collections: 0 }) as any,
  sdkErrorMessageKey: () => undefined,
};

function metadataService(
  loaders: readonly DataLoader[] = [Loader.file],
): ImportMetadataServiceAbstraction {
  return {
    init: () => Promise.resolve(),
    metadata$: (type$: Observable<ImportType>) =>
      type$.pipe(map((type): ImporterCapabilities => ({ type, loaders: [...loaders] }))),
    getAvailableProfiles: () =>
      Promise.resolve([
        { id: "Default", name: "Default" },
        { id: "Profile 1", name: "Work" },
      ]),
    getChromiumLogins: () => Promise.resolve([]),
  };
}

function metadataServiceNoProfiles(): ImportMetadataServiceAbstraction {
  return {
    init: () => Promise.resolve(),
    metadata$: (type$: Observable<ImportType>) =>
      type$.pipe(
        map((type): ImporterCapabilities => ({ type, loaders: [Loader.file, Loader.chromium] })),
      ),
    getAvailableProfiles: () => Promise.resolve([]),
    getChromiumLogins: () => Promise.resolve([]),
  };
}

function decoratorsFor(
  clientType: ClientType,
  loaders: readonly DataLoader[] = [Loader.file],
  metadataServiceOverride?: ImportMetadataServiceAbstraction,
) {
  return [
    moduleMetadata({
      providers: [
        { provide: ImportServiceAbstraction, useValue: importServiceStub },
        {
          provide: ImportMetadataServiceAbstraction,
          useValue: metadataServiceOverride ?? metadataService(loaders),
        },
        {
          provide: PlatformUtilsService,
          useValue: { getClientType: () => clientType } as Partial<PlatformUtilsService>,
        },
        {
          provide: LogService,
          useValue: { error: action("LogService.error") } as Partial<LogService>,
        },
        {
          provide: DialogService,
          // Resolves immediately so a story reaching Continue doesn't hang on a real dialog.
          useValue: {
            open: () => ({ closed: of(undefined) }),
          } as unknown as Partial<DialogService>,
        },
        {
          provide: ToastService,
          useValue: { showToast: action("ToastService.showToast") } as Partial<ToastService>,
        },
        {
          provide: PolicyService,
          useValue: { policyAppliesToUser$: () => of(false) } as Partial<PolicyService>,
        },
        {
          provide: AccountService,
          useValue: { activeAccount$: of({ id: "storybook-user" }) } as Partial<AccountService>,
        },
        {
          provide: SyncService,
          useValue: { fullSync: () => Promise.resolve(true) } as Partial<SyncService>,
        },
        {
          provide: AbstractThemingService,
          useValue: { theme$: of(ThemeTypes.Light) } as Partial<AbstractThemingService>,
        },
        {
          provide: KeeperDirectImportService,
          useValue: {
            handleImport: () => Promise.reject(new Error("Not wired up in Storybook.")),
          } as Partial<KeeperDirectImportService>,
        },
        {
          provide: LastPassDirectImportService,
          useValue: {
            handleImport: () => Promise.reject(new Error("Not wired up in Storybook.")),
          } as Partial<LastPassDirectImportService>,
        },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              back: "Back",
              continue: "Continue",
              method: "Method",
              // bit-callout resolves these unconditionally (close button label, its default
              // landmark name when untitled) and bit-form-field resolves "required" whenever a
              // control has Validators.required — every story here hits both.
              close: "Close",
              callout: "Callout",
              required: "required",
              error: "Error",
              // The kdbxPassword field's empty-value form validator message (import-controls
              // .component.ts), surfaced before submit — not an onContinue()/SDK error path.
              kdbxPasswordRequired: "Password is required.",
              errorOccurred: "An error has occurred.",
              selectFile: "Select a file.",
              selectFileUnsupportedType: "That file type isn't accepted for this source.",
              pasteContentRequired: "Paste the exported content.",
              selectFormat: "Select the format of the import file.",
              // Chromium's stub always resolves zero logins, so Continue always hits this key.
              importNothingError: "Nothing was imported.",
              // bit-spinner resolves this as its default aria title — hit by the Chromium story
              // specifically, which briefly shows the spinner while capabilities resolve.
              loading: "Loading",
              // bit-file-upload resolves both of these unconditionally (button label, and the
              // "no file chosen yet" placeholder shown by default) — hit by every story that
              // defaults to manual/file mode. fileChosen is the same status readout once a file
              // is actually picked — hit by choosing a file in VendorFormatGrouping/KdbxCredentials,
              // per those stories' own doc comments.
              chooseFile: "Choose file",
              noFileSelected: "No file selected",
              fileChosen: (name?: string) => `${name} chosen`,
              // bit-select resolves this as its default placeholder — hit by the Chromium story's
              // profile select.
              selectPlaceholder: "-- Select --",
              selectProfile: "Select profile",
              // bitPasswordInputToggle resolves this unconditionally at construction — hit by
              // KdbxCredentials' master-password field. inputRequired is bit-form-field's default
              // "required" validation message, resolved on blur of any empty required field
              // (Chromium's profile select, KdbxCredentials' master password, VendorDirect's
              // Keeper email).
              toggleVisibility: "Toggle visibility",
              inputRequired: "This field is required.",
              // bit-error resolves this for the email validator the same way it resolves
              // inputRequired for the required one — reachable by typing a non-email value into
              // VendorDirect's Keeper email field.
              inputEmail: "Input is not an email address.",
              // Only reachable by ChromiumNoProfiles, whose stub resolves an empty profile list.
              noBrowserProfilesFound: "No browser profiles were found",
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
              importDataDirectSubtitlePrefix: "Import your items directly from",
              importDataDirectSubtitleSuffix: "to get all your data.",
              importDataManualSubtitle: (vendor?: string) =>
                `Import from ${vendor} or copy and paste the export content.`,
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
              importAcceptedFormats: (formats?: string) => `Accepted: ${formats}`,
              importVendorFileType: (vendor?: string) => `${vendor} file type`,
              fastest: "Fastest",
              keePassMasterPasswordV2: (vendor?: string) => `${vendor} password`,
              keyFileUploadV2: "Key file",
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

/** Chrome on Desktop where the profile fetch succeeds but finds none (e.g. a freshly installed
 *  browser) — the danger callout, not the empty dead-end select it replaces. */
export const ChromiumNoProfiles: Story = {
  decorators: decoratorsFor(ClientType.Desktop, undefined, metadataServiceNoProfiles()),
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
    template: `<importer-controls importType="dashlane"></importer-controls>`,
  }),
};

/** 1Password — the vendor-format-grouping case. Choose a .csv file to see the Windows/Mac
 *  disambiguation control appear. */
export const VendorFormatGrouping: Story = {
  decorators: decoratorsFor(ClientType.Web),
  render: (args) => ({
    props: args,
    template: `<importer-controls importType="1password"></importer-controls>`,
  }),
};

/** KeePass — now always prompts for a format (xml/kdbx/csv), even though none of its siblings
 *  collide on extension. Choose a .kdbx file to see the master-password and "Add key file"
 *  fields appear. */
export const KdbxCredentials: Story = {
  decorators: decoratorsFor(ClientType.Web),
  render: (args) => ({
    props: args,
    template: `<importer-controls importType="keepass"></importer-controls>`,
  }),
};
