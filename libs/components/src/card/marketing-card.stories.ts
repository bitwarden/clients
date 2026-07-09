import { Meta, StoryObj, componentWrapperDecorator, moduleMetadata } from "@storybook/angular";

import { TypographyModule } from "../typography";

import { MarketingCardComponent } from "./marketing-card.component";

export default {
  title: "Component Library/Cards/Marketing Card",
  component: MarketingCardComponent,
  decorators: [
    moduleMetadata({
      imports: [TypographyModule],
    }),
    componentWrapperDecorator(
      (story) => `<div class="tw-bg-background-alt tw-p-10 tw-text-main">${story}</div>`,
    ),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-28355&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj<MarketingCardComponent>;

/** Marketing cards use a branded border to draw attention to promotional content. */
export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
        <bit-marketing-card>
            <h3 bitTypography="h3" class="!tw-mb-2">Upgrade your plan</h3>
            <p bitTypography="body1" class="!tw-mb-0">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vitae congue risus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nunc elementum odio nibh, eget pellentesque sem ornare vitae.</p>
        </bit-marketing-card>
    `,
  }),
};

/** Content projected into the `background` slot fills the card behind the main content. */
export const WithBackground: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
        <bit-marketing-card>
            <div slot="background" class="tw-size-full tw-bg-gradient-to-br tw-from-primary-100 tw-to-primary-300"></div>
            <h3 bitTypography="h3" class="!tw-mb-2">Upgrade your plan</h3>
            <p bitTypography="body1" class="!tw-mb-0">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vitae congue risus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nunc elementum odio nibh, eget pellentesque sem ornare vitae.</p>
        </bit-marketing-card>
    `,
  }),
};

/**
 * An `<img>` (or SVG) can be projected into the `background` slot. `tw-size-full` makes the image
 * fill the layer, and `tw-object-cover` crops it to the card's aspect ratio instead of stretching.
 * The image is clipped to the card's rounded corners by the host's `tw-overflow-hidden`, and
 * decorative background images use `alt=""` so screen readers skip them.
 */
export const WithImageBackground: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
        <bit-marketing-card>
            <img
              slot="background"
              alt=""
              class="tw-size-full tw-object-cover"
              src="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='400'%20height='200'%3E%3Cdefs%3E%3ClinearGradient%20id='g'%20x1='0'%20y1='0'%20x2='1'%20y2='1'%3E%3Cstop%20offset='0'%20stop-color='%230b5394'/%3E%3Cstop%20offset='1'%20stop-color='%23674ea7'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width='400'%20height='200'%20fill='url(%23g)'/%3E%3Ccircle%20cx='330'%20cy='50'%20r='90'%20fill='%23ffffff'%20opacity='0.15'/%3E%3C/svg%3E"
            />
            <h3 bitTypography="h3" class="!tw-mb-2 tw-text-contrast">Upgrade your plan</h3>
            <p bitTypography="body1" class="!tw-mb-0 tw-text-contrast">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vitae congue risus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nunc elementum odio nibh, eget pellentesque sem ornare vitae.</p>
        </bit-marketing-card>
    `,
  }),
};

/**
 * A decorative inline `<svg>` can be projected into the `background` slot. `tw-size-full` sizes it to
 * the layer and `preserveAspectRatio="xMidYMid slice"` scales it to cover (like `object-cover`).
 * Shapes are colored with theme-token `tw-fill-*` utilities so the artwork tracks the active theme,
 * and `aria-hidden="true"` keeps the decorative graphic out of the accessibility tree.
 */
export const WithSvgBackground: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
        <bit-marketing-card>
            <svg
              slot="background"
              class="tw-size-full"
              viewBox="0 0 400 200"
              preserveAspectRatio="xMidYMid slice"
              aria-hidden="true"
            >
              <rect width="400" height="200" class="tw-fill-primary-100" />
              <circle cx="60" cy="40" r="70" class="tw-fill-primary-300" opacity="0.5" />
              <circle cx="350" cy="180" r="110" class="tw-fill-primary-500" opacity="0.35" />
              <path d="M0 150 Q 100 110 200 150 T 400 150 V 200 H 0 Z" class="tw-fill-primary-300" opacity="0.6" />
            </svg>
            <h3 bitTypography="h3" class="!tw-mb-2">Upgrade your plan</h3>
            <p bitTypography="body1" class="!tw-mb-0">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vitae congue risus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nunc elementum odio nibh, eget pellentesque sem ornare vitae.</p>
        </bit-marketing-card>
    `,
  }),
};
