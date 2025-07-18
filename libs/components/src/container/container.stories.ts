import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { ContainerComponent } from "./container.component";

export default {
  title: "Component Library/Container",
  component: ContainerComponent,
  decorators: [
    moduleMetadata({
      imports: [ContainerComponent],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21662-47329&t=k6OTDDPZOTtypRqo-11",
    },
  },
} as Meta<ContainerComponent>;

type Story = StoryObj<ContainerComponent>;

export const Container: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-container>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed malesuada felis nulla, dignissim suscipit metus posuere vel. Duis eget porttitor arcu. Praesent tempor sodales nisi ut rhoncus. Curabitur vel enim eget est elementum finibus nec vitae erat. Duis dapibus, purus varius porttitor facilisis, justo nibh scelerisque tortor, consequat eleifend augue mi et nisi. Pellentesque convallis eget sem vitae malesuada. In hac habitasse platea dictumst. Suspendisse vulputate, neque in feugiat ultricies, mi diam malesuada tellus, at ultrices nisi enim nec nunc. Integer sapien mi, facilisis sed ultrices eget, dapibus sed velit. Aenean convallis nulla id lacus mattis gravida.<p>

        <p>Etiam quis ipsum in risus euismod sagittis ac vel lorem. Donec eget mollis augue. Maecenas vitae libero ornare felis sagittis consequat et nec urna. Integer velit sapien, mollis non magna consectetur, laoreet placerat risus. Pellentesque bibendum ante in diam commodo imperdiet. Donec ante ligula, interdum eu facilisis non, commodo eu dolor. Cras rutrum imperdiet tortor eget finibus. Donec fringilla vitae libero sed tincidunt. Quisque nulla quam, consectetur et dictum sit amet, ultrices quis tortor. Cras lacinia, lacus sed venenatis luctus, risus odio ultricies lacus, eu lacinia sapien nisl vel augue. Nunc fermentum ac nisl at dictum. Nulla gravida, odio ut pellentesque commodo, sapien urna ultrices enim, ut euismod odio nisi ac justo. Pellentesque auctor erat sit amet semper convallis. In finibus enim in lorem commodo, id pretium ligula finibus. Cras vehicula nisl eget gravida dapibus.</p>
      </bit-container>
    `,
  }),
};
