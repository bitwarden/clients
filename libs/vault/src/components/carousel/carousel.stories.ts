import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { TypographyModule } from "@bitwarden/components";

import { VaultCarouselSlideComponent } from "./carousel-slide/carousel-slide.component";
import { VaultCarouselComponent } from "./carousel.component";

export default {
  title: "Vault/Carousel",
  component: VaultCarouselComponent,
  decorators: [
    moduleMetadata({
      imports: [VaultCarouselSlideComponent, TypographyModule],
    }),
  ],
} as Meta;

type Story = StoryObj<VaultCarouselComponent>;

export const Default: Story = {
  render: (args: any) => ({
    props: args,
    template: `
      <vault-carousel label="Storybook Demo">
        <vault-carousel-slide>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-4">
            <h2 bitTypography="h2">First Carousel Heading</h2>
            <p bitTypography="body1">First Carousel Content</p>
          </div>
        </vault-carousel-slide>
        <vault-carousel-slide>
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-4">
            <h2 bitTypography="h2">Second Carousel Heading</h2>
            <p bitTypography="body1">Second Carousel Content</p>
          </div>
        </vault-carousel-slide>
      </vault-carousel>
    `,
  }),
};
