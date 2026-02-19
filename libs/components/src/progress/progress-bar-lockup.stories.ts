import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { SpotReport } from "@bitwarden/assets/svg";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { SvgComponent } from "../svg/svg.component";

import { ProgressBarLockupComponent } from "./progress-bar-lockup.component";

const illustration = SpotReport;

export default {
  title: "Component Library/Progress Bar Lockup",
  component: ProgressBarLockupComponent,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-40933&t=b5tDKylm5sWm2yKo-4",
    },
  },
  args: {
    variant: "primary",
    progressAmount: 50,
  },
} as Meta;

type Story = StoryObj<ProgressBarLockupComponent>;

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
        <bit-progress-bar-lockup ${formatArgsForCodeSnippet<ProgressBarLockupComponent>(args)}>
          <ng-container slot="illustration">
            <bit-svg [content]="illustration" aria-hidden="true" class="tw-w-[120px]" />
          </ng-container>
        </bit-progress-bar-lockup>
      </div>
    `,
  }),
  args: {
    variant: "primary",
    progressAmount: 50,
    label: "File name",
    startText: "50% complete",
    endText: "50MB",
    title: "Uploading file",
    subtitle: "This might take a few minutes.",
  },
};
