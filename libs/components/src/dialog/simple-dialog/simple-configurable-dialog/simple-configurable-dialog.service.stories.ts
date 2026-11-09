import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { provideAnimations } from "@angular/platform-browser/animations";
import { Meta, StoryObj, applicationConfig } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { SimpleDialogOptions, DialogService } from "../..";
import { ButtonModule } from "../../../button";
import { CalloutModule } from "../../../callout";
import { I18nMockService } from "../../../utils/i18n-mock.service";
import { DialogModule } from "../../dialog.module";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (group of dialogs; track group) {
      <div>
        <h2>{{ group.title }}</h2>
        <div class="tw-mb-4 tw-flex tw-flex-row tw-gap-2">
          @for (dialog of group.dialogs; track dialog) {
            <button type="button" bitButton (click)="openSimpleConfigurableDialog(dialog)">
              {{ dialog.title }}
            </button>
          }
        </div>
      </div>
    }

    @if (dialogCloseResult() !== undefined) {
      <bit-callout [type]="dialogCloseResult() ? 'success' : 'info'" title="Dialog Close Result">
        {{ dialogCloseResult() }}
      </bit-callout>
    }
  `,
  imports: [ButtonModule, CalloutModule, DialogModule],
})
class StoryDialogComponent {
  readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);

  protected readonly dialogs: { title: string; dialogs: SimpleDialogOptions[] }[] = [
    {
      title: "Regular",
      dialogs: [
        {
          title: this.i18nService.t("primaryTypeSimpleDialog"),
          content: this.i18nService.t("dialogContent"),
          type: "primary",
        },
        {
          title: this.i18nService.t("successTypeSimpleDialog"),
          content: this.i18nService.t("dialogContent"),
          type: "success",
        },
        {
          title: this.i18nService.t("infoTypeSimpleDialog"),
          content: this.i18nService.t("dialogContent"),
          type: "info",
        },
        {
          title: this.i18nService.t("warningTypeSimpleDialog"),
          content: this.i18nService.t("dialogContent"),
          type: "warning",
        },
        {
          title: this.i18nService.t("dangerTypeSimpleDialog"),
          content: this.i18nService.t("dialogContent"),
          type: "danger",
        },
      ],
    },
    {
      title: "Custom",
      dialogs: [
        {
          title: this.i18nService.t("primaryTypeSimpleDialog"),
          content: this.i18nService.t("dialogContent"),
          type: "primary",
          acceptButtonText: "Ok",
          cancelButtonText: undefined,
        },
        {
          title: this.i18nService.t("primaryTypeSimpleDialog"),
          content: this.i18nService.t("dialogContent"),
          type: "primary",
          acceptButtonText: this.i18nService.t("accept"),
          cancelButtonText: this.i18nService.t("decline"),
        },
        {
          title: this.i18nService.t("primaryTypeSimpleDialog"),
          content: this.i18nService.t("dialogContent"),
          type: "primary",
          acceptButtonText: "Ok",
        },
      ],
    },
    {
      title: "Icon",
      dialogs: [
        {
          title: this.i18nService.t("primaryTypeSimpleDialog"),
          content: this.i18nService.t("dialogContent"),
          type: "primary",
          icon: "bwi-family",
        },
      ],
    },
    {
      title: "Additional",
      dialogs: [
        {
          title: this.i18nService.t("primaryTypeSimpleDialog"),
          content: this.i18nService.t("dialogContent"),
          type: "primary",
          disableClose: true,
        },
        {
          title: this.i18nService.t("asyncTypeSimpleDialog"),
          content: this.i18nService.t("dialogContent"),
          acceptAction: () => {
            return new Promise((resolve) => setTimeout(resolve, 10000));
          },
          type: "primary",
        },
      ],
    },
  ];

  protected readonly dialogCloseResult = signal<boolean | undefined>(undefined);

  async openSimpleConfigurableDialog(opts: SimpleDialogOptions) {
    this.dialogCloseResult.set(await this.dialogService.openSimpleDialog(opts));
  }
}

export default {
  title: "Component Library/Dialogs/Service/SimpleConfigurable",
  component: StoryDialogComponent,
  decorators: [
    applicationConfig({
      providers: [
        provideAnimations(),
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              primaryTypeSimpleDialog: "Primary Type Simple Dialog",
              successTypeSimpleDialog: "Success Type Simple Dialog",
              infoTypeSimpleDialog: "Info Type Simple Dialog",
              warningTypeSimpleDialog: "Warning Type Simple Dialog",
              dangerTypeSimpleDialog: "Danger Type Simple Dialog",
              asyncTypeSimpleDialog: "Async",
              dialogContent: "Dialog content goes here",
              yes: "Yes",
              no: "No",
              ok: "Ok",
              cancel: "Cancel",
              accept: "Accept",
              decline: "Decline",
              close: "Close",
              callout: "Callout",
            });
          },
        },
      ],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21514-19247&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj<StoryDialogComponent>;

export const Default: Story = {};
