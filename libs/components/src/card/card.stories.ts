import { RouterTestingModule } from "@angular/router/testing";
import { Meta, StoryObj, componentWrapperDecorator, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { LayoutComponent } from "../layout";
import { SectionComponent } from "../section";
import { TypographyModule } from "../typography";
import { I18nMockService } from "../utils/i18n-mock.service";

import { CardContentComponent } from "./card-content.component";
import { SegmentedCardComponent } from "./card-segmented.component";
import { CardComponent } from "./card.component";

export default {
  title: "Component Library/Cards/Card",
  component: CardComponent,
  decorators: [
    moduleMetadata({
      imports: [
        TypographyModule,
        SectionComponent,
        LayoutComponent,
        RouterTestingModule,
        CardContentComponent,
        SegmentedCardComponent,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              toggleSideNavigation: "Toggle side navigation",
              skipToContent: "Skip to content",
              submenu: "submenu",
              toggleCollapse: "toggle collapse",
            });
          },
        },
      ],
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

type Story = StoryObj<CardComponent>;

/** Cards are presentational containers. */
export const Default: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
        <bit-card>
            <p bitTypography="body1" class="!tw-mb-0">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vitae congue risus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nunc elementum odio nibh, eget pellentesque sem ornare vitae. Etiam vel ante et velit fringilla egestas a sed sem. Fusce molestie nisl et nisi accumsan dapibus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Sed eu risus ex. </p>
        </bit-card>
    `,
  }),
};

/** Cards are often paired with [Sections](/docs/component-library-section--docs). */
export const WithinSections: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
          <bit-section>
            <h2 bitTypography="h5">Bar</h2>
            <bit-card>
                <p bitTypography="body1" class="!tw-mb-0">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vitae congue risus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nunc elementum odio nibh, eget pellentesque sem ornare vitae. Etiam vel ante et velit fringilla egestas a sed sem. Fusce molestie nisl et nisi accumsan dapibus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Sed eu risus ex. </p>
            </bit-card>
          </bit-section>

          <bit-section>
            <h2 bitTypography="h5">Bar</h2>
            <bit-card>
                <p bitTypography="body1" class="!tw-mb-0">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vitae congue risus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nunc elementum odio nibh, eget pellentesque sem ornare vitae. Etiam vel ante et velit fringilla egestas a sed sem. Fusce molestie nisl et nisi accumsan dapibus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Sed eu risus ex. </p>
            </bit-card>
          </bit-section>

          <bit-section>
            <h2 bitTypography="h5">Bar</h2>
            <bit-card>
                <p bitTypography="body1" class="!tw-mb-0">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras vitae congue risus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nunc elementum odio nibh, eget pellentesque sem ornare vitae. Etiam vel ante et velit fringilla egestas a sed sem. Fusce molestie nisl et nisi accumsan dapibus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Sed eu risus ex. </p>
            </bit-card>
          </bit-section>
      `,
  }),
};

/**
 * A segmented card draws a full-width divider between each direct child. It makes no
 * assumptions about segment content — each segment owns its own padding and layout.
 * `<bit-card-content>` is used here as a convenient way to supply the standard card padding.
 */
export const Segmented: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
        <bit-card-segmented class="tw-max-w-2xl">
          <bit-card-content>
            <h3 bitTypography="h4" class="!tw-mb-1">Section one</h3>
            <p bitTypography="body1" class="!tw-mb-0">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            </p>
          </bit-card-content>

          <bit-card-content>
            <h3 bitTypography="h4" class="!tw-mb-1">Section two</h3>
            <p bitTypography="body1" class="!tw-mb-0">
              Interdum et malesuada fames ac ante ipsum primis in faucibus.
            </p>
          </bit-card-content>

          <bit-card-content>
            <h3 bitTypography="h4" class="!tw-mb-1">Section three</h3>
            <p bitTypography="body1" class="!tw-mb-0">Nunc elementum odio nibh.</p>
          </bit-card-content>
        </bit-card-segmented>
    `,
  }),
};
