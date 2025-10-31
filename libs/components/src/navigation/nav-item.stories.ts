import { RouterTestingModule } from "@angular/router/testing";
import { StoryObj, Meta, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { IconButtonModule } from "../icon-button";
import { LayoutComponent } from "../layout";
import { positionFixedWrapperDecorator } from "../stories/storybook-decorators";
import { I18nMockService } from "../utils/i18n-mock.service";

import { NavItemComponent } from "./nav-item.component";
import { NavigationModule } from "./navigation.module";

export default {
  title: "Component Library/Nav/Nav Item",
  component: NavItemComponent,
  decorators: [
    positionFixedWrapperDecorator(
      (story) => `<bit-layout><bit-side-nav>${story}</bit-side-nav></bit-layout>`,
    ),
    moduleMetadata({
      declarations: [],
      imports: [RouterTestingModule, IconButtonModule, NavigationModule, LayoutComponent],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              submenu: "submenu",
              toggleCollapse: "toggle collapse",
              toggleSideNavigation: "Toggle side navigation",
              skipToContent: "Skip to content",
              loading: "Loading",
            });
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-40145&t=b5tDKylm5sWm2yKo-4",
    },
    chromatic: { delay: 1000 },
  },
} as Meta;

type Story = StoryObj<NavItemComponent>;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
        <bit-nav-item text="${args.text}"  [route]="['']" icon="${args.icon}"></bit-nav-item>
      `,
  }),
  args: {
    text: "Hello World",
    icon: "bwi-filter",
  },
};

export const WithoutIcon: Story = {
  ...Default,
  args: {
    text: "Hello World",
    icon: "",
  },
};

export const WithLongText: Story = {
  ...Default,
  args: {
    text: "Hello World This Is a Cool Item",
  },
};

export const WithoutRoute: Story = {
  render: () => ({
    template: `
        <bit-nav-item text="Hello World" icon="bwi-collection-shared"></bit-nav-item>
      `,
  }),
};

export const WithChildButtons: Story = {
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <bit-nav-item text="Hello World Very Cool World" [route]="['']" icon="bwi-collection-shared">
        <button
          type="button" 
          slot="end"
          class="tw-ms-auto"
          [bitIconButton]="'bwi-pencil-square'"
          [buttonType]="'nav-contrast'"
          size="small"
          label="Edit"
        ></button>
        <button
          type="button" 
          slot="end"
          class="tw-ms-auto"
          [bitIconButton]="'bwi-check'"
          [buttonType]="'nav-contrast'"
          size="small"
          label="Confirm"
        ></button>
      </bit-nav-item>
    `,
  }),
};

export const MultipleItemsWithDivider: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-nav-item text="Hello World"></bit-nav-item>
      <bit-nav-item text="Hello World Long Text Long"></bit-nav-item>
      <bit-nav-divider></bit-nav-divider>
      <bit-nav-item text="Hello World" icon="bwi-collection-shared"></bit-nav-item>
      <bit-nav-item text="Hello World" icon="bwi-collection-shared"></bit-nav-item>
    `,
  }),
};

export const ForceActiveStyles: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-nav-item text="First Nav" icon="bwi-collection-shared"></bit-nav-item>
      <bit-nav-item text="Active Nav" icon="bwi-collection-shared" [forceActiveStyles]="true"></bit-nav-item>
      <bit-nav-item text="Third Nav" icon="bwi-collection-shared"></bit-nav-item>
    `,
  }),
};

export const CollapsedNavItems: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-nav-item text="First Nav" icon="bwi-collection-shared"></bit-nav-item>
      <bit-nav-item text="Active Nav" icon="bwi-collection-shared" [forceActiveStyles]="true"></bit-nav-item>
      <bit-nav-item text="Third Nav" icon="bwi-collection-shared"></bit-nav-item>
    `,
  }),
  play: async () => {
    const toggleButton = document.querySelector(
      "[aria-label='Toggle side navigation']",
    ) as HTMLButtonElement;
    if (toggleButton) {
      await toggleButton.click();
    }
  },
  parameters: {
    delay: 1000,
    chromatic: {
      viewports: [640],
      delay: 1000,
    },
  },
};
