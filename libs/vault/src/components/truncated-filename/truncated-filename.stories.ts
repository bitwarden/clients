import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { TruncatedFilenameComponent } from "./truncated-filename.component";

export default {
  title: "Vault/Truncated Filename",
  component: TruncatedFilenameComponent,
  decorators: [
    moduleMetadata({
      imports: [TruncatedFilenameComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }),
  ],
} as Meta;

type Story = StoryObj<TruncatedFilenameComponent>;

const samples: [label: string, filename: string][] = [
  ["Normal filename (no truncation)", "quarterly-report.pdf"],
  ["Long base, short extension", "ThisIsAVeryLongFileNameThatNeedsToTruncate.jpg"],
  ["Long base, long extension", "ThisIsAVeryLongFileNameThatNeedsToTruncate.superlongextensionjpg"],
  ["Extension dominates filename", "a.extremely-long-custom-extension"],
  ["No extension", "a-very-long-filename-without-any-extension"],
  ["Multi-dot extension (.tar.gz)", "my-archive-backup-2024-01-15.tar.gz"],
  ["Hidden file (leading dot)", ".a-very-long-hidden-file-name-in-unix"],
];

export const Default: Story = {
  render: () => ({
    template: `
      <div class="tw-flex tw-flex-col tw-gap-4 tw-text-main">
        ${samples
          .map(
            ([label, name], i) => `
              <div>
                <div class="tw-text-xs tw-text-muted tw-mb-1">${i + 1}. ${label}</div>
                <div
                  class="tw-flex tw-border tw-border-solid tw-border-secondary-300 tw-rounded tw-p-2"
                  style="resize: horizontal; overflow: auto; width: 250px; max-width: 100%; min-width: 80px;"
                >
                  <bit-truncated-filename filename="${name}" />
                </div>
              </div>
            `,
          )
          .join("")}
      </div>
    `,
  }),
};
