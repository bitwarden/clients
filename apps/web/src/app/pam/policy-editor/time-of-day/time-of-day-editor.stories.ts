import { importProvidersFrom } from "@angular/core";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { TimeWindow } from "@bitwarden/pam";

import { PreloadedEnglishI18nModule } from "../../../core/tests";

import { TimeOfDayEditorComponent } from "./time-of-day-editor.component";

export default {
  title: "Web/PAM/Policy Editor/Time Of Day",
  component: TimeOfDayEditorComponent,
  decorators: [
    moduleMetadata({
      imports: [TimeOfDayEditorComponent],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
} as Meta;

type Story = StoryObj<TimeOfDayEditorComponent>;

export const DefaultSingleWindow: Story = {
  render: (args) => ({
    props: args,
    template: /* HTML */ `
      <pam-time-of-day-editor
        initialTz="America/New_York"
      ></pam-time-of-day-editor>
    `,
  }),
};

export const MultiWindowBusinessHoursAndWeekend: Story = {
  render: () => {
    const windows: TimeWindow[] = [
      { daysOfWeek: [1, 2, 3, 4, 5], from: "09:00", to: "17:00" },
      { daysOfWeek: [0, 6], from: "10:00", to: "14:00" },
    ];
    return {
      props: { initialWindows: windows },
      template: /* HTML */ `
        <pam-time-of-day-editor
          initialTz="America/Chicago"
          [initialWindows]="initialWindows"
        ></pam-time-of-day-editor>
      `,
    };
  },
};

export const ReadOnly: Story = {
  render: () => {
    const windows: TimeWindow[] = [
      { daysOfWeek: [1, 2, 3, 4, 5], from: "08:30", to: "17:30" },
    ];
    return {
      props: { initialWindows: windows },
      template: /* HTML */ `
        <pam-time-of-day-editor
          initialTz="Europe/London"
          [initialWindows]="initialWindows"
          [disabled]="true"
        ></pam-time-of-day-editor>
      `,
    };
  },
};
