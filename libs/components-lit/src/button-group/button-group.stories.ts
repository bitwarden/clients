import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";
import type { ButtonGroupOrientation } from "./button-group";
import "./button-group";

type Args = { orientation: ButtonGroupOrientation; fullWidth: boolean };

const renderAt =
  (width: string): Story["render"] =>
  (args) => html`
    <div style="width: ${width}">
      <bit-button-group orientation=${args.orientation} ?full-width=${args.fullWidth}>
        <bit-button button-type="secondary" start-icon="bwi-grid">Customize</bit-button>
        <bit-button button-type="secondary" start-icon="bwi-upload">Export</bit-button>
        <bit-button button-type="primary" start-icon="bwi-plus">Invite member</bit-button>
      </bit-button-group>
    </div>
  `;

export default {
  title: "Component Library/Button/Group",
  component: "bit-button-group",
  args: { orientation: "horizontal", fullWidth: false },
  argTypes: {
    orientation: { options: ["horizontal", "vertical", "auto"], control: { type: "radio" } },
  },
  render: renderAt("40rem"),
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const Default: Story = {};

export const FullWidth: Story = { args: { fullWidth: true } };

export const Vertical: Story = { render: renderAt("20rem"), args: { orientation: "vertical" } };

export const AutoFits: Story = {
  render: renderAt("32rem"),
  args: { orientation: "auto", fullWidth: true },
};

export const AutoStacked: Story = {
  render: renderAt("20rem"),
  args: { orientation: "auto", fullWidth: true },
};

/**
 * A component can forward its own slot into a group; the group measures the forwarded buttons.
 * Here the wrapper's shadow root renders `<bit-button-group><slot></slot></bit-button-group>`.
 */
export const ForwardedSlot: Story = {
  args: { orientation: "auto", fullWidth: true },
  render: (args) => {
    if (!customElements.get("story-forwarding-actions")) {
      customElements.define(
        "story-forwarding-actions",
        class extends HTMLElement {
          connectedCallback() {
            if (!this.shadowRoot) {
              this.attachShadow({ mode: "open" }).innerHTML =
                `<bit-button-group><slot></slot></bit-button-group>`;
            }
            const group = this.shadowRoot!.querySelector("bit-button-group")!;
            group.orientation = (this.getAttribute("orientation") ?? "horizontal") as never;
            group.fullWidth = this.hasAttribute("full-width");
          }
        },
      );
    }
    return html`
      <div style="width: 20rem">
        <story-forwarding-actions orientation=${args.orientation} ?full-width=${args.fullWidth}>
          <bit-button button-type="secondary" start-icon="bwi-grid">Customize</bit-button>
          <bit-button button-type="secondary" start-icon="bwi-upload">Export</bit-button>
          <bit-button button-type="primary" start-icon="bwi-plus">Invite member</bit-button>
        </story-forwarding-actions>
      </div>
    `;
  },
};
