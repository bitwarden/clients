import { importProvidersFrom } from "@angular/core";
import { provideRouter, RouterOutlet, Routes, withHashLocation } from "@angular/router";
import { applicationConfig, Decorator, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import {
  ProviderType,
  ProviderUserStatusType,
  ProviderUserType,
} from "@bitwarden/common/admin-console/enums";
import { Provider } from "@bitwarden/common/admin-console/models/domain/provider";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { ProvidersComponent } from "./providers.component";

const USER_ID = "user-story-1" as UserId;

function provider(overrides: Partial<Provider> = {}): Provider {
  return new Provider({
    id: "provider-1",
    name: "Acme Managed Services",
    status: ProviderUserStatusType.Confirmed,
    type: ProviderUserType.ProviderAdmin,
    enabled: true,
    userId: USER_ID,
    useEvents: true,
    providerStatus: undefined,
    providerType: ProviderType.Msp,
    ...overrides,
  } as any);
}

const routes: Routes = [
  { path: "providers", component: ProvidersComponent, data: { titleId: "providers" } },
];

/** Renders the story at `url`; hash routing keeps Storybook's own query string intact. */
const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };

export default {
  title: "Admin Console/Providers/Providers",
  component: ProvidersComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    moduleMetadata({
      imports: [RouterOutlet],
      providers: [
        {
          provide: AccountService,
          useValue: {
            activeAccount$: of({ id: USER_ID, email: "user@example.com", emailVerified: true }),
          },
        },
        {
          provide: ProviderService,
          useValue: {
            providers$: () =>
              of([
                provider(),
                provider({
                  id: "provider-2",
                  name: "Contoso IT Services",
                  enabled: false,
                  type: ProviderUserType.ServiceUser,
                }),
              ]),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getFeatureFlag$: (flag: FeatureFlag) => of(flag === FeatureFlag.VFO1Foundation),
          },
        },
      ],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter(routes, withHashLocation()),
      ],
    }),
  ],
} satisfies Meta<ProvidersComponent>;

type Story = StoryObj<ProvidersComponent>;

/** Two providers the user belongs to; the second is disabled and shows the warning icon. */
export const Default: Story = {
  decorators: [atUrl("/providers")],
};
