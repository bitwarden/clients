import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { formatArgsForCodeSnippet } from "@bitwarden/storybook";

import { BerryComponent } from "../berry";

import { AvatarComponent } from "./avatar.component";

export default {
  title: "Component Library/Avatar",
  component: AvatarComponent,
  decorators: [
    moduleMetadata({
      imports: [BerryComponent],
    }),
  ],
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
      template: /*html*/ `
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
      template: /*html*/ `
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
      template: /*html*/ `
        <span class="tw-font-bold">Static</span>
        <div class="tw-flex tw-gap-4 tw-mb-10">
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> small </span>
            <bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'sm'"></bit-avatar>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> base </span>
            <bit-avatar [color]="'brand'" [text]="'Walt Walterson'"></bit-avatar>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> large </span>
            <bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'lg'"></bit-avatar>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> xlarge </span>
            <bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'xl'"></bit-avatar>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> 2xlarge </span>
            <bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'2xl'"></bit-avatar>
          </div>
        </div>

        <span class="tw-font-bold">Interactive</span>
        <div class="tw-flex tw-gap-4 tw-mb-10">
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> small </span>
            <button bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'sm'"></button>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> base </span>
            <button bit-avatar [color]="'brand'" [text]="'Walt Walterson'"></button>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> large </span>
            <button bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'lg'"></button>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> xlarge </span>
            <button bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'xl'"></button>
          </div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-items-center">
            <span> 2xlarge </span>
            <button bit-avatar [color]="'brand'" [text]="'Walt Walterson'" [size]="'2xl'"></button>
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
      template: /*html*/ `
        <span class="tw-font-bold">Static</span>
        <div class="tw-flex tw-gap-2 tw-mb-10">
          <bit-avatar [color]="'brand'" [text]="'Walt Walterson'"></bit-avatar>
          <bit-avatar [color]="'teal'" [text]="'Walt Walterson'"></bit-avatar>
          <bit-avatar [color]="'coral'" [text]="'Walt Walterson'"></bit-avatar>
          <bit-avatar [color]="'green'" [text]="'Walt Walterson'"></bit-avatar>
          <bit-avatar [color]="'purple'" [text]="'Walt Walterson'"></bit-avatar>
        </div>

        <span class="tw-font-bold">Interactive</span>
        <div class="tw-flex tw-gap-2 tw-mb-10">
          <button bit-avatar [color]="'brand'" [text]="'Walt Walterson'"></button>
          <button bit-avatar [color]="'teal'" [text]="'Walt Walterson'"></button>
          <button bit-avatar [color]="'coral'" [text]="'Walt Walterson'"></button>
          <button bit-avatar [color]="'green'" [text]="'Walt Walterson'"></button>
          <button bit-avatar [color]="'purple'" [text]="'Walt Walterson'"></button>
        </div>

        <span class="tw-font-bold">Interactive (Defaults as Hexes)</span>
        <div class="tw-flex tw-gap-2">
          <button bit-avatar [color]="'#175ddc'" [text]="'Walt Walterson'"></button>
          <button bit-avatar [color]="'#007c95'" [text]="'Walt Walterson'"></button>
          <button bit-avatar [color]="'#c71800'" [text]="'Walt Walterson'"></button>
          <button bit-avatar [color]="'#008236'" [text]="'Walt Walterson'"></button>
          <button bit-avatar [color]="'#8200db'" [text]="'Walt Walterson'"></button>
        </div>
      `,
    };
  },
};

export const ColorByID: Story = {
  render: (args) => {
    return {
      props: args,
      template: /*html*/ `
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

export const Status: Story = {
  render: (args) => {
    return {
      props: args,
      template: /*html*/ `
        <div class="tw-flex tw-gap-4 tw-mb-10">
          @for (size of ["sm", "base", "lg", "xl", "2xl"]; track size) {
            <bit-avatar [color]="'teal'" [text]="'Walt Walterson'" [size]="size">
              <bit-berry slot="status" type="status" variant="success" role="img" aria-label="Online"></bit-berry>
            </bit-avatar>
          }
        </div>

        <span class="tw-font-bold">On different backgrounds</span>
        <div class="tw-flex tw-gap-4 tw-mb-10">
          @for (bg of ["tw-bg-bg-primary", "tw-bg-bg-secondary", "tw-bg-bg-brand-soft", "tw-bg-bg-dark"]; track bg) {
            <div class="tw-p-3 tw-rounded" [class]="bg">
              <bit-avatar [color]="'teal'" [text]="'Walt Walterson'" [size]="'2xl'">
                <bit-berry slot="status" type="status" variant="success" role="img" aria-label="Online"></bit-berry>
              </bit-avatar>
            </div>
          }
        </div>

        <span class="tw-font-bold">Interactive</span>
        <div class="tw-flex tw-gap-4">
          <button bit-avatar [color]="'teal'" [text]="'Walt Walterson'" [size]="'2xl'">
            <bit-berry slot="status" type="status" variant="success" role="img" aria-label="Online"></bit-berry>
          </button>
          <button bit-avatar [color]="'teal'" [text]="'Walt Walterson'" [size]="'2xl'" class="tw-test-hover">
            <bit-berry slot="status" type="status" variant="success" role="img" aria-label="Online"></bit-berry>
          </button>
          <button bit-avatar [color]="'teal'" [text]="'Walt Walterson'" [size]="'2xl'" class="tw-test-focus-visible">
            <bit-berry slot="status" type="status" variant="success" role="img" aria-label="Online"></bit-berry>
          </button>
        </div>
      `,
    };
  },
};

export const InteractionStates: Story = {
  render: (args) => {
    return {
      props: args,
      template: /*html*/ `
        <div class="tw-grid tw-grid-cols-[auto_repeat(3,minmax(0,1fr))] tw-gap-x-4 tw-gap-y-4 tw-items-center tw-max-w-[700px]">
          <span></span>
          <span class="tw-text-center">Avatar</span>
          <span class="tw-text-center">Hover</span>
          <span class="tw-text-center">Focus-visible</span>

          <span class="tw-font-bold">Default Color</span>
          <button bit-avatar [color]="'brand'" [text]="'Walt Walterson'" class="tw-justify-self-center"></button>
          <button bit-avatar [color]="'brand'" [text]="'Walt Walterson'" class="tw-test-hover tw-justify-self-center"></button>
          <button bit-avatar [color]="'brand'" [text]="'Walt Walterson'" class="tw-test-focus-visible tw-justify-self-center"></button>

          <span class="tw-font-bold">Custom Color</span>
          <button bit-avatar [color]="'#fbd9fe'" [text]="'Walt Walterson'" class="tw-justify-self-center"></button>
          <button bit-avatar [color]="'#fbd9fe'" [text]="'Walt Walterson'" class="tw-test-hover tw-justify-self-center"></button>
          <button bit-avatar [color]="'#fbd9fe'" [text]="'Walt Walterson'" class="tw-test-focus-visible tw-justify-self-center"></button>
        </div>
      `,
    };
  },
};

export const Inactive: Story = {
  render: (args) => {
    return {
      props: args,
      template: /*html*/ `
        <button bit-avatar ${formatArgsForCodeSnippet<AvatarComponent>(args)}></button>
      `,
    };
  },
  args: {
    disabled: true,
  },
};
