/**
 * UX prototype of the login page with the server shown in the email field's hint. This is not
 * component documentation: it recreates the page to show the larger UX change, at the web width and
 * at the browser extension's three popup widths. See PM-45941.
 */
import {
  ChangeDetectionStrategy,
  Component,
  importProvidersFrom,
  inject,
  input,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
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
  MenuModule,
  SvgComponent,
  ToastOptions,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe, safeProvider } from "@bitwarden/ui-common";

import { ServerSelectionService } from "./server-selection.service";

const FIGMA_FILE =
  "https://www.figma.com/design/ly266FZkdSjjTYrVwJUrxP/Beta-fast-follow---Q4-2026?node-id=";

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

/** The prototype login page. Story-only: the real login page isn't changed. */
@Component({
  selector: "auth-login-page-prototype",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [safeProvider(ServerSelectionService)],
  imports: [
    AnonLayoutComponent,
    ButtonModule,
    CheckboxModule,
    FormFieldModule,
    I18nPipe,
    IconModule,
    LinkModule,
    MenuModule,
    ReactiveFormsModule,
    SvgComponent,
  ],
  template: /*html*/ `
    <div [class]="extension() ? 'tw-flex tw-h-full tw-flex-col' : ''">
      @if (extension()) {
        <!-- Prototype of the redesigned extension header; the real popup-header isn't updated yet. -->
        <div class="tw-flex tw-h-12 tw-shrink-0 tw-items-center tw-bg-bg-nav tw-px-4">
          <bit-svg class="tw-w-28" [content]="logo" ariaLabel="Bitwarden logo"></bit-svg>
        </div>
      }
      <div [class]="extension() ? 'tw-flex-1 tw-overflow-y-auto tw-bg-bg-primary' : ''">
        <!--
          Extension: the landing pieces paint their own gray, so clear it to let the white page show
          through, as the real extension wrapper does (CL-1389). The 24px side padding is a
          prototype-only design change.
        -->
        <auth-anon-layout
          [class]="
            extension()
              ? '[&_bit-landing-header>header]:tw-bg-transparent [&_bit-landing-content>div]:tw-bg-transparent [&_bit-landing-content>div]:tw-px-6 [&_bit-landing-footer>footer]:tw-bg-transparent'
              : ''
          "
          [title]="extension() ? 'Log in' : 'Log in to Bitwarden'"
          [icon]="icon"
          [maxWidth]="extension() ? 'xl' : 'md'"
          [hideLogo]="extension()"
          [hideCardWrapper]="extension()"
          [hideBackgroundIllustration]="true"
          [contentVerticalPadding]="extension() ? 'compact' : 'default'"
          [footerVerticalPadding]="extension() ? 'compact' : 'default'"
        >
          @let server = selectedServer();
          @let selectedRegion = server === Region.SelfHosted ? null : server;
          <form [formGroup]="formGroup">
            <bit-form-field>
              <bit-label>{{ "emailAddress" | i18n }}</bit-label>
              <input
                id="login-prototype_input_email"
                bitInput
                type="email"
                formControlName="email"
                placeholder="name@company.com"
              />
              @if (!serverSelection.hidden) {
                <bit-hint>
                  {{ "loggingInOn" | i18n }}:
                  <button
                    id="login-prototype_button_server"
                    type="button"
                    bitLink
                    #serverTrigger="menuTrigger"
                    [bitMenuTriggerFor]="serverMenu"
                    [endIcon]="serverTrigger.isOpen() ? 'bwi-angle-up' : 'bwi-angle-down'"
                  >
                    {{ selectedRegion?.domain ?? ("selfHostedServer" | i18n) }}
                  </button>
                </bit-hint>
              }
            </bit-form-field>

            <bit-menu #serverMenu>
              @for (region of availableRegions(); track region.key) {
                <button
                  [id]="'login-prototype_button_server-' + region.key"
                  type="button"
                  bitMenuItem
                  [attr.aria-pressed]="selectedRegion?.key === region.key"
                  (click)="serverSelection.selectRegion(region)"
                >
                  <bit-icon
                    slot="start"
                    name="bwi-check"
                    fixedWidth
                    class="tw-text-xs"
                    [class.tw-invisible]="selectedRegion?.key !== region.key"
                  ></bit-icon>
                  {{ region.domain }}
                </button>
              }
              @if (serverSelection.selfHostedAvailable) {
                <button
                  id="login-prototype_button_server-self-hosted"
                  type="button"
                  bitMenuItem
                  [attr.aria-pressed]="server === Region.SelfHosted"
                  (click)="serverSelection.selectSelfHosted()"
                >
                  <bit-icon
                    slot="start"
                    name="bwi-check"
                    fixedWidth
                    class="tw-text-xs"
                    [class.tw-invisible]="server !== Region.SelfHosted"
                  ></bit-icon>
                  {{ "selfHostedServer" | i18n }}
                </button>
              }
            </bit-menu>

            <bit-form-control>
              <input id="login-prototype_input_remember-email" type="checkbox" bitCheckbox />
              <bit-label>{{ "rememberEmail" | i18n }}</bit-label>
            </bit-form-control>

            <div class="tw-grid tw-gap-3">
              <button
                id="login-prototype_button_continue"
                type="button"
                bitButton
                block
                buttonType="primary"
              >
                {{ "continue" | i18n }}
              </button>
              <div class="tw-text-center">{{ "or" | i18n }}</div>
              <button
                id="login-prototype_button_passkey"
                type="button"
                bitButton
                block
                buttonType="secondary"
                startIcon="bwi-passkey"
              >
                {{ "logInWithPasskey" | i18n }}
              </button>
              <button
                id="login-prototype_button_sso"
                type="button"
                bitButton
                block
                buttonType="secondary"
                startIcon="bwi-provider"
              >
                {{ "useSingleSignOn" | i18n }}
              </button>
            </div>
          </form>

          <div slot="secondary" class="tw-text-center">
            {{ "newToBitwarden" | i18n }} <a bitLink href="#">{{ "createAccount" | i18n }}</a>
          </div>
        </auth-anon-layout>
      </div>
    </div>
  `,
})
class LoginPagePrototypeComponent {
  /** Renders the browser extension design: navy header, white card-less page, "Log in" title. */
  readonly extension = input(false);

  protected readonly serverSelection = inject(ServerSelectionService);
  protected readonly Region = Region;
  protected readonly icon = VaultIcon;
  protected readonly logo = SideNavLogo;
  protected readonly selectedServer = toSignal(this.serverSelection.selectedServer$);
  protected readonly availableRegions = toSignal(this.serverSelection.availableRegions$, {
    initialValue: [] as RegionConfig[],
  });

  /** Mirrors the real login form: email is required and must be a valid address. */
  protected readonly formGroup = new FormGroup({
    email: new FormControl("", [Validators.required, Validators.email]),
  });
}

/** In-memory environment so choosing a menu item updates the hint, as it would in the app. */
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
  extension: boolean;
};

type Story = StoryObj<StoryArgs>;

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
  title: "Auth/Prototypes/Login Page with Server Selector",
  component: LoginPagePrototypeComponent,
  decorators: [
    moduleMetadata({
      imports: [DialogModule, LoginPagePrototypeComponent],
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
              loggingInOn: "Logging in on",
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
    props: args,
    template: /*html*/ `<auth-login-page-prototype [extension]="extension"></auth-login-page-prototype>`,
  }),
  args: {
    extension: false,
  },
  parameters: {
    layout: "fullscreen",
    design: { type: "figma", url: `${FIGMA_FILE}767-2588` },
  },
} as Meta<StoryArgs>;

export const Default: Story = {
  decorators: [withEnvironment(Region.US)],
};

export const EuSelected: Story = {
  decorators: [withEnvironment(Region.EU)],
};

export const SelfHosted: Story = {
  decorators: [withEnvironment(Region.SelfHosted, ClientType.Browser)],
};

export const MenuOpen: Story = {
  decorators: [withEnvironment(Region.US)],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "bitwarden.com" }));
  },
};

export const ExtensionSmall: Story = extensionStory(ExtensionWidth.narrow, "804-5618");

export const ExtensionBase: Story = extensionStory(ExtensionWidth.default, "804-5681");

export const ExtensionWide: Story = extensionStory(ExtensionWidth.wide, "804-5744");
