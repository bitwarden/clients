import { ActivatedRoute, RouterModule } from "@angular/router";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { BehaviorSubject, of } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { ButtonModule } from "../../../../components/src/button";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { I18nMockService } from "../../../../components/src/utils/i18n-mock.service";
import { LockIcon } from "../icons";

import { AnonLayoutComponent } from "./anon-layout.component";

class MockPlatformUtilsService implements Partial<PlatformUtilsService> {
  getApplicationVersion = () => Promise.resolve("Version 2024.1.1");
  getClientType = () => ClientType.Web;
}

export default {
  title: "Auth/Anon Layout",
  component: AnonLayoutComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonModule, RouterModule],
      providers: [
        {
          provide: PlatformUtilsService,
          useClass: MockPlatformUtilsService,
        },
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              accessing: "Accessing",
            });
          },
        },
        {
          provide: EnvironmentService,
          useValue: {
            environment$: new BehaviorSubject({
              getHostname() {
                return "bitwarden.com";
              },
            }).asObservable(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: of({}) },
        },
      ],
    }),
  ],
  args: {
    title: "The Page Title",
    subtitle: "The subtitle (optional)",
    showReadonlyHostname: true,
    icon: LockIcon,
    hideLogo: false,
  },
} as Meta;

type Story = StoryObj<AnonLayoutComponent>;

export const WithPrimaryContent: Story = {
  render: (args) => ({
    props: args,
    template:
      // Projected content (the <div>) and styling is just a sample and can be replaced with any content/styling.
      `
      <auth-anon-layout [title]="title" [subtitle]="subtitle" [showReadonlyHostname]="showReadonlyHostname" [hideLogo]="hideLogo" >
        <div>
          <div class="tw-font-bold">Primary Projected Content Area (customizable)</div>
          <div>Lorem ipsum dolor sit amet consectetur adipisicing elit. Necessitatibus illum vero, placeat recusandae esse ratione eius minima veniam nemo, quas beatae! Impedit molestiae alias sapiente explicabo. Sapiente corporis ipsa numquam?</div>
        </div>
      </auth-anon-layout>
    `,
  }),
};

export const WithSecondaryContent: Story = {
  render: (args) => ({
    props: args,
    template:
      // Projected content (the <div>'s) and styling is just a sample and can be replaced with any content/styling.
      // Notice that slot="secondary" is requred to project any secondary content.
      `
      <auth-anon-layout [title]="title" [subtitle]="subtitle" [showReadonlyHostname]="showReadonlyHostname" [hideLogo]="hideLogo" >
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
    template:
      // Projected content (the <div>'s) and styling is just a sample and can be replaced with any content/styling.
      `
      <auth-anon-layout title="Page Title lorem ipsum dolor consectetur sit amet expedita quod est" subtitle="Subtitle here Lorem ipsum dolor sit amet consectetur adipisicing elit. Expedita, quod est?" [showReadonlyHostname]="showReadonlyHostname" [hideLogo]="hideLogo" >
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

export const WithThinPrimaryContent: Story = {
  render: (args) => ({
    props: args,
    template:
      // Projected content (the <div>'s) and styling is just a sample and can be replaced with any content/styling.
      `
      <auth-anon-layout [title]="title" [subtitle]="subtitle" [showReadonlyHostname]="showReadonlyHostname" [hideLogo]="hideLogo" >
        <div class="text-center">Lorem ipsum</div>

        <div slot="secondary" class="text-center">
          <div class="tw-font-bold tw-mb-2">Secondary Projected Content (optional)</div>
          <button bitButton>Perform Action</button>
        </div>
      </auth-anon-layout>
    `,
  }),
};

export const WithCustomIcon: Story = {
  render: (args) => ({
    props: args,
    template:
      // Projected content (the <div>) and styling is just a sample and can be replaced with any content/styling.
      `
      <auth-anon-layout [title]="title" [subtitle]="subtitle" [icon]="icon" [showReadonlyHostname]="showReadonlyHostname">
        <div>
          <div class="tw-font-bold">Primary Projected Content Area (customizable)</div>
          <div>Lorem ipsum dolor sit amet consectetur adipisicing elit. Necessitatibus illum vero, placeat recusandae esse ratione eius minima veniam nemo, quas beatae! Impedit molestiae alias sapiente explicabo. Sapiente corporis ipsa numquam?</div>
        </div>
      </auth-anon-layout>
    `,
  }),
};

export const HideLogo: Story = {
  render: (args) => ({
    props: args,
    template:
      // Projected content (the <div>) and styling is just a sample and can be replaced with any content/styling.
      `
      <auth-anon-layout [title]="title" [subtitle]="subtitle" [showReadonlyHostname]="showReadonlyHostname" [hideLogo]="true" >
        <div>
          <div class="tw-font-bold">Primary Projected Content Area (customizable)</div>
          <div>Lorem ipsum dolor sit amet consectetur adipisicing elit. Necessitatibus illum vero, placeat recusandae esse ratione eius minima veniam nemo, quas beatae! Impedit molestiae alias sapiente explicabo. Sapiente corporis ipsa numquam?</div>
        </div>
      </auth-anon-layout>
    `,
  }),
};

export const HideFooter: Story = {
  render: (args) => ({
    props: args,
    template:
      // Projected content (the <div>) and styling is just a sample and can be replaced with any content/styling.
      `
      <auth-anon-layout [title]="title" [subtitle]="subtitle" [showReadonlyHostname]="showReadonlyHostname" [hideFooter]="true" [hideLogo]="hideLogo" >
        <div>
          <div class="tw-font-bold">Primary Projected Content Area (customizable)</div>
          <div>Lorem ipsum dolor sit amet consectetur adipisicing elit. Necessitatibus illum vero, placeat recusandae esse ratione eius minima veniam nemo, quas beatae! Impedit molestiae alias sapiente explicabo. Sapiente corporis ipsa numquam?</div>
        </div>
      </auth-anon-layout>
    `,
  }),
};

export const WithTitleAreaMaxWidth: Story = {
  render: (args) => ({
    props: {
      ...args,
      title: "This is a very long long title to demonstrate titleAreaMaxWidth set to 'md'",
      subtitle:
        "This is a very long subtitle that demonstrates how the max width container handles longer text content with the titleAreaMaxWidth input set to 'md'. Lorem ipsum dolor sit amet consectetur adipisicing elit. Expedita, quod est?",
    },
    template: `
      <auth-anon-layout [title]="title" [subtitle]="subtitle" [showReadonlyHostname]="showReadonlyHostname" [hideLogo]="hideLogo" [titleAreaMaxWidth]="'md'">
        <div>
          <div class="tw-font-bold">Primary Projected Content Area (customizable)</div>
          <div>Lorem ipsum dolor sit amet consectetur adipisicing elit. Necessitatibus illum vero, placeat recusandae esse ratione eius minima veniam nemo, quas beatae! Impedit molestiae alias sapiente explicabo. Sapiente corporis ipsa numquam?</div>
        </div>
      </auth-anon-layout>
    `,
  }),
};
