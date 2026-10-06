import { CommonModule } from "@angular/common";
import { importProvidersFrom } from "@angular/core";
import { provideRouter, RouterModule, Routes, withHashLocation } from "@angular/router";
import { applicationConfig, Decorator, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ButtonModule, SvgModule, TypographyModule } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { AcceptProviderComponent } from "./accept-provider.component";

const routes: Routes = [{ path: "accept-provider", component: AcceptProviderComponent }];

const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };

const ACCEPT_URL =
  "/accept-provider?providerId=provider-1&providerUserId=provider-user-1&token=story-token&providerName=Acme%20MSP&email=jane%40example.com";

function storyProviders(authStatus: AuthenticationStatus) {
  return [
    { provide: AuthService, useValue: { activeAccountStatus$: of(authStatus) } },
    {
      provide: ApiService,
      useValue: { postProviderUserAccept: async (): Promise<void> => undefined },
    },
    {
      provide: PlatformUtilsService,
      useValue: { showToast: () => {} },
    },
  ];
}

export default {
  title: "Admin Console/Providers/Manage/Accept Provider",
  component: AcceptProviderComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    moduleMetadata({
      declarations: [AcceptProviderComponent],
      imports: [CommonModule, RouterModule, JslibModule, SvgModule, TypographyModule, ButtonModule],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter(routes, withHashLocation()),
      ],
    }),
  ],
} satisfies Meta<AcceptProviderComponent>;

type Story = StoryObj<AcceptProviderComponent>;

export const LoggedOut: Story = {
  decorators: [
    atUrl(ACCEPT_URL),
    moduleMetadata({ providers: storyProviders(AuthenticationStatus.LoggedOut) }),
  ],
};
