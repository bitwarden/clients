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
import { ClientType } from "@bitwarden/common/enums";
import {
  EnvironmentService,
  Environment,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { ButtonModule } from "../button";
import { I18nMockService } from "../utils";

import { AnonLayoutWrapperDataService } from "./anon-layout-wrapper-data.service";
import { AnonLayoutWrapperComponent, AnonLayoutWrapperData } from "./anon-layout-wrapper.component";
import { DefaultAnonLayoutWrapperDataService } from "./default-anon-layout-wrapper-data.service";

export default {
  title: "Component Library/Anon Layout Wrapper",
  component: AnonLayoutWrapperComponent,
} as Meta;

const decorators = (options: {
  components: any[];
  routes: Routes;
  applicationVersion?: string;
  clientType?: ClientType;
  hostName?: string;
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
          useClass: DefaultAnonLayoutWrapperDataService,
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
              appLogoLabel: "app logo label",
              finishCreatingYourAccountBySettingAPassword:
                "Finish creating your account by setting a password",
              enterpriseSingleSignOn: "Enterprise Single Sign-On",
            });
          },
        },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(RouterModule.forRoot(options.routes))],
    }),
  ];
};

type Story = StoryObj<AnonLayoutWrapperComponent>;

// Default Example

@Component({
  selector: "bit-default-primary-outlet-example-component",
  template: "<p>Primary Outlet Example: <br> your primary component goes here</p>",
  standalone: false,
})
export class DefaultPrimaryOutletExampleComponent {}

@Component({
  selector: "bit-default-secondary-outlet-example-component",
  template: "<p>Secondary Outlet Example: <br> your secondary component goes here</p>",
  standalone: false,
})
export class DefaultSecondaryOutletExampleComponent {}

@Component({
  selector: "bit-default-env-selector-outlet-example-component",
  template: "<p>Env Selector Outlet Example: <br> your env selector component goes here</p>",
  standalone: false,
})
export class DefaultEnvSelectorOutletExampleComponent {}

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
        component: AnonLayoutWrapperComponent,
        children: [
          {
            path: "default-example",
            data: {},
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
const initialData: AnonLayoutWrapperData = {
  pageTitle: {
    key: "setAStrongPassword",
  },
  pageSubtitle: {
    key: "finishCreatingYourAccountBySettingAPassword",
  },
  pageIcon: LockIcon,
};

const changedData: AnonLayoutWrapperData = {
  pageTitle: {
    key: "enterpriseSingleSignOn",
  },
  pageSubtitle: "user@email.com (non-translated)",
  pageIcon: RegistrationCheckEmailIcon,
};

@Component({
  selector: "bit-dynamic-content-example-component",
  template: `
    <button type="button" bitButton buttonType="primary" (click)="toggleData()">Toggle Data</button>
  `,
  standalone: false,
})
export class DynamicContentExampleComponent {
  initialData = true;

  constructor(private anonLayoutWrapperDataService: AnonLayoutWrapperDataService) {}

  toggleData() {
    if (this.initialData) {
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData(changedData);
    } else {
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData(initialData);
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
        component: AnonLayoutWrapperComponent,
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
