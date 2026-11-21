import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, nothing } from "lit";

import "../badge/badge";
import "../button/button";
import "../card/card";
import "../icon-button/icon-button";
import "../input/input";
import "../section/section";
import "../section/section-header";
import "../tabs/tab-group/tab-group";
import "../tabs/tab-group/tab";
import { typography } from "../typography/typography";

import "./dialog";
import type { DialogSize } from "./dialog";

type Args = {
  heading: string;
  subtitle?: string;
  dialogSize: DialogSize;
  background: "default" | "alt";
  loading: boolean;
  disableAnimations: boolean;
};

const footer = (loading: boolean) => html`
  <bit-button slot="footer" button-type="primary" ?disabled=${loading}>Save</bit-button>
  <bit-button slot="footer" button-type="secondary" ?disabled=${loading}>Cancel</bit-button>
  <bit-icon-button
    slot="footer"
    class="tw-ms-auto"
    icon="bwi-trash"
    button-type="dangerGhost"
    label="Delete"
    ?disabled=${loading}
  ></bit-icon-button>
`;

export default {
  title: "Component Library/Dialogs/Dialog",
  component: "bit-dialog",
  args: {
    heading: "Default",
    subtitle: "Subtitle",
    dialogSize: "default",
    background: "default",
    loading: false,
    disableAnimations: true,
  },
  argTypes: {
    background: { control: "radio", options: ["alt", "default"] },
    dialogSize: { control: "radio", options: ["small", "default", "large"] },
  },
  render: (args) => html`
    <bit-dialog
      heading=${args.heading}
      subtitle=${args.subtitle ?? nothing}
      dialog-size=${args.dialogSize}
      background=${args.background}
      ?loading=${args.loading}
      ?disable-animations=${args.disableAnimations}
    >
      <bit-badge slot="title" variant="success">Foobar</bit-badge>
      Dialog body text goes here. ${footer(args.loading)}
    </bit-dialog>
  `,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const Small: Story = {
  args: { dialogSize: "small", heading: "Small", subtitle: undefined },
};

export const LongTitle: Story = {
  args: {
    dialogSize: "small",
    heading: "Incredibly_Super_Long_Title_That_Should_Be_Truncated",
    subtitle: undefined,
  },
};

export const LongTitleSentence: Story = {
  args: {
    dialogSize: "small",
    heading: "Very Long Sentence That Should Be Truncated After Two Lines",
    subtitle: undefined,
  },
};

export const Large: Story = {
  args: { dialogSize: "large", heading: "Large", subtitle: undefined },
};

export const Loading: Story = {
  args: { dialogSize: "large", loading: true, heading: "Loading", subtitle: undefined },
};

export const ScrollingContent: Story = {
  args: { dialogSize: "small" },
  render: (args) => html`
    <bit-dialog
      heading="Scrolling Example"
      background=${args.background}
      dialog-size=${args.dialogSize}
      ?loading=${args.loading}
      ?disable-animations=${args.disableAnimations}
    >
      Dialog body text goes here.<br />
      ${Array.from({ length: 100 }, () => html`repeating lines of characters <br />`)} end of
      sequence!
      <bit-button slot="footer" button-type="primary">Save</bit-button>
      <bit-button slot="footer" button-type="secondary">Cancel</bit-button>
    </bit-dialog>
  `,
};

export const TabContent: Story = {
  args: { dialogSize: "large" },
  render: (args) => html`
    <bit-dialog
      heading="Tab Content Example"
      background=${args.background}
      dialog-size=${args.dialogSize}
      ?disable-animations=${args.disableAnimations}
    >
      <bit-tab-group>
        <bit-tab label="First Tab">First Tab Content</bit-tab>
        <bit-tab label="Second Tab">Second Tab Content</bit-tab>
        <bit-tab label="Third Tab">Third Tab Content</bit-tab>
      </bit-tab-group>
      <bit-button slot="footer" button-type="primary">Save</bit-button>
      <bit-button slot="footer" button-type="secondary">Cancel</bit-button>
    </bit-dialog>
  `,
};

/** `background="alt"` suits dialogs with card sections. Wrap the dialog in a `<form>` to submit it. */
export const WithCards: Story = {
  args: { background: "alt" },
  render: (args) => html`
    <form @submit=${(e: Event) => e.preventDefault()}>
      <bit-dialog
        heading=${args.heading}
        subtitle=${args.subtitle ?? nothing}
        dialog-size=${args.dialogSize}
        background=${args.background}
        ?loading=${args.loading}
        ?disable-animations=${args.disableAnimations}
      >
        ${["Foo", "Bar"].map(
          (section) =>
            html`<bit-section>
              <bit-section-header>
                <h2 class=${typography("h6")}>${section}</h2>
                <bit-icon-button
                  icon="bwi-star"
                  size="small"
                  label="Favorite"
                  slot="end"
                ></bit-icon-button>
              </bit-section-header>
              <bit-card>
                <bit-input label="Label" hint="Optional Hint" name="name"></bit-input>
                <bit-input
                  label="Label"
                  hint="Optional Hint"
                  name="name2"
                  disable-margin
                ></bit-input>
              </bit-card>
            </bit-section>`,
        )}
        <bit-button slot="footer" type="submit" button-type="primary">Save</bit-button>
        <bit-button slot="footer" button-type="secondary">Cancel</bit-button>
        <bit-icon-button
          slot="footer"
          class="tw-ms-auto"
          icon="bwi-trash"
          button-type="dangerGhost"
          label="Delete"
        ></bit-icon-button>
      </bit-dialog>
    </form>
  `,
};

export const WithoutFooter: Story = {
  args: { heading: "Without Footer", subtitle: undefined },
  render: (args) => html`
    <bit-dialog
      heading=${args.heading}
      dialog-size=${args.dialogSize}
      background="alt"
      ?disable-animations=${args.disableAnimations}
    >
      Dialog body text goes here.
    </bit-dialog>
  `,
};

export const HeaderEnd: Story = {
  args: {
    dialogSize: "small",
    heading: "Very Long Title That Should Be Truncated After Two Lines To Test Header End Slot",
  },
  render: (args) => html`
    <bit-dialog
      heading=${args.heading}
      subtitle=${args.subtitle ?? nothing}
      dialog-size=${args.dialogSize}
      ?disable-animations=${args.disableAnimations}
    >
      <bit-badge slot="header-end">Archived</bit-badge>
      Dialog body text goes here. ${footer(false)}
    </bit-dialog>
  `,
};
