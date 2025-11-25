import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ConsoleLogService } from "@bitwarden/common/platform/services/console-log.service";

import { I18nMockService } from "../utils/i18n-mock.service";

import { I18nComponent } from "./i18n.component";
import { I18nModule } from "./i18n.module";

export default {
  title: "Component Library/I18n Templates",
  component: I18nComponent,
  decorators: [
    moduleMetadata({
      imports: [I18nModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              basicExample: `
              This is an example with <0>link</0> tags and <1>bold</1> tags. The entire sentence
              can be <2>translated as a whole</2> and re-arranged according to each language's grammar rules.`,
              otherExample: `
              This is another example with <1>bold</1> tags to show that tag order does not matter
              and the <0>link</0> tags are after.`,
              argExample: (arg1: string) => `This is an example with <0>link</0> tags and ${arg1}.`,
            });
          },
        },
        {
          provide: LogService,
          useFactory: () => new ConsoleLogService(true),
        },
      ],
    }),
  ],
  args: {},
  parameters: {},
} as Meta;

type Story = StoryObj<I18nComponent>;

export const Basic: Story = {
  render: (args) => ({
    props: args,
    template: `
<div bit-i18n="basicExample">
  <a *bit-i18n-part="let text" href="javascript:;">{{ text }}</a>
  <strong *bit-i18n-part="let text">{{ text }}</strong>
  <a *bit-i18n-part="let text" href="https://localization.blog/2022/05/16/i18n-best-practices-keep-it-together/">
    <strong>{{ text }}</strong>
  </a>
</div>
    `,
  }),
};

export const ArgsExample: Story = {
  render: (args) => ({
    props: args,
    template: `
<p bit-i18n="argExample" [args]="['passed args']">
  <a *bit-i18n-part="let text" href="javascript:;">{{ text }}</a>
  <strong *bit-i18n-part="let text">{{ text }}</strong>
</p>
    `,
  }),
};

export const MissingTemplate: Story = {
  render: (args) => ({
    props: args,
    template: `
<p bit-i18n="basicExample">
  <a *bit-i18n-part="let text" href="javascript:;">{{ text }}</a>
  <strong *bit-i18n-part="let text">{{ text }}</strong>
</p>
    `,
  }),
};
