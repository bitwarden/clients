import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ButtonComponent, TypographyModule } from "@bitwarden/components";

import { VaultCarouselSlideComponent } from "./carousel-slide/carousel-slide.component";
import { VaultCarouselComponent } from "./carousel.component";

export default {
  title: "Vault/Carousel",
  component: VaultCarouselComponent,
  decorators: [
    moduleMetadata({
      imports: [VaultCarouselSlideComponent, TypographyModule, ButtonComponent],
      providers: [{ provide: I18nService, useValue: { t: (key: string) => key } }],
    }),
  ],
} as Meta;

type Story = StoryObj<VaultCarouselComponent>;

export const Default: Story = {
  render: (args: any) => ({
    props: args,
    template: `
      <vault-carousel label="Storybook Demo">
        <vault-carousel-slide label="First Slide">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-4">
            <h2 bitTypography="h2">First Carousel Heading</h2>
            <p bitTypography="body1">First Carousel Content</p>
          </div>
        </vault-carousel-slide>
        <vault-carousel-slide label="Second Slide">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-4">
            <h2 bitTypography="h2">Second Carousel Heading</h2>
            <p bitTypography="body1">Second Carousel Content</p>
          </div>
        </vault-carousel-slide>
        <vault-carousel-slide label="Third Slide">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-4">
            <h2 bitTypography="h2">Third Carousel Heading</h2>
            <p bitTypography="body1">Third Carousel Content</p>
            <p bitTypography="body1">Third Carousel Content</p>
            <p bitTypography="body1">Third Carousel Content</p>
          </div>
        </vault-carousel-slide>
        <vault-carousel-slide label="Fourth Slide">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-4">
            <h2 bitTypography="h2">Fourth Carousel Heading</h2>
            <p bitTypography="body1">Fourth Carousel Content</p>
          </div>
        </vault-carousel-slide>
      </vault-carousel>
    `,
  }),
};

export const KeyboardNavigation: Story = {
  render: (args: any) => ({
    props: args,
    template: `
      <vault-carousel label="Storybook Demo">
        <vault-carousel-slide label="Focusable Content">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-4">
            <h2 bitTypography="h2">First Carousel Heading</h2>
            <button bitButton buttonType="primary">Button</button>
          </div>
        </vault-carousel-slide>
        <vault-carousel-slide noFocusableChildren label="No Focusable Content">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-4">
            <h2 bitTypography="h2">Second Carousel Heading</h2>
            <p bitTypography="body1">With no focusable elements, the entire slide should be focusable</p>
          </div>
        </vault-carousel-slide>
      </vault-carousel>
    `,
  }),
};

export const HideArrowsWithActions: Story = {
  render: (args: any) => ({
    props: args,
    template: `
      <vault-carousel [hideArrows]="true" label="Actions Demo">
        <vault-carousel-slide label="First Slide">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-4">
            <h2 bitTypography="h2">Slide Without Arrows</h2>
            <p bitTypography="body1">Dots only — no navigation arrows</p>
          </div>
        </vault-carousel-slide>
        <vault-carousel-slide label="Second Slide">
          <div class="tw-flex tw-flex-col tw-items-center tw-gap-4">
            <h2 bitTypography="h2">Second Slide</h2>
            <p bitTypography="body1">Buttons projected below the dots via carouselActions slot</p>
          </div>
        </vault-carousel-slide>
        <div carouselActions class="tw-flex tw-justify-center tw-gap-4 tw-mt-4">
          <button bitButton buttonType="secondary">Back</button>
          <button bitButton buttonType="primary">Next</button>
        </div>
      </vault-carousel>
    `,
  }),
};
