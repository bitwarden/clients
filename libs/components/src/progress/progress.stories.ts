import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { SpotReport } from "@bitwarden/assets/svg";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { SvgComponent } from "../svg/svg.component";

import { ProgressBarComponent } from "./progress.component";

const illustration = SpotReport;

export default {
  title: "Component Library/Progress Bar",
  component: ProgressBarComponent,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-40933&t=b5tDKylm5sWm2yKo-4",
    },
  },
  args: {
    variant: "primary",
    showLabel: false,
    label: "File name",
    progressAmount: 50,
    showLeftText: false,
    customLeftText: undefined,
    showRightText: false,
    rightText: "50MB",
    showIllustration: false,
    showTitle: false,
    title: "Uploading file",
    showSubtitle: false,
    subtitle: "This might take a few minutes.",
  },
} as Meta;

type Story = StoryObj<ProgressBarComponent>;

export const Base: Story = {
  decorators: [
    moduleMetadata({
      imports: [SvgComponent],
    }),
  ],
  render: (args) => ({
    props: {
      ...args,
      illustration,
    },
    template: `
      <div class="tw-w-[552px]">
        <bit-progress ${formatArgsForCodeSnippet<ProgressBarComponent>(args)}>
          <ng-container slot="illustration">
            <bit-svg [content]="illustration" aria-hidden="true" />
          </ng-container>
        </bit-progress>
      </div>
    `,
  }),
};

export const AllVariants: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-col tw-w-[552px] tw-gap-4">
        <bit-progress variant="primary" showLabel="true" label="primary" [progressAmount]=20></bit-progress>
        <bit-progress variant="subtle" showLabel="true" label="subtle" [progressAmount]=40></bit-progress>
        <bit-progress variant="success" showLabel="true" label="success" [progressAmount]=60></bit-progress>
        <bit-progress variant="warning" showLabel="true" label="warning" [progressAmount]=80></bit-progress>
        <bit-progress variant="danger" showLabel="true" label="danger" [progressAmount]=100></bit-progress>
      </div>
    `,
  }),
};

export const WithLabelAndHelperText: Story = {
  ...Base,
  args: {
    ...Base.args,
    showLabel: true,
    showLeftText: true,
    showRightText: true,
  },
};

export const WithIllustrationAndHeader: Story = {
  ...Base,
  args: {
    ...Base.args,
    showLabel: true,
    showLeftText: true,
    showRightText: true,
    showTitle: true,
    showSubtitle: true,
    showIllustration: true,
  },
};

export const Empty: Story = {
  ...Base,
  args: {
    showLabel: true,
    label: "File name",
    progressAmount: 0,
    showLeftText: false,
    customLeftText: undefined,
    showRightText: false,
    rightText: "50MB",
  },
};

export const Full: Story = {
  ...Base,
  args: {
    progressAmount: 100,
  },
};

export const CustomText: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-col tw-w-[552px] tw-gap-4">
        <bit-progress variant="danger" label="danger" [progressAmount]=25 showLeftText="true" customLeftText="Weak"></bit-progress>
        <bit-progress variant="warning" label="warning" [progressAmount]=50 showLeftText="true" customLeftText="Weak2"></bit-progress>
        <bit-progress variant="primary" label="primary" [progressAmount]=75 showLeftText="true" customLeftText="Good"></bit-progress>
        <bit-progress variant="success" label="success" [progressAmount]=100 showLeftText="true" customLeftText="Strong"></bit-progress>
      </div>
    `,
  }),
};
