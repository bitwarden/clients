import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { DateRangePickerComponent } from "./date-range-picker.component";
import { DatetimeRangeFieldComponent } from "./datetime-range-field.component";

export default {
  title: "Prototypes/PAM/Date range picker",
  decorators: [
    moduleMetadata({
      imports: [DateRangePickerComponent, DatetimeRangeFieldComponent],
    }),
    applicationConfig({
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              loading: "Loading",
              close: "Close",
            }),
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj;

/**
 * The complete PAM-access flow — four field chips (start date, start time, end date, end time)
 * sharing one calendar popover. Clicking either date chip opens the picker with that endpoint
 * armed for the next click. Native `<input type="time">` handles time granularity.
 *
 * Defaults to today 09:00–17:00 so a same-day business-hours grant is one click away.
 */
export const AccessGrant: Story = {
  render: () => ({
    template: /* HTML */ `
      <div class="tw-p-12">
        <pam-datetime-range-field></pam-datetime-range-field>
      </div>
    `,
  }),
};

/** The raw calendar panel for layout review — bound to today, "end" editing mode. */
export const Panel: Story = {
  render: () => ({
    props: {
      today: new Date(),
    },
    template: /* HTML */ `
      <pam-date-range-picker
        [startDate]="today"
        [endDate]="today"
        editing="end"
      ></pam-date-range-picker>
    `,
  }),
};

/** Range already committed, picker in "edit end" mode. */
export const PanelWithRange: Story = {
  render: () => ({
    props: {
      start: new Date(2026, 9, 12),
      end: new Date(2026, 9, 24),
    },
    template: /* HTML */ `
      <pam-date-range-picker
        [startDate]="start"
        [endDate]="end"
        editing="end"
      ></pam-date-range-picker>
    `,
  }),
};
