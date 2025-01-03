import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";
import { of } from "rxjs";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { IntegrationType } from "@bitwarden/common/enums";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";

import { PreloadedEnglishI18nModule } from "../../../../../../core/tests";
import { IntegrationCardComponent } from "../integration-card/integration-card.component";
import { IntegrationGridComponent } from "../integration-grid/integration-grid.component";

class MockThemeService implements Partial<ThemeStateService> {}

export default {
  title: "Web/Integration Layout/Integration Grid",
  component: IntegrationGridComponent,
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
    moduleMetadata({
      imports: [IntegrationCardComponent],
      providers: [
        {
          provide: ThemeStateService,
          useClass: MockThemeService,
        },
        {
          provide: SYSTEM_THEME_OBSERVABLE,
          useValue: of(ThemeTypes.Dark),
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<IntegrationGridComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <app-integration-grid [integrations]="integrations"></app-integration-grid>
      `,
  }),
  args: {
    integrations: [
      {
        name: "Card 1",
        linkURL: "https://bitwarden.com",
        image: "/integrations/bitwarden-vertical-blue.svg",
        type: IntegrationType.SSO,
      },
      {
        name: "Card 2",
        linkURL: "https://bitwarden.com",
        image: "/integrations/bitwarden-vertical-blue.svg",
        type: IntegrationType.SDK,
      },
      {
        name: "Card 3",
        linkURL: "https://bitwarden.com",
        image: "/integrations/bitwarden-vertical-blue.svg",
        type: IntegrationType.SCIM,
      },
    ],
  },
};
