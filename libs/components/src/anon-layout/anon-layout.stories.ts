import { ActivatedRoute, RouterModule } from "@angular/router";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { BehaviorSubject, of } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { ButtonModule } from "../button";
import { Icon } from "../icon";
import { LockIcon } from "../icon/icons";
import { I18nMockService } from "../utils/i18n-mock.service";

import { AnonLayoutComponent } from "./anon-layout.component";

class MockPlatformUtilsService implements Partial<PlatformUtilsService> {
  getApplicationVersion = () => Promise.resolve("Version 2024.1.1");
  getClientType = () => ClientType.Web;
}

type StoryArgs = AnonLayoutComponent & {
  contentLength: "normal" | "long" | "thin";
  showSecondary: boolean;
  useDefaultIcon: boolean;
  icon: Icon;
};

export default {
  title: "Component Library/Anon Layout",
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
          useFactory: () =>
            new I18nMockService({
              accessing: "Accessing",
              appLogoLabel: "app logo label",
            }),
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
  render: (args) => {
    const { useDefaultIcon, icon, ...rest } = args;
    return {
      props: {
        ...rest,
        icon: useDefaultIcon ? null : icon,
      },
      template: /*html*/ `
        <auth-anon-layout
          [title]="title"
          [subtitle]="subtitle"
          [icon]="icon"
          [showReadonlyHostname]="showReadonlyHostname"
          [maxWidth]="maxWidth"
          [hideCardWrapper]="hideCardWrapper"
          [hideIcon]="hideIcon"
          [hideLogo]="hideLogo"
          [hideFooter]="hideFooter"
        >
          <ng-container [ngSwitch]="contentLength">
            <div *ngSwitchCase="'thin'" class="tw-text-center">  <div class="tw-font-bold">Thin Content</div></div>
            <div *ngSwitchCase="'long'">
              <div class="tw-font-bold">Long Content</div>
              <div>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?</div>
              <div>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?</div>
            </div>
            <div *ngSwitchDefault>
              <div class="tw-font-bold">Normal Content</div>
              <div>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. </div>
            </div>
          </ng-container>

          <div *ngIf="showSecondary" slot="secondary" class="tw-text-center">
            <div class="tw-font-bold tw-mb-2">
              Secondary Projected Content (optional)
            </div>
            <button bitButton>Perform Action</button>
          </div>
        </auth-anon-layout>
      `,
    };
  },

  argTypes: {
    title: { control: "text" },
    subtitle: { control: "text" },

    icon: { control: false, table: { disable: true } },
    useDefaultIcon: {
      control: false,
      table: { disable: true },
      description: "If true, passes null so component falls back to its built-in icon",
    },

    showReadonlyHostname: { control: "boolean" },
    maxWidth: {
      control: "select",
      options: ["md", "lg", "xl", "2xl", "3xl"],
    },

    hideCardWrapper: { control: "boolean" },
    hideIcon: { control: "boolean" },
    hideLogo: { control: "boolean" },
    hideFooter: { control: "boolean" },

    contentLength: {
      control: "radio",
      options: ["normal", "long", "thin"],
    },

    showSecondary: { control: "boolean" },
  },

  args: {
    title: "The Page Title",
    subtitle: "The subtitle (optional)",
    icon: LockIcon,
    useDefaultIcon: false,
    showReadonlyHostname: false,
    maxWidth: "md",
    hideCardWrapper: false,
    hideIcon: false,
    hideLogo: false,
    hideFooter: false,
    contentLength: "normal",
    showSecondary: false,
  },
} satisfies Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

export const NormalPrimaryContent: Story = {
  args: {
    contentLength: "normal",
  },
};

export const LongPrimaryContent: Story = {
  args: {
    contentLength: "long",
  },
};

export const ThinPrimaryContent: Story = {
  args: {
    contentLength: "thin",
  },
};

export const LongContentAndTitlesAndDefaultWidth: Story = {
  args: {
    title:
      "This is a very long title that might not fit in the default width. It's really long and descriptive, so it might take up more space than usual.",
    subtitle:
      "This is a very long subtitle that might not fit in the default width. It's really long and descriptive, so it might take up more space than usual.",
    contentLength: "long",
  },
};

export const LongContentAndTitlesAndLargestWidth: Story = {
  args: {
    title:
      "This is a very long title that might not fit in the default width. It's really long and descriptive, so it might take up more space than usual.",
    subtitle:
      "This is a very long subtitle that might not fit in the default width. It's really long and descriptive, so it might take up more space than usual.",
    contentLength: "long",
    maxWidth: "3xl",
  },
};

export const SecondaryContent: Story = {
  args: {
    showSecondary: true,
  },
};

export const NoTitle: Story = { args: { title: undefined } };

export const NoSubtitle: Story = { args: { subtitle: undefined } };

export const NoWrapper: Story = {
  args: { hideCardWrapper: true },
};

export const DefaultIcon: Story = {
  args: { useDefaultIcon: true },
};

export const NoIcon: Story = {
  args: { hideIcon: true },
};

export const NoLogo: Story = {
  args: { hideLogo: true },
};

export const NoFooter: Story = {
  args: { hideFooter: true },
};

export const ReadonlyHostname: Story = {
  args: { showReadonlyHostname: true },
};

export const MinimalState: Story = {
  args: {
    title: undefined,
    subtitle: undefined,
    contentLength: "normal",
    hideCardWrapper: true,
    hideIcon: true,
    hideLogo: true,
    hideFooter: true,
  },
};
