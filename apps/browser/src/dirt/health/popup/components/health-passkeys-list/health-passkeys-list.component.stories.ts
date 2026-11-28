import { provideNoopAnimations } from "@angular/platform-browser/animations";
import { provideRouter } from "@angular/router";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { CompactModeService, DialogService, I18nMockService } from "@bitwarden/components";
import { ConsoleLogService, LogService } from "@bitwarden/logging";

import { PasskeyGroup, PasskeyListRow } from "../../services/passkey-list";

import { HealthPasskeysListComponent } from "./health-passkeys-list.component";

function row(
  name: string,
  secondary: string | undefined,
  host: string,
  group: PasskeyGroup = PasskeyGroup.Login,
  folderId: string | null = null,
): PasskeyListRow {
  const cipher = new CipherView();
  cipher.id = name;
  cipher.name = name;
  cipher.type = CipherType.Login;
  const uri = new LoginUriView();
  uri.uri = `https://${host}`;
  cipher.login.uris = [uri];
  return {
    id: name,
    cipher,
    group,
    name,
    secondary,
    setUpUrl: `https://${host}/passkeys`,
    folderId,
    searchText: `${name} ${secondary ?? ""} ${host}`.toLowerCase(),
  };
}

const rows: PasskeyListRow[] = [
  row("Amazon", "gina@example.com", "amazon.com", PasskeyGroup.Login, "shopping"),
  row("Apple", "kim@icloud.example", "apple.com"),
  row("Dropbox", "frank@example.com", "dropbox.com", PasskeyGroup.Login, "work"),
  row("GitHub", "jordan@example.com", "github.com", PasskeyGroup.Login, "work"),
  row("PayPal", undefined, "paypal.com"),
  row("123-reg", "nina2", "123-reg.co.uk", PasskeyGroup.TwoStep),
  row("Coinbase", "sam@example.com", "coinbase.com", PasskeyGroup.TwoStep),
];

export default {
  title: "Browser/DIRT/Health/Passkeys List",
  component: HealthPasskeysListComponent,
  decorators: [
    applicationConfig({ providers: [provideRouter([]), provideNoopAnimations()] }),
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              search: "Search",
              folder: "Folder",
              all: "All",
              name: "Name",
              filters: "Filters",
              clearAll: "Clear all",
              itemCount: "__$1__ items",
              loading: "Loading",
              noUsername: "No username",
              noItemsMatchSearch: "No items match your search",
              clearSearch: "Clear search",
              viewItemTitleWithField: "View item - __$1__ - __$2__",
              setUpPasskey: "Set up",
              setUpPasskeyFor: "Set up a passkey for __$1__, opens in a new tab",
              passkeyLoginGroup: "Log in with a passkey",
              passkeyLoginGroupDesc: "Use a passkey instead of your password.",
              passkeyTwoStepGroup: "Two-step login with a passkey",
              passkeyTwoStepGroupDesc:
                "Use a passkey as your second step. You'll still use your password.",
            }),
        },
        { provide: CompactModeService, useValue: { enabled$: of(false) } },
        { provide: DialogService, useValue: {} },
        { provide: EnvironmentService, useValue: { environment$: of({ getIconsUrl: () => "" }) } },
        // Favicons off so Chromatic builds never fetch remote icons.
        { provide: DomainSettingsService, useValue: { showFavicons$: of(false) } },
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
        { provide: LogService, useFactory: () => new ConsoleLogService(false) },
      ],
    }),
  ],
  render: (args) => ({
    props: args,
    template: `
      <!-- The popup's size, so the fill table has a bounded height to fill. -->
      <div class="tw-flex tw-flex-col tw-p-3" style="height: 600px; width: 380px">
        <dirt-health-passkeys-list
          [rows]="rows"
          [loading]="loading"
          [filtersToRestore]="filtersToRestore"
          [folderOptions]="folderOptions"
        />
      </div>
    `,
  }),
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
  args: {
    rows,
    loading: false,
    filtersToRestore: {},
    folderOptions: [
      { value: "shopping", label: "Shopping" },
      { value: "work", label: "Work" },
    ],
  },
} as Meta<HealthPasskeysListComponent>;

type Story = StoryObj<HealthPasskeysListComponent>;

/** Sites that support passkey login first, then two-step-only sites, each A to Z. */
export const Default: Story = {};

/** A saved search restored on return; the two-step group hides with no matches. */
export const Searching: Story = {
  args: { filtersToRestore: { search: "drop" } },
};

/** A search that matches nothing offers to clear it. */
export const NoMatches: Story = {
  args: { filtersToRestore: { search: "netflix" } },
};

/** No folders in use: the Folder chip is hidden. */
export const WithoutFolders: Story = {
  args: { folderOptions: [] },
};

/** Before the first result: skeleton rows at the row height. */
export const Loading: Story = {
  args: { rows: [], loading: true },
};
