import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";

import { PreloadedEnglishI18nModule } from "../../../../../../core/tests";

import { IntegrationCardComponent } from "./integration-card.component";

class MockThemeService implements Partial<ThemeStateService> {}

export default {
  title: "Web/Integration Layout/Integration Card",
  component: IntegrationCardComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
    moduleMetadata({
      providers: [
        {
          provide: ThemeStateService,
          useClass: MockThemeService,
        },
        {
          provide: SYSTEM_THEME_OBSERVABLE,
          useValue: of(ThemeTypes.Light),
        },
      ],
    }),
  ],
  args: {
    integrations: [],
  },
} as Meta;

type Story = StoryObj<IntegrationCardComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
    <app-integration-card
      [name]="name"
      [image]="image"
      [linkURL]="linkURL"
    ></app-integration-card>
      `,
  }),
  args: {
    name: "Bitwarden",
    image: "/integrations/bitwarden-vertical-blue.svg",
    linkURL: "https://bitwarden.com",
  },
};
