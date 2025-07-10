import { Meta, StoryObj } from "@storybook/angular";

import { TypographyDirective } from "./typography.directive";

export default {
  title: "Component Library/Typography",
  component: TypographyDirective,
} as Meta;

export const Default: StoryObj<TypographyDirective & { text: string }> = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <div bitTypography="h1">h1 - {{ text }}</div>
      <div bitTypography="h2">h2 - {{ text }}</div>
      <div bitTypography="h3">h3 - {{ text }}</div>
      <div bitTypography="h4">h4 - {{ text }}</div>
      <div bitTypography="h5">h5 - {{ text }}</div>
      <div bitTypography="h6">h6 - {{ text }}</div>
      <div bitTypography="body1" class="tw-text-main">body1 - {{ text }}</div>
      <div bitTypography="body2" class="tw-text-main">body2 - {{ text }}</div>
      <div bitTypography="helper" class="tw-text-main">helper - {{ text }}</div>
    `,
  }),
  args: {
    text: `Sphinx of black quartz, judge my vow.`,
  },
};
