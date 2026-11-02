import { importProvidersFrom } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { ActivatedRoute } from "@angular/router";
import {
  Meta,
  StoryObj,
  applicationConfig,
  componentWrapperDecorator,
  moduleMetadata,
} from "@storybook/angular";
import { BehaviorSubject, map, of } from "rxjs";
import { userEvent, within } from "storybook/test";

import { SideNavLogo, VaultIcon } from "@bitwarden/assets/svg";
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
import {
  AnonLayoutComponent,
  ButtonModule,
  CheckboxModule,
  DialogModule,
  FormFieldModule,
  I18nMockService,
  IconModule,
  LinkModule,
  SvgComponent,
  ToastOptions,
  ToastService,
} from "@bitwarden/components";

import { LoginServerSelectorComponent } from "./login-server-selector.component";

const FIGMA_FILE =
  "https://www.figma.com/design/ly266FZkdSjjTYrVwJUrxP/Beta-fast-follow---Q4-2026?node-id=";
const FIGMA_URL = `${FIGMA_FILE}767-2588`;

/**
 * Browser extension popup widths. Mirrors `PopupWidthOptions` in
 * `apps/browser/src/platform/browser/browser-popup-utils.ts`, which `libs/angular` can't import.
 */
const ExtensionWidth = Object.freeze({ narrow: 380, default: 480, wide: 600 } as const);
const EXTENSION_HEIGHT = 600;

const regions: RegionConfig[] = [
  { key: Region.US, domain: "bitwarden.com", urls: {} } as RegionConfig,
  { key: Region.EU, domain: "bitwarden.eu", urls: {} } as RegionConfig,
];

/**
 * In-memory environment so choosing a menu item updates the label, as it would in the app.
 */
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
 * Per-story environment and client. These must be application-level providers: the self-hosted
 * dialog is created from the root injector and would not see a story-level provider.
 *
 * The anon layout only shows the "© year Bitwarden Inc." and version footer for the web client.
 */
const withEnvironment = (region: Region, clientType: ClientType = ClientType.Web) =>
  applicationConfig({
    providers: [
      { provide: EnvironmentService, useFactory: () => createEnvironmentService(region) },
      {
        provide: PlatformUtilsService,
        useValue: {
          getApplicationVersion: () => Promise.resolve("Version 2025.5.5"),
          getClientType: () => clientType,
          isSelfHost: () => false,
          isDev: () => false,
        } as Partial<PlatformUtilsService>,
      },
    ],
  });

type StoryArgs = {
  /** Renders the browser extension design: navy header, white card-less page, "Log in" title. */
  extension: boolean;
};

/**
 * Fixed-size frame matching the extension popup. The page scrolls under the header.
 *
 * The negative margin cancels the global preview wrapper's padding (`.storybook/preview.tsx`) so
 * the frame fills the popup-sized viewport exactly.
 */
const extensionFrame = (width: number) =>
  componentWrapperDecorator(
    (story) =>
      `<div style="width: ${width}px; height: ${EXTENSION_HEIGHT}px; margin: -40px -20px">${story}</div>`,
  );

const extensionStory = (width: number, figmaNodeId: string): Story => ({
  args: { extension: true },
  decorators: [withEnvironment(Region.US, ClientType.Browser), extensionFrame(width)],
  // The layout's responsive styles key off the viewport, so the preview must be popup-sized too.
  globals: { viewport: { value: `${width}-${EXTENSION_HEIGHT}`, isRotated: false } },
  parameters: { design: { type: "figma", url: `${FIGMA_FILE}${figmaNodeId}` } },
});

export default {
  title: "Auth/Login/Server Selector Prototype",
  component: LoginServerSelectorComponent,
  decorators: [
    moduleMetadata({
      imports: [
        AnonLayoutComponent,
        ReactiveFormsModule,
        FormFieldModule,
        CheckboxModule,
        ButtonModule,
        IconModule,
        LinkModule,
        DialogModule,
        SvgComponent,
        LoginServerSelectorComponent,
      ],
    }),
    // Application-level so the self-hosted dialog (created from the root injector) can resolve them.
    applicationConfig({
      providers: [
        importProvidersFrom(BrowserAnimationsModule),
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              loggingInOn: "Logging in on:",
              selfHostedServer: "self-hosted",
              environmentSaved: "Environment URLs saved",
              accessing: "Accessing",
              appLogoLabel: "Bitwarden logo",
              emailAddress: "Email address",
              rememberEmail: "Remember email",
              continue: "Continue",
              or: "or",
              logInWithPasskey: "Log in with passkey",
              useSingleSignOn: "Use single sign-on",
              newToBitwarden: "New to Bitwarden?",
              createAccount: "Create account",
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
              inputEmail: "Input is not an email address.",
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
    props: {
      ...args,
      icon: VaultIcon,
      logo: SideNavLogo,
      // Mirrors the real login form: email is required and must be a valid address.
      formGroup: new FormGroup({
        email: new FormControl("", [Validators.required, Validators.email]),
      }),
    },
    template: /*html*/ `
      <div [class]="extension ? 'tw-flex tw-h-full tw-flex-col' : ''">
        @if (extension) {
          <!-- Prototype of the redesigned extension header; the real popup-header isn't updated yet. -->
          <div class="tw-flex tw-h-12 tw-shrink-0 tw-items-center tw-bg-bg-nav tw-px-4">
            <bit-svg class="tw-w-[118px]" [content]="logo" ariaLabel="Bitwarden logo"></bit-svg>
          </div>
        }
        <div [class]="extension ? 'tw-flex-1 tw-overflow-y-auto tw-bg-bg-primary' : ''">
      <!--
        Extension: the landing pieces paint their own gray, so clear it to let the white page show
        through, as the real extension wrapper does (CL-1389). The 24px side padding is a
        prototype-only design change.
      -->
      <auth-anon-layout
        [class]="
          extension
            ? '[&_bit-landing-header>header]:tw-bg-transparent [&_bit-landing-content>div]:tw-bg-transparent [&_bit-landing-content>div]:tw-px-6 [&_bit-landing-footer>footer]:tw-bg-transparent'
            : ''
        "
        [title]="extension ? 'Log in' : 'Log in to Bitwarden'"
        [icon]="icon"
        [maxWidth]="extension ? 'xl' : 'md'"
        [hideLogo]="extension"
        [hideCardWrapper]="extension"
        [hideBackgroundIllustration]="true"
        [contentVerticalPadding]="extension ? 'compact' : 'default'"
        [footerVerticalPadding]="extension ? 'compact' : 'default'"
      >
        <form [formGroup]="formGroup">
          <bit-form-field disableMargin>
            <bit-label>Email address</bit-label>
            <input bitInput type="email" formControlName="email" placeholder="name@company.com" />
          </bit-form-field>

          <auth-login-server-selector class="tw-mt-2 tw-mb-2"></auth-login-server-selector>

          <bit-form-control>
            <input type="checkbox" bitCheckbox />
            <bit-label>Remember email</bit-label>
          </bit-form-control>

          <div class="tw-grid tw-gap-3">
            <button type="button" bitButton block buttonType="primary">Continue</button>
            <div class="tw-text-center">or</div>
            <button type="button" bitButton block buttonType="secondary">
              <bit-icon name="bwi-passkey" class="tw-mr-1"></bit-icon>
              Log in with passkey
            </button>
            <button type="button" bitButton block buttonType="secondary">
              <bit-icon name="bwi-provider" class="tw-mr-1"></bit-icon>
              Use single sign-on
            </button>
          </div>
        </form>

        <div slot="secondary" class="tw-text-center">
          New to Bitwarden? <a bitLink href="#">Create account</a>
        </div>
      </auth-anon-layout>
        </div>
      </div>
    `,
  }),
  args: {
    extension: false,
  },
  parameters: {
    layout: "fullscreen",
    design: { type: "figma", url: FIGMA_URL },
  },
} as Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

export const Default: Story = {
  decorators: [withEnvironment(Region.US)],
};

export const EuSelected: Story = {
  decorators: [withEnvironment(Region.EU)],
};

export const SelfHosted: Story = {
  decorators: [withEnvironment(Region.SelfHosted)],
};

export const MenuOpen: Story = {
  decorators: [withEnvironment(Region.US)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId("login-server-selector-trigger"));
  },
};

export const ExtensionSmall: Story = extensionStory(ExtensionWidth.narrow, "804-5618");

export const ExtensionBase: Story = extensionStory(ExtensionWidth.default, "804-5681");

export const ExtensionWide: Story = extensionStory(ExtensionWidth.wide, "804-5744");
