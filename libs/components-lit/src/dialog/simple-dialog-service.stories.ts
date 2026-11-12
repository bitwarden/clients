import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../button/button";

import type { DialogRef } from "./dialog-ref";
import { openDialog } from "./dialog-service";
import "./simple-dialog";

type Animal = { animal: string };

const content = (footer: "both" | "primary" | "none") => (ref: DialogRef<unknown, Animal>) =>
  html`<bit-simple-dialog>
    <span slot="title">Dialog Title</span>
    Dialog body text goes here.
    <br />
    Animal: ${ref.data?.animal}
    ${
      footer === "none"
        ? ""
        : html`<bit-button slot="footer" block button-type="primary" @click=${() => ref.close()}
            >Save</bit-button
          >`
    }
    ${
      footer === "both"
        ? html`<bit-button slot="footer" block button-type="secondary" data-bit-dialog-close
            >Cancel</bit-button
          >`
        : ""
    }
  </bit-simple-dialog>`;

const data = { animal: "panda" };

const clickButton =
  (index: number) =>
  async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    canvasElement.querySelectorAll<HTMLElement>("bit-button")[index]?.click();
  };

export default {
  title: "Component Library/Dialogs/Service/Simple",
  render: () =>
    html`<div class="tw-flex tw-flex-wrap tw-gap-2">
      <bit-button @click=${() => openDialog(content("both"), { data, position: "center" })}
        >Open Simple Dialog</bit-button
      >
      <bit-button
        @click=${() =>
          openDialog(content("primary"), { data, disableClose: true, position: "center" })}
        >Open Non-Dismissable Simple Dialog with Primary Button</bit-button
      >
      <bit-button
        @click=${() => openDialog(content("none"), { data, disableClose: true, position: "center" })}
        >Open Non-Dismissable Simple Dialog with No Buttons</bit-button
      >
    </div>`,
} satisfies Meta;

type Story = StoryObj;

export const Default: Story = { play: clickButton(0) };

export const NonDismissableWithPrimaryButton: Story = { play: clickButton(1) };

export const NonDismissableWithNoButtons: Story = { play: clickButton(2) };
