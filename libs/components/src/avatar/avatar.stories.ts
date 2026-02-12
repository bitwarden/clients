import { Meta, StoryObj } from "@storybook/angular";

import { formatArgsForCodeSnippet } from "../../../../.storybook/format-args-for-code-snippet";

import { AvatarComponent } from "./avatar.component";

export default {
  title: "Component Library/Avatar",
  component: AvatarComponent,
  args: {
    id: undefined,
    text: "Walt Walterson",
    size: "base",
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-26525&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj<AvatarComponent>;

export const Default: Story = {
  render: (args) => {
    return {
      props: args,
      template: `
        <bit-avatar ${formatArgsForCodeSnippet<AvatarComponent>(args)}></bit-avatar>
      `,
    };
  },
  args: {
    color: "brand",
  },
};

export const Interactive: Story = {
  render: (args) => {
    return {
      props: args,
      template: `
        <button bit-avatar ${formatArgsForCodeSnippet<AvatarComponent>(args)}></button>
      `,
    };
  },
  args: {
    color: "brand",
  },
};

export const Sizes: Story = {
  render: (args) => {
    return {
      props: args,
      template: `
        <span class="tw-font-bold">Static</span>
        <div class="tw-flex tw-gap-4 tw-mb-10">
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> small </span>
            <bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'small'"></bit-avatar>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> base </span>
            <bit-avatar [color]="'brand'" [text]="'Walt Walterson'"></bit-avatar>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> large </span>
            <bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'large'"></bit-avatar>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> xlarge </span>
            <bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'xlarge'"></bit-avatar>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> 2xlarge </span>
            <bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'2xlarge'"></bit-avatar>
          </div>
        </div>

        <span class="tw-font-bold">Interactive</span>
        <div class="tw-flex tw-gap-4 tw-mb-10">
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> small </span>
            <button bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'small'"></button>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> base </span>
            <button bit-avatar [color]="'brand'" [text]="'Walt Walterson'"></button>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> large </span>
            <button bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'large'"></button>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> xlarge </span>
            <button bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'xlarge'"></button>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> 2xlarge </span>
            <button bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'2xlarge'"></button>
          </div>
        </div>
      `,
    };
  },
};

export const DefaultColors: Story = {
  render: (args) => {
    return {
      props: args,
      template: `
        <span class="tw-font-bold">Static</span>
        <div class="tw-flex tw-gap-2 tw-mb-10">
          <bit-avatar [color]="'brand'" [text]="'Walt Walterson'"></bit-avatar>
          <bit-avatar [color]="'teal'" [text]="'Walt Walterson'"></bit-avatar>
          <bit-avatar [color]="'coral'" [text]="'Walt Walterson'"></bit-avatar>
          <bit-avatar [color]="'green'" [text]="'Walt Walterson'"></bit-avatar>
          <bit-avatar [color]="'purple'" [text]="'Walt Walterson'"></bit-avatar>
        </div>

        <span class="tw-font-bold">Interactive</span>
        <div class="tw-flex tw-gap-2">
          <button bit-avatar [color]="'brand'" [text]="'Walt Walterson'"></button>
          <button bit-avatar [color]="'teal'" [text]="'Walt Walterson'"></button>
          <button bit-avatar [color]="'coral'" [text]="'Walt Walterson'"></button>
          <button bit-avatar [color]="'green'" [text]="'Walt Walterson'"></button>
          <button bit-avatar [color]="'purple'" [text]="'Walt Walterson'"></button>
        </div>
      `,
    };
  },
};

export const ColorByID: Story = {
  render: (args) => {
    return {
      props: args,
      template: `
        <div class="tw-flex tw-gap-4">
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span class="tw-font-bold"> Static </span>
            <bit-avatar ${formatArgsForCodeSnippet<AvatarComponent>(args)}></bit-avatar>
          </div>

          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span class="tw-font-bold"> Interactive </span>
            <button bit-avatar ${formatArgsForCodeSnippet<AvatarComponent>(args)}></button>
          </div>
        </div>
      `,
    };
  },
  args: {
    id: "236478",
  },
};

export const ColorByText: Story = {
  ...ColorByID,
  args: {
    text: "Jason Doe",
  },
};

export const CustomColor: Story = {
  ...ColorByID,
  args: {
    color: "#fbd9fe",
  },
};

export const Inactive: Story = {
  render: (args) => {
    return {
      props: args,
      template: `
        <button bit-avatar ${formatArgsForCodeSnippet<AvatarComponent>(args)}></button>
      `,
    };
  },
  args: {
    disabled: true,
  },
};
