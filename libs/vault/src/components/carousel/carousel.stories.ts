import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { VaultCarouselSlideComponent } from "./carousel-slide/carousel-slide.component";
import { VaultCarouselComponent } from "./carousel.component";

export default {
  title: "Vault/Carousel",
  component: VaultCarouselComponent,
  decorators: [
    moduleMetadata({
      imports: [VaultCarouselSlideComponent],
    }),
  ],
} as Meta;

type Story = StoryObj<VaultCarouselComponent>;

export const Default: Story = {
  render: (args: any) => ({
    props: args,
    template: `
      <vault-carousel label="Storybook Demo">
        <vault-carousel-slide>First Carousel Content</vault-carousel-slide>
        <vault-carousel-slide>Second Carousel Content</vault-carousel-slide>
      </vault-carousel>
    `,
  }),
};
