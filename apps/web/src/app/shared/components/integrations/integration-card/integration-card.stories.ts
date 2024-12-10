import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { I18nMockService } from "@bitwarden/components";

import { SharedModule } from "../../../shared.module";

import { IntegrationCardComponent } from "./integration-card.component";

class MockThemeService implements Partial<ThemeStateService> {}

export default {
  title: "Web/Integration Layout/Integration Card",
  component: IntegrationCardComponent,
  decorators: [
    moduleMetadata({
      imports: [SharedModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({});
          },
        },
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
