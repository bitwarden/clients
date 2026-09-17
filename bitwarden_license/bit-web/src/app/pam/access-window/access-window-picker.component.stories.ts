import { JsonPipe } from "@angular/common";
import { importProvidersFrom } from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { Meta, StoryObj, applicationConfig, moduleMetadata } from "@storybook/angular";

import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";

import { provideStoryChangeDetection } from "../testing/story-fixtures";

import { type AccessWindowFormValue, defaultAccessWindow } from "./access-window";
import { AccessWindowPickerComponent } from "./access-window-picker.component";

const HOUR = 60 * 60;

type PickerArgs = {
  /** Milliseconds, the shape Storybook's date control hands back. */
  now?: number;
  maxWindowSeconds: number;
  defaultSeconds: number;
};

/**
 * The picker in isolation, with the two things its whole shape depends on under the Controls
 * panel: the governing rule's cap, and the clock.
 *
 * The cap is what every suggestion is filtered against, so the same picker offers a very
 * different list under a 30-minute rule than under a 24-hour one.
 *
 * The clock is the other axis, and it is not observable from a story that can only ever be
 * rendered "now": the Start ladder reads relatively on today and as a wall-clock ladder on any
 * other day, it shortens as the day runs out, the day calendars floor on today, and the End
 * anchors (end of the working day, midnight, the next day's midday) fall inside or outside the
 * cap depending on the hour the request is made. **Current time** pins all of that, so a Friday
 * evening or the last ten minutes of a day can be reviewed on a Tuesday morning. Clear it and the
 * picker goes back to the real clock, which is what every real surface gives it.
 *
 * Each story renders the control's live value underneath — what the request would actually carry
 * — so a reviewer can check that what the labels say and what gets submitted agree.
 */
const meta: Meta<PickerArgs> = {
  title: "Web/PAM/Access Window Picker",
  component: AccessWindowPickerComponent,
  decorators: [
    applicationConfig({
      providers: [provideStoryChangeDetection(), importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
    moduleMetadata({ imports: [AccessWindowPickerComponent, JsonPipe, ReactiveFormsModule] }),
  ],
  argTypes: {
    now: {
      name: "Current time",
      control: "date",
      description:
        "The instant the picker treats as now, and the instant its window is seeded from. " +
        "Leave it blank to follow the real clock.",
    },
    maxWindowSeconds: {
      name: "Rule cap (seconds)",
      control: { type: "number", min: 60, step: 60 },
      description: "The governing rule's maximum window. Every suggestion is filtered to it.",
    },
    defaultSeconds: { table: { disable: true } },
  },
  render: ({ now, maxWindowSeconds, defaultSeconds }) => {
    const pinned = now == null ? null : new Date(now);
    // Re-seeded on every render, so moving the clock moves the window with it rather than
    // leaving yesterday's value in a control the picker now reads as elapsed.
    const control = new FormControl<AccessWindowFormValue>(
      defaultAccessWindow(pinned ?? new Date(), defaultSeconds, maxWindowSeconds),
      { nonNullable: true },
    );
    return {
      props: { control, maxWindowSeconds, now: pinned },
      template: /* HTML */ `
        <app-pam-access-window-picker
          [formControl]="control"
          [maxWindowSeconds]="maxWindowSeconds"
          [now]="now"
        />
        <pre
          class="tw-mt-6 tw-rounded-lg tw-bg-bg-secondary tw-p-3 tw-text-xs tw-text-fg-body-subtle"
        >
{{ control.value | json }}
status: {{ control.status }} {{ control.errors | json }}</pre>
      `,
    };
  },
};

export default meta;

type Story = StoryObj<PickerArgs>;

/** A rule capping requests at a day, defaulting to an hour — the common case, on the real clock. */
export const OneDayRule: Story = {
  args: { maxWindowSeconds: 24 * HOUR, defaultSeconds: HOUR },
};

/**
 * A four-hour rule. Everything past the cap drops out of the End menu, including the natural
 * points: no midnight, no next-day midday, and end-of-work-day only when it happens to fall
 * inside four hours of the start.
 */
export const FourHourRule: Story = {
  args: { maxWindowSeconds: 4 * HOUR, defaultSeconds: HOUR },
};

/**
 * The narrow extreme — a thirty-minute rule. Only one End suggestion survives the cap, which is
 * the honest answer: under this rule there is exactly one window to ask for.
 */
export const ThirtyMinuteRule: Story = {
  args: { maxWindowSeconds: 30 * 60, defaultSeconds: 30 * 60 },
};

/**
 * A Friday at 5pm, which is the clock that makes the End anchors read oddest: the next day's
 * midday lands on a Saturday. Whether that should skip to the Monday is an open product question
 * — this story is where to look at it.
 */
export const FridayEvening: Story = {
  args: {
    now: new Date(2026, 8, 18, 17, 0).getTime(),
    maxWindowSeconds: 24 * HOUR,
    defaultSeconds: HOUR,
  },
};

/**
 * Twenty minutes before midnight. The Start ladder cannot step past the end of the day without
 * contradicting the day beside it, so it shortens to what is left of the grid — the one state
 * that is unreachable from a story rendered at any other hour.
 */
export const LastMinutesOfTheDay: Story = {
  args: {
    now: new Date(2026, 8, 16, 23, 40).getTime(),
    maxWindowSeconds: 24 * HOUR,
    defaultSeconds: HOUR,
  },
};
