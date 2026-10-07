import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  viewChild,
} from "@angular/core";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { ButtonModule } from "../button";
import { I18nMockService } from "../utils/i18n-mock.service";

import { CoachmarkTourService } from "./coachmark-tour.service";
import { CoachmarkComponent } from "./coachmark.component";

/** Three cards and a tour over them; `skipSearch` drops the middle step with `when`. */
@Component({
  selector: "demo-tour",
  imports: [CoachmarkComponent, ButtonModule],
  providers: [CoachmarkTourService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: /*html*/ `
    <div class="tw-h-[500px] tw-mt-32">
      <button type="button" bitButton buttonType="primary" class="tw-mb-6" (click)="tour.start()">
        Start tour
      </button>

      <div class="tw-grid tw-grid-cols-3 tw-gap-4">
        <div #create [class]="cardClasses">Create</div>
        <div #search [class]="cardClasses">Search{{ skipSearch() ? " (skipped)" : "" }}</div>
        <div #settings [class]="cardClasses">Settings</div>
      </div>
    </div>

    <bit-coachmark step="create" title="Create items">
      Add passwords, notes, and other secure items.
    </bit-coachmark>
    <bit-coachmark step="search" title="Search" learnMoreUrl="https://bitwarden.com/help/">
      Find any item in your vault.
    </bit-coachmark>
    <bit-coachmark step="settings" title="Settings">
      Update preferences and security options.
    </bit-coachmark>
  `,
})
class DemoTourComponent {
  protected readonly cardClasses =
    "tw-p-6 tw-border tw-border-solid tw-border-secondary-300 tw-rounded-lg tw-bg-background tw-text-center";
  readonly skipSearch = input(false);

  protected readonly tour = inject(CoachmarkTourService);
  private readonly create = viewChild.required("create", { read: ElementRef<HTMLElement> });
  private readonly search = viewChild.required("search", { read: ElementRef<HTMLElement> });
  private readonly settings = viewChild.required("settings", { read: ElementRef<HTMLElement> });

  constructor() {
    this.tour.configure([
      { id: "create", anchor: this.create, position: "below-center" },
      {
        id: "search",
        anchor: this.search,
        position: "below-center",
        when: () => !this.skipSearch(),
      },
      { id: "settings", anchor: this.settings, position: "below-center" },
    ]);
  }
}

export default {
  title: "Component Library/Coachmark",
  component: CoachmarkComponent,
  decorators: [
    moduleMetadata({
      imports: [DemoTourComponent],
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

export const Tour: Story = {
  render: () => ({ template: `<demo-tour />` }),
};

/**
 * A step whose `when` fails is skipped and left out of the count, so this tour reads "1 of 2".
 */
export const ConditionalStep: Story = {
  render: () => ({ template: `<demo-tour [skipSearch]="true" />` }),
};
