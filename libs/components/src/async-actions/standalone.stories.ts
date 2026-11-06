import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";
import { delay, of } from "rxjs";
import { action } from "storybook/actions";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";

import { ButtonModule } from "../button";
import { IconButtonModule } from "../icon-button";
import { I18nMockService } from "../utils";

import { AsyncActionsModule } from "./async-actions.module";
import { BitActionDirective } from "./bit-action.directive";

const template = /*html*/ `
  <button type="button" bitButton buttonType="primary" [bitAction]="action" class="tw-me-2">
    Perform action {{ statusEmoji() }}
  </button>
  <button type="button" label="Delete" bitIconButton="bwi-trash" buttonType="dangerGhost" [bitAction]="action"></button>`;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template,
  selector: "app-promise-example",
  imports: [AsyncActionsModule, ButtonModule, IconButtonModule],
})
class PromiseExampleComponent {
  readonly statusEmoji = signal("🟡");
  readonly action = async () => {
    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        resolve();
        this.statusEmoji.set("🟢");
      }, 5000);
    });
  };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template,
  selector: "app-action-resolves-quickly",
  imports: [AsyncActionsModule, ButtonModule, IconButtonModule],
})
class ActionResolvesQuicklyComponent {
  readonly statusEmoji = signal("🟡");

  readonly action = async () => {
    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        resolve();
        this.statusEmoji.set("🟢");
      }, 50);
    });
  };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template,
  selector: "app-observable-example",
  imports: [AsyncActionsModule, ButtonModule, IconButtonModule],
})
class ObservableExampleComponent {
  readonly statusEmoji = signal("");

  readonly action = () => {
    return of("fake observable").pipe(delay(2000));
  };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template,
  selector: "app-rejected-promise-example",
  imports: [AsyncActionsModule, ButtonModule, IconButtonModule],
})
class RejectedPromiseExampleComponent {
  readonly statusEmoji = signal("");

  readonly action = async () => {
    await new Promise<void>((resolve, reject) => {
      setTimeout(() => reject(new Error("Simulated error")), 2000);
    });
  };
}

export default {
  title: "Component Library/Async Actions/Standalone",
  decorators: [
    moduleMetadata({
      imports: [
        ButtonModule,
        IconButtonModule,
        BitActionDirective,
        PromiseExampleComponent,
        ObservableExampleComponent,
        RejectedPromiseExampleComponent,
        ActionResolvesQuicklyComponent,
      ],
      providers: [
        {
          provide: ValidationService,
          useValue: {
            showError: action("ValidationService.showError"),
          } as Partial<ValidationService>,
        },
        {
          provide: LogService,
          useValue: {
            error: action("LogService.error"),
          } as Partial<LogService>,
        },
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              loading: "Loading",
            });
          },
        },
      ],
    }),
  ],
} as Meta;

type PromiseStory = StoryObj<PromiseExampleComponent>;
type ObservableStory = StoryObj<ObservableExampleComponent>;

export const UsingPromise: PromiseStory = {
  render: (args) => ({
    props: args,
    template: `<app-promise-example></app-promise-example>`,
  }),
};

export const UsingObservable: ObservableStory = {
  render: (args) => ({
    template: `<app-observable-example></app-observable-example>`,
  }),
};

export const RejectedPromise: ObservableStory = {
  render: (args) => ({
    template: `<app-rejected-promise-example></app-rejected-promise-example>`,
  }),
};

export const ActionResolvesQuickly: PromiseStory = {
  render: (args) => ({
    props: args,
    template: `<app-action-resolves-quickly></app-action-resolves-quickly>`,
  }),
};
