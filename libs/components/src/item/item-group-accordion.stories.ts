import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { BadgeComponent } from "../badge";
import { TypographyModule } from "../typography";

import { ItemGroupAccordionComponent } from "./item-group-accordion.component";
import { ItemModule } from "./item.module";

export default {
  title: "Component Library/Item/Item Group Accordion",
  component: ItemGroupAccordionComponent,
  decorators: [
    moduleMetadata({
      imports: [ItemModule, BadgeComponent, TypographyModule],
    }),
  ],
  args: {
    title: "Logins",
    subtitle: "12 items",
    open: true,
    disabled: false,
    size: "default",
    variant: "default",
  },
  argTypes: {
    size: { control: "select", options: ["default", "sm"] },
    variant: { control: "select", options: ["default", "subtle"] },
  },
} as Meta<ItemGroupAccordionComponent>;

type Story = StoryObj<ItemGroupAccordionComponent>;

const logins = [
  { name: "GitHub", username: "octocat" },
  { name: "Amazon", username: "jane.doe@gmail.com" },
  { name: "Netflix", username: "jane.doe@gmail.com" },
  { name: "Google", username: "jane.doe@gmail.com" },
  { name: "Spotify", username: "janedoe" },
  { name: "Reddit", username: "u/janedoe" },
  { name: "PayPal", username: "jane.doe@gmail.com" },
  { name: "Slack", username: "jane.doe@work.com" },
  { name: "Dropbox", username: "jane.doe@gmail.com" },
  { name: "LinkedIn", username: "jane-doe" },
  { name: "Steam", username: "janedoe_92" },
  { name: "Zoom", username: "jane.doe@work.com" },
];

const rows = /*html*/ logins
  .map(
    (login) => `
  <bit-item>
    <a bit-item-content href="#">
      <i slot="start" class="bwi bwi-globe tw-text-2xl tw-text-muted" aria-hidden="true"></i>
      ${login.name}
      <span slot="secondary">${login.username}</span>
      <i slot="end" class="bwi bwi-angle-right" aria-hidden="true"></i>
    </a>
  </bit-item>`,
  )
  .join("");

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-item-group-accordion
        [title]="title"
        [subtitle]="subtitle"
        [(open)]="open"
        [disabled]="disabled"
        [size]="size"
        [variant]="variant"
      >
        ${rows}
      </bit-item-group-accordion>`,
  }),
};

export const WithEndSlot: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-item-group-accordion
        [title]="title"
        [(open)]="open"
        [disabled]="disabled"
        [size]="size"
        [variant]="variant"
      >
        <p class="tw-mb-0" bitTypography="helper" slot="end" variant="primary">12</p>
        ${rows}
      </bit-item-group-accordion>`,
  }),
};
