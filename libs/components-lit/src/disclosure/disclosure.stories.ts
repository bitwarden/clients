import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html, LitElement } from "lit";
import { customElement, query } from "lit/decorators.js";

import "../icon-button/icon-button";
import type { BitDisclosure } from "./disclosure";
import "./disclosure";
import "./disclosure-trigger";
import { disclosureTriggerFor } from "./disclosure-trigger-directive";

type Args = { open: boolean };

export default {
  title: "Component Library/Disclosure",
  component: "bit-disclosure",
  render: (args) => html`
    <bit-disclosure-trigger for="story-disclosure">
      <bit-icon-button icon="bwi-sliders" label="Settings" button-type="primaryGhost">
      </bit-icon-button>
    </bit-disclosure-trigger>
    <bit-disclosure id="story-disclosure" class="tw-text-main tw-block" ?open=${args.open}>
      click button to hide this content
    </bit-disclosure>
  `,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21662-47329&t=k6OTDDPZOTtypRqo-11",
    },
  },
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const DisclosureOpen: Story = { args: { open: true } };

export const DisclosureClosed: Story = { args: { open: false } };

/** The `disclosureTriggerFor()` directive inside a Lit component, with a native button trigger. */
export const LitDirective: Story = {
  render: () => html`<story-disclosure-demo></story-disclosure-demo>`,
};

@customElement("story-disclosure-demo")
class StoryDisclosureDemo extends LitElement {
  @query("bit-disclosure") private panel?: BitDisclosure;

  protected firstUpdated() {
    // The directive needs the disclosure element, which exists after the first render.
    this.requestUpdate();
  }

  render() {
    return html`
      <button type="button" ${disclosureTriggerFor(this.panel)}>Toggle details</button>
      <bit-disclosure>Details controlled by a native button.</bit-disclosure>
    `;
  }
}
void StoryDisclosureDemo;
