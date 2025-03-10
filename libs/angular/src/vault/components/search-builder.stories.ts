import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { SearchBuilderComponent } from "./search-builder.component";

export default {
  title: "Search/Search Builder",
  component: SearchBuilderComponent,
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

type Story = StoryObj<SearchBuilderComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <app-search-builder></app-search-builder>
    `,
  }),
};
