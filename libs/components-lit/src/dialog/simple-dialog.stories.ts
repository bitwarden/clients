import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";

import "./simple-dialog";

type Args = { hideIcon: boolean };

const buttons = (submit = false) => html`
  <bit-button slot="footer" block button-type="primary" type=${submit ? "submit" : "button"}
    >${submit ? "Confirm" : "Yes"}</bit-button
  >
  <bit-button slot="footer" block button-type="secondary">${submit ? "Cancel" : "No"}</bit-button>
`;

export default {
  title: "Component Library/Dialogs/Simple Dialog",
  component: "bit-simple-dialog",
  args: { hideIcon: false },
  render: (args) => html`
    <bit-simple-dialog ?hide-icon=${args.hideIcon}>
      <span slot="title">Alert Dialog</span>
      Message Content ${buttons()}
    </bit-simple-dialog>
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const CustomIcon: Story = {
  render: () => html`
    <bit-simple-dialog>
      <i slot="icon" class="bwi bwi-star tw-text-3xl tw-text-success" aria-hidden="true"></i>
      <span slot="title">Premium Subscription Available</span>
      Message Content ${buttons()}
    </bit-simple-dialog>
  `,
};

export const HideIcon: Story = {
  render: () => html`
    <bit-simple-dialog hide-icon>
      <span slot="title">Premium Subscription Available</span>
      Message Content ${buttons()}
    </bit-simple-dialog>
  `,
};

export const ScrollingContent: Story = {
  render: () => html`
    <div class="tw-h-[600px] tw-flex tw-flex-col">
      <bit-simple-dialog>
        <span slot="title">Alert Dialog</span>
        Message Content Message text goes here.<br />
        ${Array.from({ length: 100 }, () => html`repeating lines of characters <br />`)} end of
        sequence! ${buttons()}
      </bit-simple-dialog>
    </div>
  `,
};

export const TextOverflow: Story = {
  render: () => html`
    <bit-simple-dialog>
      <span slot="title"
        >Alert Dialogdialogdialogdialogdialogdialogdialogdialogdialogdialogdialogdialogdialog</span
      >
      Message Contentcontentcontentcontentcontentcontentcontentcontentcontentcontentcontent
      ${buttons()}
    </bit-simple-dialog>
  `,
};

/** Wrap the dialog in a `<form>`; footer buttons submit it. */
export const WithForm: Story = {
  render: () => html`
    <form @submit=${(e: Event) => e.preventDefault()}>
      <bit-simple-dialog>
        <span slot="title">Confirm Action</span>
        Are you sure you want to proceed with this action? This cannot be undone. ${buttons(true)}
      </bit-simple-dialog>
    </form>
  `,
};
