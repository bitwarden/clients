import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import { expect, waitFor } from "storybook/test";

import { themeModes } from "../shared/shared-story-arg-types";

import "./chip-filter";
import { basicOptionsData } from "./chip-filter.stories";

type Args = { value?: string };

const focusTrigger = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await waitFor(async () => {
    const chip = canvasElement.querySelector("bit-chip-filter");
    const trigger = chip?.shadowRoot?.querySelector<HTMLButtonElement>("[part=trigger]");
    await expect(trigger).toBeTruthy();
    trigger?.focus({ focusVisible: true } as FocusOptions);
    await expect(chip?.shadowRoot?.activeElement).toBe(trigger);
  });
};

export default {
  title: "Component Library/Chips/Chip Filter/Interaction States",
  component: "bit-chip-filter",
  tags: ["!autodocs"],
  render: (args) =>
    html`<bit-chip-filter
      placeholder-text="Folder"
      placeholder-icon="bwi-folder"
      .options=${basicOptionsData}
      .value=${args.value ?? null}
    ></bit-chip-filter>`,
  play: focusTrigger,
  parameters: themeModes,
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

export const FocusUnselected: Story = {};

export const FocusSelected: Story = { args: { value: "foo" } };
