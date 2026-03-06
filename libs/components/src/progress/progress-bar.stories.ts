import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { I18nMockService } from "../utils/i18n-mock.service";

import { ProgressBarComponent } from "./progress-bar.component";

export default {
  title: "Component Library/Progress/Progress Bar",
  component: ProgressBarComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              percentageCompleted: "__$1__% complete",
            });
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-40933&t=b5tDKylm5sWm2yKo-4",
    },
  },
  args: {
    variant: "primary",
    value: "50",
  },
} as Meta;

type Story = StoryObj<ProgressBarComponent>;

export const Base: Story = {
  render: (args) => ({
    props: {
      ...args,
    },
    template: `
      <div class="tw-w-[552px]">
        <bit-progress-bar ${formatArgsForCodeSnippet<ProgressBarComponent>(args)} />
      </div>
    `,
  }),
};

export const AllVariants: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-col tw-w-[552px] tw-gap-4">
        <bit-progress-bar variant="primary" label="primary" [value]="20" [startText]="null" />
        <bit-progress-bar variant="subtle" label="subtle" [value]="40" [startText]="null" />
        <bit-progress-bar variant="success" label="success" [value]="60" [startText]="null" />
        <bit-progress-bar variant="warning" label="warning" [value]="80" [startText]="null" />
        <bit-progress-bar variant="danger" label="danger" [value]="100" [startText]="null" />
      </div>
    `,
  }),
};

export const WithLabelAndHelperText: Story = {
  ...Base,
  args: {
    ...Base.args,
    label: "File name",
    startText: "50% complete",
    endText: "50MB",
  },
};

export const StartText: Story = {
  render: () => ({
    template: `
      <div class="tw-w-[552px] tw-mb-8">
        <bit-progress-bar label="Default" [value]="10" />
      </div>
      <div class="tw-w-[552px] tw-mb-8">
        <bit-progress-bar label="Without Start Text" [value]="10" [startText]="null" />
      </div>
      <div class="tw-flex tw-flex-col tw-w-[552px] tw-gap-4">
        <bit-progress-bar variant="danger" label="danger" [value]="25" startText="Weak" />
        <bit-progress-bar variant="warning" label="warning" [value]="50" startText="Weak2" />
        <bit-progress-bar variant="primary" label="primary" [value]="75" startText="Good" />
        <bit-progress-bar variant="success" label="success" [value]="100" startText="Strong" />
      </div>
    `,
  }),
};
