import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService, MenuModule } from "@bitwarden/components";

import { PeriodSelectorComponent } from "./period-selector.component";
import { TimePeriod } from "./period-selector.types";

export default {
  title: "Web/Access Intelligence/Period Selector",
  component: PeriodSelectorComponent,
  decorators: [
    moduleMetadata({
      imports: [MenuModule, JslibModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              pastMonth: "Past month",
              last3Months: "Last 3 months",
              last6Months: "Last 6 months",
              last12Months: "Last 12 months",
              all: "All",
              timePeriod: "Time period",
            });
          },
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<PeriodSelectorComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <dirt-period-selector
        [(selectedPeriod)]="selectedPeriod"
      ></dirt-period-selector>
      <p class="tw-mt-4 tw-text-sm tw-text-muted">Selected: {{ selectedPeriod }}</p>
    `,
  }),
  args: {
    selectedPeriod: TimePeriod.PastMonth,
  },
};

export const PreSelected3Months: Story = {
  render: (args) => ({
    props: args,
    template: `
      <dirt-period-selector
        [(selectedPeriod)]="selectedPeriod"
      ></dirt-period-selector>
      <p class="tw-mt-4 tw-text-sm tw-text-muted">Selected: {{ selectedPeriod }}</p>
    `,
  }),
  args: {
    selectedPeriod: TimePeriod.Last3Months,
  },
};

export const Disabled: Story = {
  render: (args) => ({
    props: args,
    template: `
      <dirt-period-selector
        [(selectedPeriod)]="selectedPeriod"
        [disabled]="true"
      ></dirt-period-selector>
    `,
  }),
  args: {
    selectedPeriod: TimePeriod.PastMonth,
  },
};
