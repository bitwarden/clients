import { Meta, StoryObj, componentWrapperDecorator, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { CardComponent } from "../card";
import { IconButtonModule } from "../icon-button";
import { ItemModule } from "../item";
import { TypographyModule } from "../typography";
import { I18nMockService } from "../utils";

import { SectionComponent, SectionHeaderComponent } from "./";

export default {
  title: "Component Library/Section",
  component: SectionComponent,
  decorators: [
    moduleMetadata({
      imports: [
        TypographyModule,
        SectionHeaderComponent,
        CardComponent,
        IconButtonModule,
        ItemModule,
      ],
      providers: [
        {
          provide: I18nService,
          useValue: new I18nMockService({ loading: "Loading" }),
        },
      ],
    }),
    componentWrapperDecorator((story) => `<div class="tw-text-main">${story}</div>`),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21666-19363&t=k6OTDDPZOTtypRqo-11",
    },
  },
} as Meta;

type Story = StoryObj<SectionComponent>;

export const Default: Story = {
  render: () => ({
    template: /*html*/ `
        <bit-section>
          <bit-section-header>
            <h2 bitTypography="h2">Foo</h2>
          </bit-section-header>
          <p bitTypography="body1">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vitae congue risus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nunc elementum odio nibh, eget pellentesque sem ornare vitae. Etiam vel ante et velit fringilla egestas a sed sem. Fusce molestie nisl et nisi accumsan dapibus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Sed eu risus ex. </p>
        </bit-section>
        <bit-section>
          <bit-section-header>
            <h2 bitTypography="h2">Bar</h2>
          </bit-section-header>
          <p bitTypography="body1">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vitae congue risus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nunc elementum odio nibh, eget pellentesque sem ornare vitae. Etiam vel ante et velit fringilla egestas a sed sem. Fusce molestie nisl et nisi accumsan dapibus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Sed eu risus ex. </p>
        </bit-section>
        <bit-section disableMargin>
          <bit-section-header>
            <h2 bitTypography="h2">Baz</h2>
          </bit-section-header>
          <p bitTypography="body1">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vitae congue risus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nunc elementum odio nibh, eget pellentesque sem ornare vitae. Etiam vel ante et velit fringilla egestas a sed sem. Fusce molestie nisl et nisi accumsan dapibus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Sed eu risus ex. </p>
        </bit-section>
    `,
  }),
};

export const HeaderVariants: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-section-header>
        <h2 bitTypography="h6">
          Title only
        </h2>
       </bit-section-header>
      <bit-section-header>
        <h2 bitTypography="h6">
          Title with icon button suffix
        </h2>
        <button type="button" label="Refresh" bitIconButton="bwi-refresh" size="small"></button>
      </bit-section-header>
    `,
  }),
};

export const HeaderEndSlotVariants: Story = {
  render: () => ({
    template: /*html*/ `
      <bit-section-header>
        <h2 bitTypography="h6">
          Title with end slot text
        </h2>
        <span bitTypography="body2" slot="end">13</span>
      </bit-section-header>
      <bit-section-header>
        <h2 bitTypography="h6">
          Title with end slot icon button
        </h2>
        <button type="button" label="Favorite" bitIconButton="bwi-star" size="small" slot="end"></button>
      </bit-section-header>
    `,
  }),
};

export const HeaderWithPadding: Story = {
  render: () => ({
    template: /*html*/ `
      <div class="tw-bg-background-alt tw-p-2">
        <bit-section>
          <bit-section-header>
            <h2 bitTypography="h6">
              Card as immediate sibling
            </h2>
            <button type="button" label="Favorite" bitIconButton="bwi-star" size="small" slot="end"></button>
          </bit-section-header>
          <bit-card>
            <h3 bitTypography="h3">bit-section-header has padding</h3>
          </bit-card>
        </bit-section>
        <bit-section>
          <bit-section-header>
            <h2 bitTypography="h6">
              Card nested in immediate sibling
            </h2>
            <button type="button" label="Favorite" bitIconButton="bwi-star" size="small" slot="end"></button>
          </bit-section-header>
          <div>
            <bit-card>
              <h3 bitTypography="h3">bit-section-header has padding</h3>
            </bit-card>
          </div>
        </bit-section>
        <bit-section>
          <bit-section-header>
            <h2 bitTypography="h6">
              Item as immediate sibling
            </h2>
            <button type="button" label="Favorite" bitIconButton="bwi-star" size="small" slot="end"></button>
          </bit-section-header>
          <bit-item>
            <bit-item-content bitTypography="body1">bit-section-header has padding</bit-item-content>
          </bit-item>
        </bit-section>
        <bit-section>
          <bit-section-header>
            <h2 bitTypography="h6">
              Item nested in immediate sibling
            </h2>
            <button type="button" label="Favorite" bitIconButton="bwi-star" size="small" slot="end"></button>
          </bit-section-header>
          <bit-item-group>
            <bit-item>
              <bit-item-content bitTypography="body1">bit-section-header has padding</bit-item-content>
            </bit-item>
          </bit-item-group>
        </bit-section>
      </div>
    `,
  }),
};

export const HeaderWithoutPadding: Story = {
  render: () => ({
    template: /*html*/ `
      <div class="tw-bg-background-alt tw-p-2">
        <bit-section>
          <bit-section-header>
            <h2 bitTypography="h6">
              No card or item used
            </h2>
            <button bitIconButton="bwi-star" size="small" slot="end" label="Favorite"></button>
          </bit-section-header>
          <div>
            <h3 bitTypography="h3">just a div, so bit-section-header has no padding</h3>
          </div>
        </bit-section>
        <bit-section>
          <bit-section-header>
            <h2 bitTypography="h6">
              Card nested in non-immediate sibling
            </h2>
            <button bitIconButton="bwi-star" size="small" slot="end" label="Favorite"></button>
          </bit-section-header>
          <div class="tw-text-main">
            a div here
          </div>
          <bit-card>
            <h3 bitTypography="h3">bit-section-header has no padding</h3>
          </bit-card>
        </bit-section>
      </div>
    `,
  }),
};
