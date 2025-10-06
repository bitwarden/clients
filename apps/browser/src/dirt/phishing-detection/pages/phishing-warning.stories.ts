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

import { PhishingWarning } from "./phishing-warning.component";
import { ProtectedByComponent } from "./protected-by-component";

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
      imports: [AnonLayoutComponent, ProtectedByComponent, RouterModule],
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
              phishingPageTitle: "Phishing Attempt Detected",
              phishingPageCloseTab: "Close this tab",
              phishingPageContinue: "Continue to this site (not recommended)",
              phishingPageExplanation1: "This site was found in ",
              phishingPageExplanation2:
                ", an open-source list of known phishing sites used for stealing personal and sensitive information.",
              phishingPageLearnMore: "Learn more about phishing detection",
              protectedBy: (product) => `Protected by ${product}`,
              learnMore: "Learn more",
              danger: "error",
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
        [hideIcon]="true"
        [showReadonlyHostname]="true"
        [hideBackgroundIllustration]="true"
      >
        <dirt-phishing-warning></dirt-phishing-warning>
        <dirt-phishing-protected-by slot="secondary"></dirt-phishing-protected-by>
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
