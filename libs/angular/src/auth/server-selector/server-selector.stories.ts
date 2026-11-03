import { importProvidersFrom } from "@angular/core";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { BehaviorSubject, map, of } from "rxjs";
import { userEvent, within } from "storybook/test";

import { ClientType } from "@bitwarden/common/enums";
import { AvailableRegionsService } from "@bitwarden/common/platform/abstractions/available-regions.service";
import {
  Environment,
  EnvironmentService,
  Region,
  RegionConfig,
  Urls,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogModule, I18nMockService, ToastOptions, ToastService } from "@bitwarden/components";

import { ServerSelectorComponent } from "./server-selector.component";

const regions: RegionConfig[] = [
  { key: Region.US, domain: "bitwarden.com", urls: {} } as RegionConfig,
  { key: Region.EU, domain: "bitwarden.eu", urls: {} } as RegionConfig,
];

/** In-memory environment so choosing a menu item updates the label, as it would in the app. */
function createEnvironmentService(initialRegion: Region): Partial<EnvironmentService> {
  const region$ = new BehaviorSubject<Region>(initialRegion);
  const environment$ = region$.pipe(
    map(
      (region) =>
        ({
          getRegion: () => region,
          getHostname: () => regions.find((r) => r.key === region)?.domain ?? "vault.example.com",
          getUrls: () => ({}) as Urls,
        }) as Partial<Environment> as Environment,
    ),
  );

  return {
    environment$,
    globalEnvironment$: environment$,
    availableRegions: () => regions,
    setEnvironment: (region: Region) => {
      region$.next(region);
      return Promise.resolve({});
    },
  };
}

/**
 * Application-level providers: the self-hosted dialog is created from the root injector and would
 * not see story-level providers.
 */
const withServer = (
  region: Region,
  options: { clientType?: ClientType; isSelfHost?: boolean } = {},
) =>
  applicationConfig({
    providers: [
      { provide: EnvironmentService, useFactory: () => createEnvironmentService(region) },
      {
        provide: PlatformUtilsService,
        useValue: {
          getClientType: () => options.clientType ?? ClientType.Browser,
          isSelfHost: () => options.isSelfHost ?? false,
          isDev: () => false,
        } as Partial<PlatformUtilsService>,
      },
    ],
  });

type StoryArgs = {
  label?: string;
  readonly: boolean;
};

export default {
  title: "Auth/Server Selector",
  component: ServerSelectorComponent,
  decorators: [
    moduleMetadata({
      imports: [DialogModule],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(BrowserAnimationsModule),
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              loggingInOn: "Logging in on",
              selfHostedServer: "self-hosted",
              environmentSaved: "Environment URLs saved",
              // Self-hosted dialog
              selfHostedCustomEnvHeader: "Self-hosted environment",
              selfHostedBaseUrlHint: "Specify the base URL of your on-premises hosted installation",
              selfHostedEnvFormInvalid:
                "You must add either the base Server URL or at least one custom environment.",
              selfHostedEnvMustUseHttps: "URLs must use HTTPS.",
              customEnvironment: "Custom environment",
              baseUrl: "Server URL",
              webVaultUrl: "Web vault server URL",
              apiUrl: "API server URL",
              identityUrl: "Identity server URL",
              notificationsUrl: "Notifications server URL",
              iconsUrl: "Icons server URL",
              sendUrl: "Send server URL",
              save: "Save",
              cancel: "Cancel",
              required: "required",
              inputRequired: "Input is required.",
              close: "Close",
              loading: "Loading",
            }),
        },
        {
          provide: AvailableRegionsService,
          useValue: { availableRegions$: of(regions) } as Partial<AvailableRegionsService>,
        },
        {
          provide: ToastService,
          useValue: {
            // eslint-disable-next-line no-console
            showToast: (options: ToastOptions) => console.log("toast", options),
          } as Partial<ToastService>,
        },
      ],
    }),
  ],
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <auth-server-selector [label]="label" [readonly]="readonly"></auth-server-selector>
    `,
  }),
  args: {
    readonly: false,
  },
  argTypes: {
    label: { control: "text" },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/ly266FZkdSjjTYrVwJUrxP/Beta-fast-follow---Q4-2026?node-id=767-2577",
    },
  },
} as Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

export const Default: Story = {
  decorators: [withServer(Region.US)],
};

export const EuSelected: Story = {
  decorators: [withServer(Region.EU)],
};

export const SelfHosted: Story = {
  decorators: [withServer(Region.SelfHosted)],
};

export const MenuOpen: Story = {
  decorators: [withServer(Region.US)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "bitwarden.com" }));
  },
};

/** Web doesn't offer self-hosted: it can only be configured from desktop and the extension. */
export const WebMenuOpen: Story = {
  decorators: [withServer(Region.US, { clientType: ClientType.Web })],
  play: MenuOpen.play,
};

export const CustomLabel: Story = {
  decorators: [withServer(Region.US)],
  args: { label: "Creating account on" },
};

/** Shows the current server without the menu, e.g. once account creation has started. */
export const Readonly: Story = {
  decorators: [withServer(Region.US)],
  args: { label: "Creating account on", readonly: true },
};

/** A self-hosted web vault is tied to its own server, so nothing is rendered. */
export const HiddenOnSelfHostedWebVault: Story = {
  decorators: [withServer(Region.SelfHosted, { clientType: ClientType.Web, isSelfHost: true })],
};
