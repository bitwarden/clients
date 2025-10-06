/* eslint-disable no-restricted-imports */
import { ActivatedRoute, RouterModule } from "@angular/router";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { BehaviorSubject, of } from "rxjs";

import { DeactivatedOrg } from "@bitwarden/assets/svg";
import { ClientType } from "@bitwarden/common/enums";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { AnonLayoutComponent, I18nMockService } from "@bitwarden/components";

import { LearnMoreComponent } from "./learn-more-component";
import { PhishingWarning } from "./phishing-warning.component";

class MockPlatformUtilsService implements Partial<PlatformUtilsService> {
  getApplicationVersion = () => Promise.resolve("Version 2024.1.1");
  getClientType = () => ClientType.Web;
}

/**
 * Helper function to create ActivatedRoute mock with query parameters
 */
function mockActivatedRoute(queryParams: Record<string, string>) {
  return {
    provide: ActivatedRoute,
    useValue: {
      queryParamMap: of({
        get: (key: string) => queryParams[key] || null,
      }),
      queryParams: of(queryParams),
    },
  };
}

type StoryArgs = {
  phishingHost: string;
};

export default {
  title: "Browser/DIRT/Phishing Warning",
  component: PhishingWarning,
  decorators: [
    moduleMetadata({
      imports: [AnonLayoutComponent, LearnMoreComponent, RouterModule],
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
              appLogoLabel: "Bitwarden logo",
              phishingPageTitle: "Phishing website",
              phishingPageCloseTab: "Close tab",
              phishingPageContinue: "Continue",
              phishingPageLearnWhy: "Why are you seeing this?",
              learnMore: "Learn more",
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
        mockActivatedRoute({ phishingHost: "malicious-example.com" }),
      ],
    }),
  ],
  render: (args) => ({
    props: args,
    template: /*html*/ `
      <auth-anon-layout
        title="Bitwarden blocked it!"
        subtitle="Bitwarden blocked a known phishing site from loading."
        [icon]="pageIcon"
        [showReadonlyHostname]="true"
        maxWidth="md"
      >
        <dirt-phishing-warning></dirt-phishing-warning>
        <dirt-phishing-learn-more slot="secondary"></dirt-phishing-learn-more>
      </auth-anon-layout>
    `,
  }),
  argTypes: {
    phishingHost: {
      control: "text",
      description: "The suspicious host that was blocked",
    },
  },
  args: {
    phishingHost: "malicious-example.com",
    pageIcon: DeactivatedOrg,
  },
} satisfies Meta<StoryArgs & { pageIcon: any }>;

type Story = StoryObj<StoryArgs & { pageIcon: any }>;

export const Default: Story = {
  args: {
    phishingHost: "malicious-example.com",
  },
  decorators: [
    moduleMetadata({
      providers: [mockActivatedRoute({ phishingHost: "malicious-example.com" })],
    }),
  ],
};

export const LongHostname: Story = {
  args: {
    phishingHost: "very-long-suspicious-phishing-domain-name-that-might-wrap.malicious-example.com",
  },
  decorators: [
    moduleMetadata({
      providers: [
        mockActivatedRoute({
          phishingHost:
            "very-long-suspicious-phishing-domain-name-that-might-wrap.malicious-example.com",
        }),
      ],
    }),
  ],
};
