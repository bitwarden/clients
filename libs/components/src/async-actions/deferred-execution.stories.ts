import { Component, Input } from "@angular/core";
import { action } from "@storybook/addon-actions";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";

import { ButtonModule } from "../button";
import { IconButtonModule } from "../icon-button";

import { AsyncContextService } from "./async-context.service";
import { BitAsyncClickDirective } from "./bit-async-click.directive";
import { BitAsyncContextDirective } from "./bit-async-context.directive";
import { BitAsyncDisableDirective } from "./bit-async-disable.directive";
import { BitAsyncEvent } from "./bit-async-event";

@Component({
  template: `<h2 *ngIf="name" class="tw-text-main">Parent</h2>
    <button bitButton buttonType="primary" [bitAsyncClick]="action" class="tw-mr-2">
      Perform action
    </button>
    <ng-content></ng-content>`,
  selector: "app-parent",
  providers: [AsyncContextService],
})
class ParentComponent {
  @Input() name?: string = undefined;

  action = async () => {
    await new Promise<void>((resolve, reject) => {
      setTimeout(resolve, 2000);
    });
  };
}

export default {
  title: "Component Library/Async Actions/Deferred Execution",
  decorators: [
    moduleMetadata({
      declarations: [
        BitAsyncClickDirective,
        BitAsyncDisableDirective,
        BitAsyncContextDirective,
        ParentComponent,
      ],
      imports: [ButtonModule, IconButtonModule],
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
      ],
    }),
  ],
} as Meta;

type SimpleStory = StoryObj<unknown>;
type WithExecutionStory = StoryObj<unknown>;

const rootContext = new AsyncContextService();

export const Simple: SimpleStory = {
  render: (args: object) => ({
    props: {
      action: action("bitAsyncClick"),
      ...args,
    },
    moduleMetadata: {
      providers: [{ provide: AsyncContextService, useValue: rootContext }], // Mock root-level context
    },
    template: `
      <button bitButton buttonType="primary" (bitAsyncClick)="action($event)">Button</button>
    `,
  }),
  parameters: {
    docs: {
      source: {
        code: `<button bitButton buttonType="primary" (bitAsyncClick)="action($event)">Button</button>`,
      },
    },
  },
};

export const WithExecution: WithExecutionStory = {
  render: (args: object) => ({
    props: {
      action: (event: BitAsyncEvent) =>
        rootContext.execute(event, () => new Promise<void>((resolve) => setTimeout(resolve, 2000))),
      ...args,
    },
    moduleMetadata: {
      providers: [{ provide: AsyncContextService, useValue: rootContext }], // Mock root-level context
    },
    template: `
      <!-- Simulate an event that passes through multiple async contexts -->
      <ng-container bitAsyncContext>
        <ng-container bitAsyncContext>
          <button class="tw-ml-2" bitButton buttonType="primary" (bitAsyncClick)="action($event)">Primary</button>
          <button class="tw-ml-2" bitButton buttonType="secondary" (bitAsyncClick)="action($event)">Secondary</button>
          <button class="tw-ml-2" bitButton buttonType="danger" (bitAsyncClick)="action($event)">Delete</button>
        </ng-container>
      </ng-container>
    `,
  }),
  parameters: {
    docs: {
      source: {
        code: `
          <!-- Simulate an event that passes through multiple async contexts -->
          <ng-container bitAsyncContext>
            <ng-container bitAsyncContext>
              <button class="tw-ml-2" bitButton buttonType="primary" (bitAsyncClick)="action($event)">Primary</button>
              <button class="tw-ml-2" bitButton buttonType="secondary" (bitAsyncClick)="action($event)">Secondary</button>
              <button class="tw-ml-2" bitButton buttonType="danger" (bitAsyncClick)="action($event)">Delete</button>
            </ng-container>
          </ng-container>`,
      },
    },
  },
};
