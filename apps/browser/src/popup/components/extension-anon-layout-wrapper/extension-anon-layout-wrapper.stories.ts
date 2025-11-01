import { importProvidersFrom, Component } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import {
  Meta,
  StoryObj,
  applicationConfig,
  componentWrapperDecorator,
  moduleMetadata,
} from "@storybook/angular";
import { of } from "rxjs";

import { LockIcon, RegistrationCheckEmailIcon } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ClientType } from "@bitwarden/common/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  EnvironmentService,
  Environment,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { AnonLayoutWrapperDataService, ButtonModule, I18nMockService } from "@bitwarden/components";

import { AccountSwitcherService } from "../../../auth/popup/account-switching/services/account-switcher.service";
import { PopupRouterCacheService } from "../../../platform/popup/view-cache/popup-router-cache.service";

import { ExtensionAnonLayoutWrapperDataService } from "./extension-anon-layout-wrapper-data.service";
import {
  ExtensionAnonLayoutWrapperComponent,
  ExtensionAnonLayoutWrapperData,
} from "./extension-anon-layout-wrapper.component";

export default {
  title: "Browser/Extension Anon Layout Wrapper",
  component: ExtensionAnonLayoutWrapperComponent,
} as Meta;

const decorators = (options: {
  components: any[];
  routes: Routes;
  applicationVersion?: string;
  clientType?: ClientType;
  hostName?: string;
  accounts?: any[];
}) => {
  return [
    componentWrapperDecorator(
      /**
       * Applying a CSS transform makes a `position: fixed` element act like it is `position: relative`
       * https://github.com/storybookjs/storybook/issues/8011#issue-490251969
       */
      (story) => {
        return /* HTML */ `<div class="tw-scale-100 ">${story}</div>`;
      },
      ({ globals }) => {
        /**
         * avoid a bug with the way that we render the same component twice in the same iframe and how
         * that interacts with the router-outlet
         */
        const themeOverride = globals["theme"] === "both" ? "light" : globals["theme"];
        return { theme: themeOverride };
      },
    ),
    moduleMetadata({
      declarations: options.components,
      imports: [RouterModule, ButtonModule],
      providers: [
        {
          provide: AnonLayoutWrapperDataService,
          useClass: ExtensionAnonLayoutWrapperDataService,
        },
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({
              id: "test-user-id" as UserId,
              name: "Test User 1",
              email: "test@email.com",
              emailVerified: true,
            }),
          },
        },
        {
          provide: AccountSwitcherService,
          useValue: {
            availableAccounts$: of(options.accounts || []),
            SPECIAL_ADD_ACCOUNT_ID: "addAccount",
          } as Partial<AccountSwitcherService>,
        },
        {
          provide: AuthService,
          useValue: {
            activeAccountStatus$: of(AuthenticationStatus.Unlocked),
          },
        },
        {
          provide: AvatarService,
          useValue: {
            avatarColor$: of("#ab134a"),
          } as Partial<AvatarService>,
        },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag: () => true,
          },
        },
        {
          provide: EnvironmentService,
          useValue: {
            environment$: of({
              getHostname: () => options.hostName || "storybook.bitwarden.com",
            } as Partial<Environment>),
          } as Partial<EnvironmentService>,
        },
        {
          provide: PlatformUtilsService,
          useValue: {
            getApplicationVersion: () =>
              Promise.resolve(options.applicationVersion || "FAKE_APP_VERSION"),
            getClientType: () => options.clientType || ClientType.Web,
          } as Partial<PlatformUtilsService>,
        },
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              setAStrongPassword: "Set a strong password",
              finishCreatingYourAccountBySettingAPassword:
                "Finish creating your account by setting a password",
              enterpriseSingleSignOn: "Enterprise single sign-on",
              checkYourEmail: "Check your email",
              loading: "Loading",
              popOutNewWindow: "Pop out to a new window",
              switchAccounts: "Switch accounts",
              back: "Back",
              activeAccount: "Active account",
              appLogoLabel: "app logo label",
              bitwardenAccount: "Bitwarden Account",
            });
          },
        },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(RouterModule.forRoot(options.routes)),
        {
          provide: PopupRouterCacheService,
          useValue: {
            back() {},
          } as Partial<PopupRouterCacheService>,
        },
      ],
    }),
  ];
};

type Story = StoryObj<ExtensionAnonLayoutWrapperComponent>;

// Default Example

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-default-primary-outlet-example-component",
  template: "<p>Primary Outlet Example: <br> your primary component goes here</p>",
  standalone: false,
})
class DefaultPrimaryOutletExampleComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-default-secondary-outlet-example-component",
  template: "<p>Secondary Outlet Example: <br> your secondary component goes here</p>",
  standalone: false,
})
class DefaultSecondaryOutletExampleComponent {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-default-env-selector-outlet-example-component",
  template: "<p>Env Selector Outlet Example: <br> your env selector component goes here</p>",
  standalone: false,
})
class DefaultEnvSelectorOutletExampleComponent {}

export const DefaultContentExample: Story = {
  render: (args) => ({
    props: args,
    template: "<router-outlet></router-outlet>",
  }),
  decorators: decorators({
    components: [
      DefaultPrimaryOutletExampleComponent,
      DefaultSecondaryOutletExampleComponent,
      DefaultEnvSelectorOutletExampleComponent,
    ],
    routes: [
      {
        path: "**",
        redirectTo: "default-example",
        pathMatch: "full",
      },
      {
        path: "",
        component: ExtensionAnonLayoutWrapperComponent,
        children: [
          {
            path: "default-example",
            data: {
              pageIcon: LockIcon,
            } satisfies ExtensionAnonLayoutWrapperData,
            children: [
              {
                path: "",
                component: DefaultPrimaryOutletExampleComponent,
              },
              {
                path: "",
                component: DefaultSecondaryOutletExampleComponent,
                outlet: "secondary",
              },
              {
                path: "",
                component: DefaultEnvSelectorOutletExampleComponent,
                outlet: "environment-selector",
              },
            ],
          },
        ],
      },
    ],
  }),
};

// Dynamic Content Example
const initialData: ExtensionAnonLayoutWrapperData = {
  pageTitle: {
    key: "setAStrongPassword",
  },
  pageSubtitle: {
    key: "finishCreatingYourAccountBySettingAPassword",
  },
  pageIcon: LockIcon,
  showAcctSwitcher: true,
  showBackButton: true,
  showLogo: true,
};

const changedData: ExtensionAnonLayoutWrapperData = {
  pageTitle: {
    key: "enterpriseSingleSignOn",
  },
  pageSubtitle: {
    key: "checkYourEmail",
  },
  pageIcon: RegistrationCheckEmailIcon,
  showAcctSwitcher: false,
  showBackButton: false,
  showLogo: false,
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-dynamic-content-example-component",
  template: `
    <button type="button" bitButton buttonType="primary" (click)="toggleData()">Toggle Data</button>
  `,
  standalone: false,
})
export class DynamicContentExampleComponent {
  initialData = true;

  constructor(private extensionAnonLayoutWrapperDataService: AnonLayoutWrapperDataService) {}

  toggleData() {
    if (this.initialData) {
      this.extensionAnonLayoutWrapperDataService.setAnonLayoutWrapperData(changedData);
    } else {
      this.extensionAnonLayoutWrapperDataService.setAnonLayoutWrapperData(initialData);
    }

    this.initialData = !this.initialData;
  }
}

export const DynamicContentExample: Story = {
  render: (args) => ({
    props: args,
    template: "<router-outlet></router-outlet>",
  }),
  decorators: decorators({
    components: [DynamicContentExampleComponent],
    routes: [
      {
        path: "**",
        redirectTo: "dynamic-content-example",
        pathMatch: "full",
      },
      {
        path: "",
        component: ExtensionAnonLayoutWrapperComponent,
        children: [
          {
            path: "dynamic-content-example",
            data: initialData,
            children: [
              {
                path: "",
                component: DynamicContentExampleComponent,
              },
            ],
          },
        ],
      },
    ],
  }),
};

export const HasLoggedInAccountExample: Story = {
  render: (args) => ({
    props: args,
    template: "<router-outlet></router-outlet>",
  }),
  decorators: decorators({
    components: [DefaultPrimaryOutletExampleComponent],
    routes: [
      {
        path: "**",
        redirectTo: "has-logged-in-account",
        pathMatch: "full",
      },
      {
        path: "",
        component: ExtensionAnonLayoutWrapperComponent,
        children: [
          {
            path: "has-logged-in-account",
            data: {
              showAcctSwitcher: true,
              pageIcon: LockIcon,
            } satisfies ExtensionAnonLayoutWrapperData,
            children: [
              {
                path: "",
                component: DefaultPrimaryOutletExampleComponent,
              },
              {
                path: "",
                component: DefaultSecondaryOutletExampleComponent,
                outlet: "secondary",
              },
              {
                path: "",
                component: DefaultEnvSelectorOutletExampleComponent,
                outlet: "environment-selector",
              },
            ],
          },
        ],
      },
    ],
    accounts: [
      {
        name: "Test User",
        email: "testuser@bitwarden.com",
        id: "123e4567-e89b-12d3-a456-426614174000",
        server: "bitwarden.com",
        status: 2,
        isActive: false,
      },
      {
        name: "addAccount",
        id: "addAccount",
        isActive: false,
      },
    ],
  }),
};
