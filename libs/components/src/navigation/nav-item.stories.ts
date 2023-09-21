import { RouterTestingModule } from "@angular/router/testing";
import { StoryObj, Meta, moduleMetadata } from "@storybook/angular";

import { IconButtonModule } from "../icon-button";

import { NavItemComponent } from "./nav-item.component";
import { NavigationModule } from "./navigation.module";

export default {
  title: "Component Library/Nav/Nav Item",
  component: NavItemComponent,
  decorators: [
    moduleMetadata({
      declarations: [],
      imports: [RouterTestingModule, IconButtonModule, NavigationModule],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/file/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=4687%3A86642",
    },
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

export const WithoutRoute: Story = {
  render: (args: NavItemComponent) => ({
    props: args,
    template: `
        <bit-nav-item text="Hello World" icon="bwi-collection"></bit-nav-item>
      `,
  }),
};

export const WithChildButtons: Story = {
  render: (args: NavItemComponent) => ({
    props: args,
    template: `
      <bit-nav-item text="Hello World" [route]="['']" icon="bwi-collection">
        <button
          slot="start"
          class="tw-ml-auto"
          [bitIconButton]="'bwi-clone'"
          [buttonType]="'contrast'"
          size="small"
          aria-label="option 1"
        ></button>
        <button
          slot="end"
          class="tw-ml-auto"
          [bitIconButton]="'bwi-pencil-square'"
          [buttonType]="'contrast'"
          size="small"
          aria-label="option 2"
        ></button>
        <button
          slot="end"
          class="tw-ml-auto"
          [bitIconButton]="'bwi-check'"
          [buttonType]="'contrast'"
          size="small"
          aria-label="option 3"
        ></button>
      </bit-nav-item>
    `,
  }),
};

export const MultipleItemsWithDivider: Story = {
  render: (args: NavItemComponent) => ({
    props: args,
    template: `
      <bit-nav-item text="Hello World" icon="bwi-collection"></bit-nav-item>
      <bit-nav-item text="Hello World" icon="bwi-collection"></bit-nav-item>
      <bit-nav-divider></bit-nav-divider>
      <bit-nav-item text="Hello World" icon="bwi-collection"></bit-nav-item>
      <bit-nav-item text="Hello World" icon="bwi-collection"></bit-nav-item>
    `,
  }),
};
