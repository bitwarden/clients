import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { ClientType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { ButtonModule } from "../button";

import { LandingLayoutComponent } from "./landing-layout.component";

class MockPlatformUtilsService implements Partial<PlatformUtilsService> {
  getClientType = () => ClientType.Web;
}

type StoryArgs = LandingLayoutComponent & {
  contentLength: "normal" | "long" | "thin";
  includeHeader: boolean;
  includeFooter: boolean;
};

export default {
  title: "Component Library/Landing Layout",
  component: LandingLayoutComponent,
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
  render: (args) => {
    return {
      props: args,
      template: /*html*/ `
        <bit-landing-layout
          [hideBackgroundIllustration]="hideBackgroundIllustration"
        >
          @if (includeHeader) {
            <bit-landing-header>
              <div class="tw-p-4">
                <div class="tw-flex tw-items-center tw-gap-4">
                  <div class="tw-text-xl tw-font-semibold">Header Content</div>
                </div>
              </div>
            </bit-landing-header>
          }

          <div>
            @switch (contentLength) {
              @case ('thin') {
                <div class="tw-text-center tw-p-8">
                  <div class="tw-font-medium">Thin Content</div>
                </div>
              }
              @case ('long') {
                <div class="tw-p-8">
                  <div class="tw-font-medium tw-mb-4">Long Content</div>
                  <div class="tw-mb-4">Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?</div>
                  <div class="tw-mb-4">Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?</div>
                </div>
              }
              @default {
                <div class="tw-p-8">
                  <div class="tw-font-medium tw-mb-4">Normal Content</div>
                  <div>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</div>
                </div>
              }
            }
          </div>

          @if (includeFooter) {
            <bit-landing-footer>
              <div class="tw-text-center tw-text-sm tw-text-muted">
                <div>Footer Content</div>
              </div>
            </bit-landing-footer>
          }
        </bit-landing-layout>
      `,
    };
  },

  argTypes: {
    hideBackgroundIllustration: { control: "boolean" },
    contentLength: {
      control: "radio",
      options: ["normal", "long", "thin"],
    },
    includeHeader: { control: "boolean" },
    includeFooter: { control: "boolean" },
  },

  args: {
    hideBackgroundIllustration: false,
    contentLength: "normal",
    includeHeader: false,
    includeFooter: false,
  },
} satisfies Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

export const Default: Story = {
  args: {
    contentLength: "normal",
  },
};

export const WithHeader: Story = {
  args: {
    includeHeader: true,
  },
};

export const WithFooter: Story = {
  args: {
    includeFooter: true,
  },
};

export const WithHeaderAndFooter: Story = {
  args: {
    includeHeader: true,
    includeFooter: true,
  },
};

export const LongContent: Story = {
  args: {
    contentLength: "long",
    includeHeader: true,
    includeFooter: true,
  },
};

export const ThinContent: Story = {
  args: {
    contentLength: "thin",
    includeHeader: true,
    includeFooter: true,
  },
};

export const NoBackgroundIllustration: Story = {
  args: {
    hideBackgroundIllustration: true,
    includeHeader: true,
    includeFooter: true,
  },
};

export const MinimalState: Story = {
  args: {
    contentLength: "thin",
    hideBackgroundIllustration: true,
    includeHeader: false,
    includeFooter: false,
  },
};
