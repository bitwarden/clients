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
    barWidth: 50,
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
        <bit-progress-bar ${formatArgsForCodeSnippet<ProgressBarComponent>(args)} aria-valuemin="0" aria-valuemax="100" aria-valuetext="${args.barWidth}% complete" />
      </div>
    `,
  }),
};

export const AllVariants: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-col tw-w-[552px] tw-gap-4">
        <bit-progress-bar variant="primary" label="primary" [barWidth]="20" [showStartText]=false aria-valuemin="0" aria-valuemax="100" aria-valuetext="20% complete" />
        <bit-progress-bar variant="subtle" label="subtle" [barWidth]=40 [showStartText]=false aria-valuemin="0" aria-valuemax="100" aria-valuetext="40% complete" />
        <bit-progress-bar variant="success" label="success" [barWidth]=60 [showStartText]=false aria-valuemin="0" aria-valuemax="100" aria-valuetext="60% complete" />
        <bit-progress-bar variant="warning" label="warning" [barWidth]=80 [showStartText]=false aria-valuemin="0" aria-valuemax="100" aria-valuetext="80% complete" />
        <bit-progress-bar variant="danger" label="danger" [barWidth]=100 [showStartText]=false aria-valuemin="0" aria-valuemax="100" aria-valuetext="100% complete" />
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
        <bit-progress-bar label="Default" [barWidth]=10 aria-valuemin="0" aria-valuemax="100" aria-valuetext="10% complete" />
      </div>
      <div class="tw-flex tw-flex-col tw-w-[552px] tw-gap-4">
        <bit-progress-bar variant="danger" label="danger" [barWidth]=25 startText="Weak" aria-valuemin="0" aria-valuemax="100" aria-valuetext="25% complete" />
        <bit-progress-bar variant="warning" label="warning" [barWidth]=50 startText="Weak2" aria-valuemin="0" aria-valuemax="100" aria-valuetext="50% complete" />
        <bit-progress-bar variant="primary" label="primary" [barWidth]=75 startText="Good" aria-valuemin="0" aria-valuemax="100" aria-valuetext="75% complete" />
        <bit-progress-bar variant="success" label="success" [barWidth]=100 startText="Strong" aria-valuemin="0" aria-valuemax="100" aria-valuetext="100% complete" />
      </div>
    `,
  }),
};
