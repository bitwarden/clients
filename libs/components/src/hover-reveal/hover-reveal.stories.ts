import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { IconButtonModule } from "../icon-button";
import { MenuModule } from "../menu";

import {
  HoverRevealBoundaryDirective,
  HoverRevealContainerDirective,
  HoverRevealDirective,
} from "./hover-reveal.directive";

export default {
  title: "Component Library/Hover Reveal",
  component: HoverRevealContainerDirective,
  decorators: [
    moduleMetadata({
      imports: [
        HoverRevealContainerDirective,
        HoverRevealDirective,
        HoverRevealBoundaryDirective,
        IconButtonModule,
        MenuModule,
      ],
    }),
  ],
  parameters: {
    chromatic: { disableSnapshot: true },
  },
} as Meta;

type Story = StoryObj<HoverRevealContainerDirective>;

export const Default: Story = {
  render: () => ({
    template: /*html*/ `
      <div bitHoverRevealContainer data-testid="container" class="tw-flex tw-items-center tw-justify-between tw-p-3 tw-rounded-xl tw-border tw-border-solid tw-border-border-base">
        <span>Hover or tab into this row</span>
        <button type="button" bitHoverReveal bitIconButton="bwi-pencil-square" label="Edit"></button>
      </div>
    `,
  }),
  // Snapshots can't hold a real pointer hover, so force the hover state with the test class
  play: async ({ canvas }) => {
    const container = await canvas.findByTestId("container");
    container.classList.add("tw-test-hover");
  },
  parameters: {
    chromatic: { disableSnapshot: false },
  },
};

export const WithMenu: Story = {
  render: () => ({
    template: /*html*/ `
      <div bitHoverRevealContainer class="tw-flex tw-items-center tw-justify-between tw-p-3 tw-rounded-xl tw-border tw-border-solid tw-border-border-base">
        <span>The trigger stays visible while its menu is open</span>
        <button type="button" bitHoverReveal bitIconButton="bwi-ellipsis-v" label="Options" [bitMenuTriggerFor]="menu"></button>
      </div>
      <bit-menu #menu>
        <button type="button" bitMenuItem>Rename</button>
        <button type="button" bitMenuItem variant="danger">Delete</button>
      </bit-menu>
    `,
  }),
};

export const Nested: Story = {
  render: () => ({
    template: /*html*/ `
      <div bitHoverRevealContainer class="tw-flex tw-flex-col tw-gap-3 tw-p-3 tw-rounded-xl tw-border tw-border-solid tw-border-border-base">
        <div class="tw-flex tw-items-center tw-justify-between">
          <span>Outer container</span>
          <button type="button" bitHoverReveal bitIconButton="bwi-pencil-square" label="Edit outer"></button>
        </div>
        <div bitHoverRevealContainer class="tw-flex tw-items-center tw-justify-between tw-p-3 tw-rounded-xl tw-border tw-border-solid tw-border-border-base">
          <span>Inner container, independent of the outer one</span>
          <button type="button" bitHoverReveal bitIconButton="bwi-pencil-square" label="Edit inner"></button>
        </div>
      </div>
    `,
  }),
};

export const Boundary: Story = {
  render: () => ({
    template: /*html*/ `
      <div bitHoverRevealContainer class="tw-flex tw-flex-col tw-gap-2 tw-p-3 tw-rounded-xl tw-border tw-border-solid tw-border-border-base">
        <div class="tw-flex tw-items-center tw-justify-between">
          <span>Parent row</span>
          <button type="button" bitHoverReveal bitIconButton="bwi-pencil-square" label="Edit"></button>
        </div>
        <ul bitHoverRevealBoundary class="tw-m-0 tw-p-3 tw-rounded-xl tw-bg-bg-secondary">
          <li>Hovering here doesn't reveal "Edit"</li>
        </ul>
      </div>
    `,
  }),
};
