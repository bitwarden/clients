import { importProvidersFrom, signal } from "@angular/core";
import {
  applicationConfig,
  componentWrapperDecorator,
  Meta,
  moduleMetadata,
  StoryObj,
} from "@storybook/angular";
import { BehaviorSubject } from "rxjs";
import { userEvent, within } from "storybook/test";

import { SYSTEM_THEME_OBSERVABLE } from "@bitwarden/angular/services/injection-tokens";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { IconButtonModule, ToastService } from "@bitwarden/components";
import { PreloadedEnglishI18nModule } from "@bitwarden/web-vault/app/core/tests";
import { WebFileDownloadService } from "@bitwarden/web-vault/app/core/web-file-download.service";

import { ChartExportService } from "../../../shared/chart-export.service";
import { TimePeriod } from "../period-selector/period-selector.types";

import { TrendWidgetComponent } from "./trend-widget.component";

// Create shared theme observables that will be updated by the decorator
const selectedTheme$ = new BehaviorSubject<ThemeType>(ThemeType.Light);
const systemTheme$ = new BehaviorSubject<ThemeType>(ThemeType.Light);

export default {
  title: "DIRT/Access Intelligence/Trend Widget",
  component: TrendWidgetComponent,
  decorators: [
    componentWrapperDecorator(
      (story) => story,
      ({ globals }) => {
        const theme = globals["theme"] === "dark" ? ThemeType.Dark : ThemeType.Light;
        selectedTheme$.next(theme);
        systemTheme$.next(theme);
        return {};
      },
    ),
    moduleMetadata({
      imports: [IconButtonModule],
      providers: [
        {
          provide: ThemeStateService,
          useValue: {
            selectedTheme$,
          },
        },
        {
          provide: SYSTEM_THEME_OBSERVABLE,
          useValue: systemTheme$,
        },
        {
          provide: PlatformUtilsService,
          useValue: {
            supportsFileDownloads: () => true,
          },
        },
        {
          provide: FileDownloadService,
          useClass: WebFileDownloadService,
        },
        ChartExportService,
        {
          provide: ToastService,
          useValue: {
            showToast: () => {},
          },
        },
      ],
    }),
    applicationConfig({
      providers: [importProvidersFrom(PreloadedEnglishI18nModule)],
    }),
  ],
  args: {
    data: {
      timeframe: TimePeriod.PastMonth,
      dataView: "applications",
      dataPoints: [
        { timestamp: "2026-02-13T00:00:00Z", atRisk: 38, total: 165 },
        { timestamp: "2026-02-14T00:00:00Z", atRisk: 42, total: 168 },
        { timestamp: "2026-02-15T00:00:00Z", atRisk: 40, total: 170 },
        { timestamp: "2026-02-16T00:00:00Z", atRisk: 45, total: 172 },
        { timestamp: "2026-02-17T00:00:00Z", atRisk: 48, total: 175 },
        { timestamp: "2026-02-18T00:00:00Z", atRisk: 52, total: 178 },
      ],
    },
    loading: false,
    error: null,
  },
  argTypes: {
    data: {
      description:
        "Data object containing timeframe, dataView, and dataPoints array with timestamp, atRisk, and total values",
      control: { type: "object" },
    },
    loading: {
      description: "Loading state indicator",
      control: { type: "boolean" },
    },
    error: {
      description: "Error message to display",
      control: { type: "text" },
    },
    viewChanged: {
      description: "Event emitted when the view selector (Applications/Passwords/Members) changes",
      action: "viewChanged",
    },
    timespanChanged: {
      description: "Event emitted when the timespan selector changes",
      action: "timespanChanged",
    },
  },
  parameters: {
    chromatic: { disableSnapshot: true },
    docs: {
      description: {
        component:
          "A widget component that displays trend data over time with configurable views and timespan filters. Supports Applications, Passwords, and Members views with various timespan options.",
      },
    },
  },
} as Meta<TrendWidgetComponent>;

type Story = StoryObj<TrendWidgetComponent>;

/**
 * Default example showing typical usage with a week's worth of data.
 */
export const Default: Story = {
  args: {
    data: {
      timeframe: TimePeriod.PastMonth,
      dataView: "applications",
      dataPoints: [
        { timestamp: "2026-02-13T00:00:00Z", atRisk: 38, total: 165 },
        { timestamp: "2026-02-14T00:00:00Z", atRisk: 42, total: 168 },
        { timestamp: "2026-02-15T00:00:00Z", atRisk: 40, total: 170 },
        { timestamp: "2026-02-16T00:00:00Z", atRisk: 45, total: 172 },
        { timestamp: "2026-02-17T00:00:00Z", atRisk: 48, total: 175 },
        { timestamp: "2026-02-18T00:00:00Z", atRisk: 52, total: 178 },
      ],
    },
    loading: false,
    error: null,
  },
};

/**
 * Loading state while data is being fetched.
 */
export const Loading: Story = {
  args: {
    data: {
      timeframe: TimePeriod.PastMonth,
      dataView: "applications",
      dataPoints: [],
    },
    loading: true,
    error: null,
  },
};

/**
 * Error state when data fetch fails.
 */
export const Error: Story = {
  args: {
    data: {
      timeframe: TimePeriod.PastMonth,
      dataView: "applications",
      dataPoints: [],
    },
    loading: false,
    error: "Failed to load trend data. Please try again later.",
  },
};

/**
 * Single data point - minimal chart data.
 */
export const SingleDataPoint: Story = {
  args: {
    data: {
      timeframe: TimePeriod.PastMonth,
      dataView: "passwords",
      dataPoints: [{ timestamp: "2026-02-18T00:00:00Z", atRisk: 45, total: 180 }],
    },
    loading: false,
    error: null,
  },
};

/**
 * Two data points.
 */
export const TwoDataPoints: Story = {
  args: {
    data: {
      timeframe: TimePeriod.PastMonth,
      dataView: "passwords",
      dataPoints: [
        { timestamp: "2026-02-18T00:00:00Z", atRisk: 45, total: 180 },
        { timestamp: "2026-02-20T00:00:00Z", atRisk: 60, total: 180 },
      ],
    },
    loading: false,
    error: null,
  },
};

/**
 * 24 data points showing a month of daily data with upward trend.
 */
export const TwentyFourDataPoints: Story = {
  args: {
    data: {
      timeframe: TimePeriod.PastMonth,
      dataView: "members",
      dataPoints: [
        { timestamp: "2026-01-20T00:00:00Z", atRisk: 120, total: 450 },
        { timestamp: "2026-01-21T00:00:00Z", atRisk: 122, total: 452 },
        { timestamp: "2026-01-22T00:00:00Z", atRisk: 125, total: 455 },
        { timestamp: "2026-01-23T00:00:00Z", atRisk: 123, total: 458 },
        { timestamp: "2026-01-24T00:00:00Z", atRisk: 128, total: 460 },
        { timestamp: "2026-01-25T00:00:00Z", atRisk: 130, total: 462 },
        { timestamp: "2026-01-26T00:00:00Z", atRisk: 132, total: 465 },
        { timestamp: "2026-01-27T00:00:00Z", atRisk: 135, total: 468 },
        { timestamp: "2026-01-28T00:00:00Z", atRisk: 138, total: 470 },
        { timestamp: "2026-01-29T00:00:00Z", atRisk: 140, total: 472 },
        { timestamp: "2026-01-30T00:00:00Z", atRisk: 142, total: 475 },
        { timestamp: "2026-01-31T00:00:00Z", atRisk: 145, total: 478 },
        { timestamp: "2026-02-01T00:00:00Z", atRisk: 148, total: 480 },
        { timestamp: "2026-02-02T00:00:00Z", atRisk: 150, total: 482 },
        { timestamp: "2026-02-03T00:00:00Z", atRisk: 152, total: 485 },
        { timestamp: "2026-02-04T00:00:00Z", atRisk: 155, total: 488 },
        { timestamp: "2026-02-05T00:00:00Z", atRisk: 158, total: 490 },
        { timestamp: "2026-02-06T00:00:00Z", atRisk: 160, total: 492 },
        { timestamp: "2026-02-07T00:00:00Z", atRisk: 162, total: 495 },
        { timestamp: "2026-02-08T00:00:00Z", atRisk: 165, total: 498 },
        { timestamp: "2026-02-09T00:00:00Z", atRisk: 168, total: 500 },
        { timestamp: "2026-02-10T00:00:00Z", atRisk: 170, total: 502 },
        { timestamp: "2026-02-11T00:00:00Z", atRisk: 172, total: 505 },
        { timestamp: "2026-02-12T00:00:00Z", atRisk: 175, total: 508 },
      ],
    },
    loading: false,
    error: null,
  },
};

const REFERENCE_TODAY = "2026-04-30T12:00:00Z";

/** Drives the period selector to "All time". */
async function selectAllTime(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  // The trigger button's accessible name comes from aria-label="Time period";
  // the visible "Past month" text is inside a child span and is not the a11y name.
  const periodTrigger = await canvas.findByRole("button", { name: /time period/i });
  await userEvent.click(periodTrigger);
  // Menu items are rendered into the CDK overlay container at document.body,
  // which is outside canvasElement, so query the document instead.
  const body = within(document.body);
  const allTimeOption = await body.findByRole("menuitem", { name: "All time" });
  await userEvent.click(allTimeOption);
}

/**
 * All time selected with two data points one calendar day apart.
 * Renders the narrowest multi-day window the chart supports.
 */
export const AllTimeNarrowSpan: Story = {
  render: (args) => ({
    props: {
      ...args,
      selectedTimespan: signal(TimePeriod.AllTime),
    },
  }),
  args: {
    data: {
      timeframe: TimePeriod.AllTime,
      dataView: "applications",
      dataPoints: [
        { timestamp: "2026-04-29T12:00:00Z", atRisk: 12, total: 50 },
        { timestamp: REFERENCE_TODAY, atRisk: 14, total: 50 },
      ],
    },
    loading: false,
    error: null,
  },
};

/**
 * All time selected with a single data point.
 * Renders the chart's behavior when only one report exists for the org.
 */
export const AllTimeSingleDay: Story = {
  render: (args) => ({
    props: {
      ...args,
      selectedTimespan: signal(TimePeriod.AllTime),
    },
  }),
  args: {
    data: {
      timeframe: TimePeriod.AllTime,
      dataView: "passwords",
      dataPoints: [{ timestamp: REFERENCE_TODAY, atRisk: 45, total: 180 }],
    },
    loading: false,
    error: null,
  },
};

/**
 * All time selected with data points spread across roughly six months.
 * Renders the wide-span case where the chart fits to the data range.
 */
export const AllTimeWideSpan: Story = {
  render: (args) => ({
    props: {
      ...args,
      selectedTimespan: signal(TimePeriod.AllTime),
    },
  }),
  args: {
    data: {
      timeframe: TimePeriod.AllTime,
      dataView: "members",
      dataPoints: [
        { timestamp: "2025-10-30T12:00:00Z", atRisk: 80, total: 400 },
        { timestamp: "2026-01-30T12:00:00Z", atRisk: 95, total: 410 },
        { timestamp: "2026-03-30T12:00:00Z", atRisk: 110, total: 420 },
        { timestamp: REFERENCE_TODAY, atRisk: 130, total: 430 },
      ],
    },
    loading: false,
    error: null,
  },
};

/**
 * Starts in Past month and clicks the period selector to "All time".
 * Excluded from autodocs and Chromatic.
 */
export const AllTimeFullFlow: Story = {
  tags: ["!autodocs"],
  parameters: { chromatic: { disableSnapshot: true } },
  args: {
    data: {
      timeframe: TimePeriod.PastMonth,
      dataView: "applications",
      dataPoints: [
        { timestamp: "2026-04-29T12:00:00Z", atRisk: 12, total: 50 },
        { timestamp: REFERENCE_TODAY, atRisk: 14, total: 50 },
      ],
    },
    loading: false,
    error: null,
  },
  play: async ({ canvasElement }) => {
    await selectAllTime(canvasElement);
  },
};
