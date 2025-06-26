import { ActivatedRoute, RouterModule } from "@angular/router";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { BehaviorSubject, of } from "rxjs";

import { ClientType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { ButtonModule } from "../button";
import { LockIcon } from "../icon/icons";
import { I18nMockService } from "../utils/i18n-mock.service";

import { AnonLayoutComponent } from "./anon-layout.component";

class MockPlatformUtilsService implements Partial<PlatformUtilsService> {
  getApplicationVersion = () => Promise.resolve("Version 2024.1.1");
  getClientType = () => ClientType.Web;
}

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
          useFactory: () => {
            return new I18nMockService({
              accessing: "Accessing",
              appLogoLabel: "app logo label",
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
  argTypes: {
    title: { control: "text" },
    subtitle: { control: "text" },

    icon: { control: false, table: { disable: true } },

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
    showReadonlyHostname: true,
    maxWidth: "md",
    hideCardWrapper: false,
    hideIcon: false,
    hideLogo: false,
    hideFooter: false,
    contentLength: "normal",
    showSecondary: true,
  },
} as Meta;

type Story = StoryObj<AnonLayoutComponent>;

export const Playground: Story = {
  render: (args) => ({
    props: args,
    template: `
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
        <!-- primary content -->
        <ng-container [ngSwitch]="contentLength">
          <div *ngSwitchCase="'thin'" class="tw-text-center">Thin content</div>
          <div *ngSwitchCase="'long'">
            <div class="tw-font-bold">Long Content</div>
            <div>
           <div>Lorem ipsum dolor sit amet consectetur adipisicing elit. Necessitatibus illum vero, placeat recusandae esse ratione eius minima veniam nemo, quas beatae! Impedit molestiae alias sapiente explicabo. Sapiente corporis ipsa numquam? Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit.</div>
            </div>
          </div>
          <div *ngSwitchDefault>
            <div class="tw-font-bold">Normal Content</div>
            <div>Lorem ipsum dolor sit amet consectetur adipisicing elit. Necessitatibus illum vero, placeat veniam nemo. </div>
          </div>
        </ng-container>

        <!-- secondary content, if toggled on -->
        <div *ngIf="showSecondary" slot="secondary" class="tw-text-center">
           <div class="tw-font-bold tw-mb-2">Secondary Projected Content (optional)
          </div>
        </div>
      </auth-anon-layout>
    `,
  }),
};

export const WithDefaultIcon: Story = {
  render: (args) => ({
    props: args,
    template: `
   <auth-anon-layout
        [title]="title"
        [subtitle]="subtitle"
        [showReadonlyHostname]="showReadonlyHostname"
        [maxWidth]="maxWidth"
        [hideCardWrapper]="hideCardWrapper"
        [hideIcon]="hideIcon"
        [hideLogo]="hideLogo"
        [hideFooter]="hideFooter"
      >
        <!-- primary content -->
        <ng-container [ngSwitch]="contentLength">
          <div *ngSwitchCase="'thin'" class="tw-text-center">Thin content</div>
          <div *ngSwitchCase="'long'">
            <div class="tw-font-bold">Long Content</div>
            <div>
           <div>Lorem ipsum dolor sit amet consectetur adipisicing elit. Necessitatibus illum vero, placeat recusandae esse ratione eius minima veniam nemo, quas beatae! Impedit molestiae alias sapiente explicabo. Sapiente corporis ipsa numquam? Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit. Lorem ipsum dolor sit amet consectetur adipisicing elit.</div>
            </div>
          </div>
          <div *ngSwitchDefault>
            <div class="tw-font-bold">Normal Content</div>
            <div>Lorem ipsum dolor sit amet consectetur adipisicing elit. Necessitatibus illum vero, placeat veniam nemo. </div>
          </div>
        </ng-container>

        <!-- secondary content, if toggled on -->
        <div *ngIf="showSecondary" slot="secondary" class="tw-text-center">
           <div class="tw-font-bold tw-mb-2">Secondary Projected Content (optional)
          </div>
        </div>
      </auth-anon-layout>
    `,
  }),
};
