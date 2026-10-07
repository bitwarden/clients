import { CommonModule } from "@angular/common";
import { importProvidersFrom } from "@angular/core";
import { provideRouter, RouterModule, Routes, withHashLocation } from "@angular/router";
import { applicationConfig, Decorator, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { of } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ButtonModule, CardComponent, SvgModule } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { SetupProviderComponent } from "./setup-provider.component";

const routes: Routes = [{ path: "setup-provider", component: SetupProviderComponent }];

const atUrl =
  (url: string): Decorator =>
  (storyFn, context) => {
    window.location.hash = url;
    return storyFn(context);
  };

const SETUP_PROVIDER_URL =
  "/setup-provider?providerId=provider-1&email=jane%40example.com&token=story-token";

function storyProviders(authStatus: AuthenticationStatus) {
  return [{ provide: AuthService, useValue: { activeAccountStatus$: of(authStatus) } }];
}

export default {
  title: "Admin Console/Providers/Setup/Setup Provider",
  component: SetupProviderComponent,
  render: () => ({ template: `<router-outlet></router-outlet>` }),
  decorators: [
    moduleMetadata({
      declarations: [SetupProviderComponent],
      imports: [CommonModule, RouterModule, JslibModule, SvgModule, CardComponent, ButtonModule],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(PreloadedEnglishI18nModule),
        provideRouter(routes, withHashLocation()),
        { provide: PlatformUtilsService, useValue: { isSelfHost: () => false } },
      ],
    }),
  ],
} satisfies Meta<SetupProviderComponent>;

type Story = StoryObj<SetupProviderComponent>;

export const LoggedOut: Story = {
  decorators: [
    atUrl(SETUP_PROVIDER_URL),
    moduleMetadata({ providers: storyProviders(AuthenticationStatus.LoggedOut) }),
  ],
};
