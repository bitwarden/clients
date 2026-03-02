import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { SpotReport } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";
import { SvgComponent } from "../svg/svg.component";
import { I18nMockService } from "../utils/i18n-mock.service";

import { ProgressBarLockupComponent } from "./progress-bar-lockup.component";
import { ProgressBarComponent } from "./progress-bar.component";

const illustration = SpotReport;

export default {
  title: "Component Library/Progress/Progress Bar Lockup",
  component: ProgressBarLockupComponent,
  decorators: [
    moduleMetadata({
      imports: [ProgressBarComponent],
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
          <bit-progress-bar
            [value]="50"
            label="File name"
            startText="50% complete"
            endText="50MB"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="50"
            aria-valuetext="50% complete"
          />
        </bit-progress-bar-lockup>
      </div>
    `,
  }),
  args: {
    title: "Uploading file",
    subtitle: "This might take a few minutes.",
  },
};
