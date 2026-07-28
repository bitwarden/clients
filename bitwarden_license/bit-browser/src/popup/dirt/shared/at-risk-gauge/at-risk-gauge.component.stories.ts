import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nMockService } from "@bitwarden/components";

import { AtRiskGaugeComponent } from "./at-risk-gauge.component";

export default {
  title: "Browser/DIRT/At-Risk Gauge",
  component: AtRiskGaugeComponent,
  decorators: [
    moduleMetadata({
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              atRisk: "at risk",
              atRiskPasswords: "At-risk passwords",
            }),
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/JZf3F2PRqB7HhflAybw2Xe/Premium-end-user-health?node-id=734-8655",
    },
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
  args: {
    value: 37,
    total: 100,
  },
} as Meta<AtRiskGaugeComponent>;

type Story = StoryObj<AtRiskGaugeComponent>;

/** At-risk: any positive value renders a red fill proportional to value / total. */
export const AtRisk: Story = {
  args: {
    value: 37,
    total: 100,
  },
};

/** Healthy: value 0 renders a full green ring at 0%. */
export const Healthy: Story = {
  args: {
    value: 0,
    total: 100,
  },
};

/** Fully at risk: value equals total renders a complete red ring at 100%. */
export const FullyAtRisk: Story = {
  args: {
    value: 100,
    total: 100,
  },
};

/** Edge case: total of 0 renders an empty, green gauge at 0% without error. */
export const ZeroTotal: Story = {
  args: {
    value: 0,
    total: 0,
  },
};
