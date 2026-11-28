import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "./container";

export default {
  title: "Component Library/Container",
  component: "bit-container",
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21662-47329&t=k6OTDDPZOTtypRqo-11",
    },
  },
} satisfies Meta;

type Story = StoryObj;

export const Container: Story = {
  render: () => html`
    <bit-container>
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed malesuada felis nulla,
        dignissim suscipit metus posuere vel. Duis eget porttitor arcu. Praesent tempor sodales nisi
        ut rhoncus. Curabitur vel enim eget est elementum finibus nec vitae erat. Duis dapibus,
        purus varius porttitor facilisis, justo nibh scelerisque tortor, consequat eleifend augue mi
        et nisi. Pellentesque convallis eget sem vitae malesuada. In hac habitasse platea dictumst.
        Suspendisse vulputate, neque in feugiat ultricies, mi diam malesuada tellus, at ultrices
        nisi enim nec nunc. Integer sapien mi, facilisis sed ultrices eget, dapibus sed velit.
        Aenean convallis nulla id lacus mattis gravida.
      </p>
      <p>
        Etiam quis ipsum in risus euismod sagittis ac vel lorem. Donec eget mollis augue. Maecenas
        vitae libero ornare felis sagittis consequat et nec urna. Integer velit sapien, mollis non
        magna consectetur, laoreet placerat risus. Pellentesque bibendum ante in diam commodo
        imperdiet. Donec ante ligula, interdum eu facilisis non, commodo eu dolor. Cras rutrum
        imperdiet tortor eget finibus. Donec fringilla vitae libero sed tincidunt. Quisque nulla
        quam, consectetur et dictum sit amet, ultrices quis tortor.
      </p>
    </bit-container>
  `,
};
