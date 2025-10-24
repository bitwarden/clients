import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { AnchorLinkDirective } from "../../link";
import { TypographyModule } from "../../typography";

import { BaseCardComponent } from "./base-card.component";

export default {
  title: "Component Library/Cards/BaseCard",
  component: BaseCardComponent,
  decorators: [
    moduleMetadata({
      imports: [AnchorLinkDirective, TypographyModule],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-28355&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj<BaseCardComponent>;

/** Cards are presentational containers. */
export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
        <bit-base-card>
            <p bitTypography="body1" class="!tw-mb-0">
              The <code>&lt;bit-base-card&gt;</code> component is a container that applies our standard border and box-shadow. In most cases, <code>&lt;bit-card&gt;</code> should be used for consistency
            </p>
            <p bitTypography="body1" class="!tw-mb-0">
              <code>&lt;bit-base-card&gt;</code> is used in the <a bitLink href="/?path=/story/web-reports-card--enabled">ReportCardComponent</a> and <strong>IntegrationsCardComponent</strong> since they have custom padding requirements
            </p>
        </bit-base-card>
    `,
  }),
};
