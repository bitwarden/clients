import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import { typography, TypographyVariant } from "./typography";

type Row = {
  variant: TypographyVariant;
  classes?: string;
  weight: string;
  size: number;
};

const rows: Row[] = [
  { variant: "h1", weight: "Medium", size: 30 },
  { variant: "h2", weight: "Medium", size: 24 },
  { variant: "h3", weight: "Medium", size: 20 },
  { variant: "h4", weight: "Medium", size: 18 },
  { variant: "h5", weight: "Medium", size: 16 },
  { variant: "h6", weight: "Medium", size: 14 },
  { variant: "body1", weight: "Regular", size: 16 },
  { variant: "body1", classes: "tw-font-medium", weight: "Medium", size: 16 },
  { variant: "body1", classes: "tw-font-semibold", weight: "Semibold", size: 16 },
  { variant: "body1", classes: "tw-underline", weight: "Regular", size: 16 },
  { variant: "body2", weight: "Regular", size: 14 },
  { variant: "body2", classes: "tw-font-medium", weight: "Medium", size: 14 },
  { variant: "body2", classes: "tw-font-semibold", weight: "Semibold", size: 14 },
  { variant: "body2", classes: "tw-underline", weight: "Regular", size: 14 },
  { variant: "helper", weight: "Regular", size: 12 },
  { variant: "helper", classes: "tw-font-medium", weight: "Medium", size: 12 },
  { variant: "helper", classes: "tw-font-semibold", weight: "Semibold", size: 12 },
  { variant: "helper", classes: "tw-underline", weight: "Regular", size: 12 },
  { variant: "body1", classes: "tw-font-mono tw-text-code", weight: "Regular", size: 16 },
  { variant: "body2", classes: "tw-font-mono tw-text-code", weight: "Regular", size: 14 },
  { variant: "helper", classes: "tw-font-mono tw-text-code", weight: "Regular", size: 12 },
];

type Args = { text: string };

export default {
  title: "Component Library/Typography",
  component: "bit-typography",
  args: { text: "Sphinx of black quartz, judge my vow." },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

const cell = "tw-p-3 tw-border-0 tw-border-b tw-border-solid tw-border-border-base tw-align-middle";

export const Default: Story = {
  render: (args) => html`
    <table class="tw-w-full tw-text-start tw-text-main">
      <thead>
        <tr class="tw-text-start">
          ${["Rendered Text", "Variant", "Additional Classes", "Weight", "Size", "Line Height"].map(
            (h) => html`<th class="${cell} tw-text-start tw-font-medium">${h}</th>`,
          )}
        </tr>
      </thead>
      <tbody>
        ${rows.map(
          (row) => html`
            <tr>
              <td class=${cell}>
                <bit-typography as="div" variant=${row.variant} class=${row.classes ?? ""}
                  >${args.text}</bit-typography
                >
              </td>
              <td class="${cell} ${typography("body2")}">${row.variant}</td>
              <td class="${cell} ${typography("body2")}">${row.classes ?? ""}</td>
              <td class="${cell} ${typography("body2")}">${row.weight}</td>
              <td class="${cell} ${typography("body2")}">${row.size}</td>
              <td class="${cell} ${typography("body2")}">150%</td>
            </tr>
          `,
        )}
      </tbody>
    </table>
  `,
};

export const SemanticVsVisual: Story = {
  render: () => html`
    <bit-typography variant="h1">Heading 1</bit-typography>
    <bit-typography variant="h5" as="h2">Semantically an h2, styled as h5</bit-typography>
    <bit-typography variant="body2">A body2 paragraph.</bit-typography>
    <bit-typography variant="h3" no-margin>h3 without margin</bit-typography>
    <h4 class=${typography("h4")}>Native h4 using the typography() class helper</h4>
  `,
};
