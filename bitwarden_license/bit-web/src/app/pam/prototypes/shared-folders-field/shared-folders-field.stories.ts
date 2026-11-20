import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Directive,
  importProvidersFrom,
  input,
} from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { NgSelectModule } from "@ng-select/ng-select";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BitFormFieldControlDirective,
  ButtonModule,
  CardComponent,
  ChipComponent,
  FormFieldModule,
  I18nMockService,
  IconButtonModule,
  IconModule,
  IconTileComponent,
  LinkModule,
  SelectItemView,
  SpinnerComponent,
  TypographyModule,
} from "@bitwarden/components";

/**
 * Satisfies `bit-form-field`'s requirement for a projected `BitFormFieldControlDirective` when the
 * field is rendering an `ng-select` in its `[bitCustomInput]` slot. `bit-multi-select` does the
 * same via `hostDirectives` on itself; the prototype applies the pattern to raw `ng-select` so the
 * form-field chrome (label `for=`, required marker, hint, error wiring) stays intact.
 */
@Directive({
  selector: "ng-select[bitCustomInput]",
  standalone: true,
  hostDirectives: [BitFormFieldControlDirective],
})
class NgSelectFormFieldControlDirective {}

/**
 * Shared folder with the one bit we need to know in this prototype: whether the
 * folder has an access rule applied. "Controlled access" in the UI = `controlled: true`.
 */
interface SharedFolderOption extends SelectItemView {
  controlled: boolean;
}

/**
 * Map a folder's controlled-access status onto the fields the multi-select renders.
 * - Controlled: `bwi-encrypted` tile on the row (req 2.a), chip icon stays encrypted (req 2.c).
 * - Regular: `bwi-collection-shared` tile (req 3), chip icon matches.
 *
 * The brief's requirement 2.b — a "Controlled access" second line under the name — is
 * *not* expressible in `bit-multi-select` today: its option template renders a single
 * `item.listName` row. The prototype drops a layer and renders the design directly
 * against `ng-select` so the behavior is demonstrable; production still needs the
 * extension on `bit-multi-select` — pending Desmond.
 */
const makeOption = (id: string, name: string, controlled: boolean): SharedFolderOption => ({
  id,
  listName: name,
  labelName: name,
  icon: controlled ? "bwi-encrypted" : "bwi-collection-shared",
  iconTile: controlled
    ? { icon: "bwi-encrypted", variant: "brand" }
    : { icon: "bwi-collection-shared", variant: "gray" },
  controlled,
});

const DEFAULT_FOLDERS: SharedFolderOption[] = [
  makeOption("aws-prod", "AWS production", true),
  makeOption("aws-dev", "AWS dev sandbox", false),
  makeOption("data-warehouse", "Data warehouse", true),
  makeOption("data-scratch", "Data scratchpad", false),
  makeOption("finance-ops", "Finance operations", true),
  makeOption("hr-general", "HR general", false),
];

const LONG_NAME_FOLDERS: SharedFolderOption[] = [
  makeOption(
    "long-controlled",
    "North America regional operations infrastructure production control plane",
    true,
  ),
  makeOption(
    "long-regular",
    "Legacy reporting pipeline from 2014 that nobody has gotten around to decommissioning yet",
    false,
  ),
  makeOption("aws-prod", "AWS production", true),
];

/**
 * One isolated view of the Shared folders field. Each story configures the same
 * host for a different state; nothing but the form field renders, so a reviewer
 * can read one concern at a time.
 */
@Component({
  selector: "shared-folders-field-prototype",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormFieldModule,
    NgSelectModule,
    NgSelectFormFieldControlDirective,
    ChipComponent,
    SpinnerComponent,
    ButtonModule,
    IconButtonModule,
    IconModule,
    IconTileComponent,
    LinkModule,
    CardComponent,
    TypographyModule,
  ],
  template: `
    <div class="tw-mx-auto tw-max-w-xl tw-p-8">
      <bit-card>
        <form [formGroup]="form">
          <bit-form-field class="tw-w-full" disableMargin>
            <bit-label>Shared folders</bit-label>
            <!--
              Using ng-select directly so the option template can render a second line
              ("Controlled access"). bit-multi-select's option template is hardcoded to a
              single line (item.listName) today; a prototype-local extension here lets the
              design conversation with Desmond work from a live view, not a mock.
            -->
            <ng-select
              bitCustomInput
              formControlName="folders"
              [items]="folders()"
              bindLabel="listName"
              [placeholder]="'-- Type to filter --'"
              [loading]="loading()"
              [multiple]="true"
              [closeOnSelect]="false"
              [clearSearchOnAdd]="true"
              appendTo="body"
              outsideClickEvent="mousedown"
              notFoundText="No shared folders match"
              clearAllText="Clear all"
            >
              <ng-template ng-loadingspinner-tmp>
                <bit-spinner size="sm" />
              </ng-template>

              <ng-template ng-label-tmp let-item="item" let-clear="clear">
                <bit-chip
                  size="small"
                  class="tw-me-1"
                  [label]="item.labelName"
                  [startIcon]="item.icon"
                  (dismissed)="clear(item)"
                ></bit-chip>
              </ng-template>

              <ng-template ng-option-tmp let-item="item" let-selected="selected$">
                <div class="tw-flex tw-items-center tw-gap-3">
                  <div class="tw-w-5 tw-flex-none">
                    @if (selected | async) {
                      <bit-icon name="bwi-check" aria-hidden="true"></bit-icon>
                    }
                  </div>
                  @if (item.iconTile) {
                    <bit-icon-tile
                      class="!tw-flex tw-flex-none"
                      size="xs"
                      [icon]="item.iconTile.icon"
                      [variant]="item.iconTile.variant"
                      [emphasis]="item.iconTile.emphasis ?? 'subtle'"
                    ></bit-icon-tile>
                  }
                  <div class="tw-flex tw-min-w-0 tw-flex-col" [attr.title]="item.listName">
                    <span class="tw-truncate tw-text-main">{{ item.listName }}</span>
                    @if (item.controlled) {
                      <span class="tw-truncate tw-text-xs tw-text-muted">Controlled access</span>
                    }
                  </div>
                </div>
              </ng-template>
            </ng-select>

            @if (loadError()) {
              <bit-hint>
                <span class="tw-inline-flex tw-flex-wrap tw-items-center tw-gap-2">
                  <span>Shared folders couldn't load.</span>
                  <button type="button" bitLink linkType="primary">Try again</button>
                </span>
              </bit-hint>
            } @else if (noVaultFolders()) {
              <bit-hint>This vault has no shared folders.</bit-hint>
            } @else if (controlledSelectedCount() > 0) {
              <bit-hint>
                <span class="tw-inline-flex tw-items-start tw-gap-1">
                  <bit-icon name="bwi-encrypted" class="tw-mt-0.5"></bit-icon>
                  <span>{{ controlledHintText() }}</span>
                </span>
              </bit-hint>
            }
          </bit-form-field>
        </form>

        @if (sidenote(); as note) {
          <p
            bitTypography="helper"
            class="tw-mt-6 tw-border-0 tw-border-s-2 tw-border-solid tw-border-warning-700 tw-ps-3 tw-text-muted"
          >
            <strong>Open question:</strong> {{ note }}
          </p>
        }
      </bit-card>
    </div>
  `,
})
class SharedFoldersFieldPrototypeComponent {
  readonly folders = input<SharedFolderOption[]>([]);
  readonly initialSelection = input<SharedFolderOption[]>([]);
  readonly loading = input(false);
  readonly loadError = input(false);
  readonly noVaultFolders = input(false);
  readonly showRequiredError = input(false);
  readonly sidenote = input<string | undefined>();

  protected readonly form = new FormGroup({
    folders: new FormControl<SharedFolderOption[]>(this.initialSelection(), Validators.required),
  });

  constructor() {
    const selection = this.initialSelection();
    if (selection.length > 0) {
      this.form.controls.folders.setValue(selection);
    }
    if (this.showRequiredError()) {
      this.form.controls.folders.setValue([]);
      this.form.controls.folders.markAsTouched();
      this.form.controls.folders.updateValueAndValidity();
    }
  }

  protected readonly controlledSelectedCount = computed(
    () => this.initialSelection().filter((f) => f.controlled).length,
  );

  protected readonly controlledHintText = computed(() =>
    this.controlledSelectedCount() === 1
      ? "You've selected a shared folder that has controlled access."
      : "You've selected shared folders that have controlled access.",
  );
}

export default {
  title: "Prototypes/PAM/Access Coverage/Shared folders field",
  decorators: [
    moduleMetadata({
      imports: [SharedFoldersFieldPrototypeComponent],
    }),
    applicationConfig({
      providers: [
        importProvidersFrom(RouterModule.forRoot([], { useHash: true })),
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              required: "required",
              inputRequired: "Input is required.",
              fieldsNeedAttention: "__$1__ field(s) above need your attention.",
              multiSelectPlaceholder: "-- Type to filter --",
              multiSelectLoading: "Loading",
              multiSelectNotFound: "No shared folders match",
              multiSelectClearAll: "Clear all",
              removeItem: (name) => `Remove ${name}`,
              loading: "Loading",
              close: "Close",
              search: "Search",
            }),
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj<SharedFoldersFieldPrototypeComponent>;

export const NoFoldersSelected: Story = {
  render: () => ({
    props: { folders: DEFAULT_FOLDERS, initialSelection: [] },
    template: `<shared-folders-field-prototype
      [folders]="folders"
      [initialSelection]="initialSelection"
    ></shared-folders-field-prototype>`,
  }),
};

export const BrowsingTheList: Story = {
  render: () => ({
    props: {
      folders: DEFAULT_FOLDERS,
      initialSelection: [],
      sidenote:
        "Icon Tiles variant and 'Controlled access' second line both in use. The two-line option is rendered against ng-select directly; bit-multi-select's hardcoded option template still needs the slot extension in production — pending Desmond.",
    },
    template: `<shared-folders-field-prototype
      [folders]="folders"
      [initialSelection]="initialSelection"
      [sidenote]="sidenote"
    ></shared-folders-field-prototype>`,
  }),
  play: async ({ canvasElement }) => {
    // Open the dropdown automatically so the list is the thing on screen.
    const input = canvasElement.querySelector<HTMLInputElement>("input[type=text]");
    input?.click();
    input?.focus();
  },
};

export const OneControlledFolderSelected: Story = {
  render: () => ({
    props: {
      folders: DEFAULT_FOLDERS,
      initialSelection: [DEFAULT_FOLDERS[0]],
      sidenote:
        "Chip keeps the encrypted icon. Visually hidden ', controlled access' on the chip is pending — bit-chip has no description slot today.",
    },
    template: `<shared-folders-field-prototype
      [folders]="folders"
      [initialSelection]="initialSelection"
      [sidenote]="sidenote"
    ></shared-folders-field-prototype>`,
  }),
};

export const MultipleControlledFoldersSelected: Story = {
  render: () => ({
    props: {
      folders: DEFAULT_FOLDERS,
      initialSelection: [DEFAULT_FOLDERS[0], DEFAULT_FOLDERS[2]],
    },
    template: `<shared-folders-field-prototype
      [folders]="folders"
      [initialSelection]="initialSelection"
    ></shared-folders-field-prototype>`,
  }),
};

/**
 * Lowest protection wins. The hint names what's true — one of the selected folders
 * has controlled access — and doesn't claim the item is protected.
 */
export const MixedControlledAndRegular: Story = {
  render: () => ({
    props: {
      folders: DEFAULT_FOLDERS,
      initialSelection: [DEFAULT_FOLDERS[0], DEFAULT_FOLDERS[1]],
      sidenote:
        "Lowest protection wins (req 6). The hint reports what's true without claiming protection.",
    },
    template: `<shared-folders-field-prototype
      [folders]="folders"
      [initialSelection]="initialSelection"
      [sidenote]="sidenote"
    ></shared-folders-field-prototype>`,
  }),
};

export const NoFilterMatch: Story = {
  render: () => ({
    props: { folders: DEFAULT_FOLDERS, initialSelection: [] },
    template: `<shared-folders-field-prototype
      [folders]="folders"
      [initialSelection]="initialSelection"
    ></shared-folders-field-prototype>`,
  }),
  play: async ({ canvasElement }) => {
    const input = canvasElement.querySelector<HTMLInputElement>("input[type=text]");
    if (input) {
      input.focus();
      // Simulate typing a term nothing matches
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeSetter?.call(input, "zzzz");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  },
};

export const Loading: Story = {
  render: () => ({
    props: { folders: [], initialSelection: [], loading: true },
    template: `<shared-folders-field-prototype
      [folders]="folders"
      [initialSelection]="initialSelection"
      [loading]="loading"
    ></shared-folders-field-prototype>`,
  }),
};

export const LoadError: Story = {
  render: () => ({
    props: { folders: [], initialSelection: [], loadError: true },
    template: `<shared-folders-field-prototype
      [folders]="folders"
      [initialSelection]="initialSelection"
      [loadError]="loadError"
    ></shared-folders-field-prototype>`,
  }),
};

export const VaultHasNoSharedFolders: Story = {
  render: () => ({
    props: { folders: [], initialSelection: [], noVaultFolders: true },
    template: `<shared-folders-field-prototype
      [folders]="folders"
      [initialSelection]="initialSelection"
      [noVaultFolders]="noVaultFolders"
    ></shared-folders-field-prototype>`,
  }),
};

export const RequiredFieldError: Story = {
  render: () => ({
    props: { folders: DEFAULT_FOLDERS, initialSelection: [], showRequiredError: true },
    template: `<shared-folders-field-prototype
      [folders]="folders"
      [initialSelection]="initialSelection"
      [showRequiredError]="showRequiredError"
    ></shared-folders-field-prototype>`,
  }),
};

export const LongFolderNames: Story = {
  render: () => ({
    props: {
      folders: LONG_NAME_FOLDERS,
      initialSelection: [LONG_NAME_FOLDERS[0]],
      sidenote:
        "Long names truncate with an ellipsis. The full name reads back from the chip's title attribute on hover.",
    },
    template: `<shared-folders-field-prototype
      [folders]="folders"
      [initialSelection]="initialSelection"
      [sidenote]="sidenote"
    ></shared-folders-field-prototype>`,
  }),
};
