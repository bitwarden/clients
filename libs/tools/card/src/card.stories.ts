import { CommonModule } from "@angular/common";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService, TypographyModule } from "@bitwarden/components";

import { CardComponent } from "./card.component";

export default {
  title: "Tools/Card",
  component: CardComponent,
  decorators: [
    moduleMetadata({
      imports: [CardComponent, CommonModule, TypographyModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              cardMetrics: (value) => `out of ${value}`,
            }),
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<CardComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <tools-card [title]="'Unsecured Members'" [value]="'38'" [maxValue]="'157'"></tools-card>`,
  }),
};
