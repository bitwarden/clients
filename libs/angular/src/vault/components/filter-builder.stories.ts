import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { FilterBuilderComponent } from "./filter-builder.component";

export default {
  title: "Filter/Filter Builder",
  component: FilterBuilderComponent,
  decorators: [
    moduleMetadata({
      imports: [],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({
            multiSelectLoading: "Loading",
            multiSelectNotFound: "Not Found",
            multiSelectClearAll: "Clear All",
          }),
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<FilterBuilderComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <app-filter-builder></app-filter-builder>
    `,
  }),
};
