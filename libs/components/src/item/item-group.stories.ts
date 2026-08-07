import { Meta, StoryObj, componentWrapperDecorator, moduleMetadata } from "@storybook/angular";

import { ItemGroupComponent } from "./item-group.component";
import { ItemModule } from "./item.module";

export default {
  title: "Component Library/Item/Item Group",
  component: ItemGroupComponent,
  decorators: [
    moduleMetadata({
      imports: [ItemModule],
    }),
    componentWrapperDecorator((story) => `<div class="tw-bg-background-alt tw-p-2">${story}</div>`),
  ],
  args: {
    joined: false,
  },
  argTypes: {
    joined: { control: "boolean" },
  },
} as Meta;

type Story = StoryObj<{ joined: boolean }>;

const template = /*html*/ `
  <bit-item-group [joined]="joined">
    <bit-item>
      <a bit-item-content href="#">
        Foobar
        <i slot="end" class="bwi bwi-angle-right" aria-hidden="true"></i>
      </a>
    </bit-item>
    <bit-item>
      <a bit-item-content href="#">
        Foobar
        <i slot="end" class="bwi bwi-angle-right" aria-hidden="true"></i>
      </a>
    </bit-item>
    <bit-item>
      <a bit-item-content href="#">
        Foobar
        <i slot="end" class="bwi bwi-angle-right" aria-hidden="true"></i>
      </a>
    </bit-item>
  </bit-item-group>
`;

/**
 * The default layout: each item draws its own border and sits in its own card with a gap
 * between items.
 */
export const Unjoined: Story = {
  args: { joined: false },
  render: (args) => ({
    props: args,
    template,
  }),
};

/**
 * With `joined`, the items render as a single segmented card — one outer border with a
 * divider between each item, and no per-item border or gap.
 */
export const Joined: Story = {
  args: { joined: true },
  render: (args) => ({
    props: args,
    template,
  }),
};
