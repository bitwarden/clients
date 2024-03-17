import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { ButtonModule } from "../../../../components/src/button";
import { IconLock } from "../../icons/icon-lock";

import { AnonLayoutComponent } from "./anon-layout.component";

class MockPlatformUtilsService implements Partial<PlatformUtilsService> {
  getApplicationVersion = () => Promise.resolve("Version 2023.1.1");
}

export default {
  title: "Auth/Anon Layout",
  component: AnonLayoutComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonModule],
      providers: [
        {
          provide: PlatformUtilsService,
          useClass: MockPlatformUtilsService,
        },
      ],
    }),
  ],
  args: {
    title: "The Page Title",
    subtitle: "The subtitle (optional)",
    icon: IconLock,
  },
} as Meta;

type Story = StoryObj<AnonLayoutComponent>;

export const WithPrimaryContent: Story = {
  render: (args) => ({
    props: args,
    template:
      /**
       * The projected content (i.e. the <div> ) and styling below is just a
       * sample and could be replaced with any content and styling
       */
      `
      <auth-anon-layout [title]="title" [subtitle]="subtitle">
        <div class="tw-font-bold">Primary Projected Content Area (customizable)</div>
        <div>Lorem ipsum dolor sit amet consectetur adipisicing elit. Necessitatibus illum vero, placeat recusandae esse ratione eius minima veniam nemo, quas beatae! Impedit molestiae alias sapiente explicabo. Sapiente corporis ipsa numquam?</div>
      </auth-anon-layout>
    `,
  }),
};

export const WithSecondaryContent: Story = {
  render: (args) => ({
    props: args,
    template:
      // Notice that slot="secondary" is requred to project any secondary content:
      `
      <auth-anon-layout [title]="title" [subtitle]="subtitle">
        <div>
          <div class="tw-font-bold">Primary Projected Content Area (customizable)</div>
          <div>Lorem ipsum dolor sit amet consectetur adipisicing elit. Necessitatibus illum vero, placeat recusandae esse ratione eius minima veniam nemo, quas beatae! Impedit molestiae alias sapiente explicabo. Sapiente corporis ipsa numquam?</div>
        </div>

        <div slot="secondary" class="text-center">
          <div class="tw-font-bold tw-mb-2">Secondary Projected Content (optional)</div>
          <button bitButton>Perform Action</button>
        </div>
      </auth-anon-layout>
    `,
  }),
};

export const WithLongContent: Story = {
  render: (args) => ({
    props: args,
    template: `
      <auth-anon-layout title="Page Title lorem ipsum dolor consectetur sit amet expedita quod est" subtitle="Subtitle here Lorem ipsum dolor sit amet consectetur adipisicing elit. Expedita, quod est?">
        <div>
          <div class="tw-font-bold">Primary Projected Content Area (customizable)</div>
          <div>Lorem ipsum dolor sit amet consectetur adipisicing elit. Necessitatibus illum vero, placeat recusandae esse ratione eius minima veniam nemo, quas beatae! Impedit molestiae alias sapiente explicabo. Sapiente corporis ipsa numquam? Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit.</div>
        </div>

        <div slot="secondary" class="text-center">
          <div class="tw-font-bold tw-mb-2">Secondary Projected Content (optional)</div>
          <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Molestias laborum nostrum natus. Lorem ipsum dolor sit amet consectetur adipisicing elit. Molestias laborum nostrum natus. Expedita, quod est?          </p>
          <button bitButton>Perform Action</button>
        </div>
      </auth-anon-layout>
    `,
  }),
};

export const WithIcon: Story = {
  render: (args) => ({
    props: args,
    template: `
      <auth-anon-layout [title]="title" [subtitle]="subtitle" [icon]="icon">
        <div>
          <div class="tw-font-bold">Primary Projected Content Area (customizable)</div>
          <div>Lorem ipsum dolor sit amet consectetur adipisicing elit. Necessitatibus illum vero, placeat recusandae esse ratione eius minima veniam nemo, quas beatae! Impedit molestiae alias sapiente explicabo. Sapiente corporis ipsa numquam?</div>
        </div>
      </auth-anon-layout>
    `,
  }),
};
