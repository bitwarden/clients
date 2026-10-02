import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { I18nMockService } from "../utils/i18n-mock.service";

import { CoachmarkTour } from "./coachmark-tour";
import { CoachmarkComponent } from "./coachmark.component";

export default {
  title: "Component Library/Coachmark",
  component: CoachmarkComponent,
  decorators: [
    moduleMetadata({
      imports: [CoachmarkComponent, ButtonModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              back: "Back",
              next: "Next",
              close: "Close",
              learnMore: "Learn more",
              loading: "Loading",
              coachmarkStepsIndicator: (current, total) => `${current} of ${total}`,
            }),
        },
      ],
    }),
  ],
  parameters: {
    // Popover positioning is flaky in snapshots, see CL-822
    chromatic: { disableSnapshot: true },
  },
} as Meta<CoachmarkComponent>;

type Story = StoryObj<CoachmarkComponent>;

const cardClasses =
  "tw-p-6 tw-border tw-border-solid tw-border-secondary-300 tw-rounded-lg tw-bg-background tw-text-center";

export const Tour: Story = {
  render: () => ({
    props: {
      tour: new CoachmarkTour([
        { id: "create", position: "below-center" },
        { id: "search", position: "below-center" },
        { id: "settings", position: "below-center" },
      ]),
    },
    template: /*html*/ `
      <div class="tw-h-[500px] tw-mt-32">
        <button type="button" bitButton buttonType="primary" class="tw-mb-6" (click)="tour.start()">
          Start tour
        </button>

        <div class="tw-grid tw-grid-cols-3 tw-gap-4">
          <div #create class="${cardClasses}">Create</div>
          <div #search class="${cardClasses}">Search</div>
          <div #settings class="${cardClasses}">Settings</div>
        </div>
      </div>

      <bit-coachmark [tour]="tour" step="create" [anchor]="create" title="Create items">
        Add passwords, notes, and other secure items.
      </bit-coachmark>
      <bit-coachmark
        [tour]="tour"
        step="search"
        [anchor]="search"
        title="Search"
        learnMoreUrl="https://bitwarden.com/help/"
      >
        Find any item in your vault.
      </bit-coachmark>
      <bit-coachmark [tour]="tour" step="settings" [anchor]="settings" title="Settings">
        Update preferences and security options.
      </bit-coachmark>
    `,
  }),
};

/**
 * A step whose `when` fails is skipped and left out of the count, so this tour reads "1 of 2".
 */
export const ConditionalStep: Story = {
  render: () => ({
    props: {
      tour: new CoachmarkTour([
        { id: "create", position: "below-center" },
        { id: "search", position: "below-center", when: () => false },
        { id: "settings", position: "below-center" },
      ]),
    },
    template: /*html*/ `
      <div class="tw-h-[500px] tw-mt-32">
        <button type="button" bitButton buttonType="primary" class="tw-mb-6" (click)="tour.start()">
          Start tour
        </button>

        <div class="tw-grid tw-grid-cols-3 tw-gap-4">
          <div #create class="${cardClasses}">Create</div>
          <div #search class="${cardClasses}">Search (skipped)</div>
          <div #settings class="${cardClasses}">Settings</div>
        </div>
      </div>

      <bit-coachmark [tour]="tour" step="create" [anchor]="create" title="Create items">
        Add passwords, notes, and other secure items.
      </bit-coachmark>
      <bit-coachmark [tour]="tour" step="search" [anchor]="search" title="Search">
        Never shown.
      </bit-coachmark>
      <bit-coachmark [tour]="tour" step="settings" [anchor]="settings" title="Settings">
        Update preferences and security options.
      </bit-coachmark>
    `,
  }),
};
