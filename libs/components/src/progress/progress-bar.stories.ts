import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { FormFieldModule } from "../form-field";
import { I18nMockService } from "../utils/i18n-mock.service";

import { ProgressBarComponent } from "./progress-bar.component";

export default {
  title: "Component Library/Progress/Progress Bar",
  component: ProgressBarComponent,
  decorators: [
    moduleMetadata({
      imports: [FormFieldModule],
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
        <bit-progress-bar variant="primary" [value]="20" [hideStartHint]="true">
          <bit-label slot="label">primary</bit-label>
        </bit-progress-bar>
        <bit-progress-bar variant="subtle" [value]="40" [hideStartHint]="true">
          <bit-label slot="label">subtle</bit-label>
        </bit-progress-bar>
        <bit-progress-bar variant="success" [value]="60" [hideStartHint]="true">
          <bit-label slot="label">success</bit-label>
        </bit-progress-bar>
        <bit-progress-bar variant="warning" [value]="80" [hideStartHint]="true">
          <bit-label slot="label">warning</bit-label>
        </bit-progress-bar>
        <bit-progress-bar variant="danger" [value]="100" [hideStartHint]="true">
          <bit-label slot="label">danger</bit-label>
        </bit-progress-bar>
      </div>
    `,
  }),
};

export const WithLabelAndHelperHint: Story = {
  render: () => ({
    template: `
      <div class="tw-w-[552px]">
        <bit-progress-bar [value]="50">
          <bit-label slot="label">File name</bit-label>
          <bit-hint slot="start">50% complete</bit-hint>
          <bit-hint slot="end">50MB</bit-hint>
        </bit-progress-bar>
      </div>
    `,
  }),
};

export const StartHint: Story = {
  render: () => ({
    template: `
      <div class="tw-w-[552px] tw-mb-8">
        <bit-progress-bar [value]="10">
          <bit-label slot="label">Default</bit-label>
        </bit-progress-bar>
      </div>
      <div class="tw-w-[552px] tw-mb-8">
        <bit-progress-bar [value]="10" [hideStartHint]="true">
          <bit-label slot="label">Without Start Hint</bit-label>
        </bit-progress-bar>
      </div>
      <div class="tw-flex tw-flex-col tw-w-[552px] tw-gap-4">
        <bit-progress-bar variant="danger" [value]="25">
          <bit-label slot="label">danger</bit-label>
          <bit-hint slot="start">Weak</bit-hint>
        </bit-progress-bar>
        <bit-progress-bar variant="warning" [value]="50">
          <bit-label slot="label">warning</bit-label>
          <bit-hint slot="start">Weak2</bit-hint>
        </bit-progress-bar>
        <bit-progress-bar variant="primary" [value]="75">
          <bit-label slot="label">primary</bit-label>
          <bit-hint slot="start">Good</bit-hint>
        </bit-progress-bar>
        <bit-progress-bar variant="success" [value]="100">
          <bit-label slot="label">success</bit-label>
          <bit-hint slot="start">Strong</bit-hint>
        </bit-progress-bar>
      </div>
    `,
  }),
};
