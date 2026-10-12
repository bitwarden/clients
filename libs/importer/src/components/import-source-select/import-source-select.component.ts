import { NgTemplateOutlet } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  untracked,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { map } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { BitSvg } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import {
  ButtonModule,
  CardContentComponent,
  DisclosureComponent,
  DisclosureTriggerForDirective,
  IconTileComponent,
  LinkModule,
  ProgressBarComponent,
  RadioButtonModule,
  SearchModule,
  SegmentedCardComponent,
  SvgModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportOption, importOptions, ImportType } from "../../models";

import {
  isFeaturedPasswordManager,
  isPickerVendor,
  pickerDisplayNameFor,
  pickerIconFor,
  PICKER_BROWSER_ORDER,
  PICKER_FEATURED_PASSWORD_MANAGER_ORDER,
  sortByPickerOrder,
} from "./import-source-picker-metadata";

@Component({
  selector: "importer-source-select",
  templateUrl: "import-source-select.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule,
    CardContentComponent,
    DisclosureComponent,
    DisclosureTriggerForDirective,
    IconTileComponent,
    I18nPipe,
    LinkModule,
    NgTemplateOutlet,
    ProgressBarComponent,
    ReactiveFormsModule,
    RadioButtonModule,
    SearchModule,
    SegmentedCardComponent,
    SvgModule,
    TypographyModule,
  ],
})
export class ImportSourceSelectComponent {
  private readonly i18nService = inject(I18nService);
  private readonly themingService = inject(AbstractThemingService);

  /** A handful of vendor marks are a single fixed color and need a swapped variant against a dark
   *  background — see `PickerVendorMetadata.darkIcon`. */
  private readonly isDarkTheme = toSignal(
    this.themingService.theme$.pipe(map((theme) => theme === ThemeTypes.Dark)),
    { initialValue: false },
  );

  /** Current position in the overall import flow, for the step progress bar. */
  readonly currentStep = input(1);
  /** Total number of steps in the overall import flow. */
  readonly totalSteps = input(3);

  /** Emits the chosen import format when Continue is pressed. */
  readonly continue = output<ImportType>();

  protected readonly progressValue = computed(() => (this.currentStep() / this.totalSteps()) * 100);
  protected readonly stepText = computed(() =>
    this.i18nService.t("importSourceStepCount", this.currentStep(), this.totalSteps()),
  );

  protected readonly sourceControl = new FormControl<ImportType | null>(null);
  protected readonly selectedSource = toSignal(this.sourceControl.valueChanges, {
    initialValue: this.sourceControl.value,
  });

  protected readonly searchControl = new FormControl("");
  private readonly searchText = toSignal(this.searchControl.valueChanges, {
    initialValue: "",
  });

  private readonly allOptions = importOptions.filter((option) => isPickerVendor(option.id));

  protected readonly normalizedSearch = computed(() =>
    (this.searchText() ?? "").trim().toLowerCase(),
  );

  private matchesSearch(option: ImportOption): boolean {
    const search = this.normalizedSearch();
    if (search.length === 0) {
      return true;
    }
    // Check both names: the picker's clean display name can differ from `ImportOption.name`
    // (e.g. "Proton Pass" vs. "ProtonPass (zip/json)"), and a search should match either.
    return (
      option.name.toLowerCase().includes(search) ||
      this.displayNameFor(option).toLowerCase().includes(search)
    );
  }

  protected readonly browsers = computed(() =>
    sortByPickerOrder(
      this.allOptions.filter((option) => option.isBrowser && this.matchesSearch(option)),
      PICKER_BROWSER_ORDER,
    ),
  );

  protected readonly featuredPasswordManagers = computed(() =>
    sortByPickerOrder(
      this.allOptions.filter(
        (option) =>
          !option.isBrowser && isFeaturedPasswordManager(option.id) && this.matchesSearch(option),
      ),
      PICKER_FEATURED_PASSWORD_MANAGER_ORDER,
    ),
  );

  private readonly remainingPasswordManagers = computed(() =>
    this.allOptions
      .filter(
        (option) =>
          !option.isBrowser && !isFeaturedPasswordManager(option.id) && this.matchesSearch(option),
      )
      .sort((a, b) =>
        this.i18nService.collator
          ? this.i18nService.collator.compare(a.name, b.name)
          : a.name.localeCompare(b.name),
      ),
  );

  protected readonly hasRemainingPasswordManagers = computed(
    () => this.remainingPasswordManagers().length > 0,
  );

  protected readonly hasAnyResults = computed(
    () =>
      this.browsers().length > 0 ||
      this.featuredPasswordManagers().length > 0 ||
      this.hasRemainingPasswordManagers(),
  );

  private readonly isSelectionInRemaining = computed(() =>
    this.remainingPasswordManagers().some((option) => option.id === this.selectedSource()),
  );

  protected readonly disclosureOpen = linkedSignal<boolean>(() => {
    if (this.normalizedSearch().length > 0) {
      return true;
    }
    return untracked(() => this.isSelectionInRemaining());
  });

  protected readonly visibleRemainingPasswordManagers = computed(() =>
    this.disclosureOpen() ? this.remainingPasswordManagers() : [],
  );

  protected readonly showAllLabel = computed(() =>
    this.disclosureOpen() ? "importSourceShowLess" : "importSourceShowAll",
  );

  private readonly visibleOptions = computed(() => [
    ...this.browsers(),
    ...this.featuredPasswordManagers(),
    ...this.visibleRemainingPasswordManagers(),
  ]);

  /** Continue stays disabled if the selected option has since scrolled out of the visible set
   *  (e.g. the user selected a card, then searched for something else). */
  protected readonly canContinue = computed(() => {
    const selected = this.selectedSource();
    return selected != null && this.visibleOptions().some((option) => option.id === selected);
  });

  protected iconFor(id: string): BitSvg | undefined {
    return pickerIconFor(id, this.isDarkTheme());
  }

  protected displayNameFor(option: ImportOption): string {
    return pickerDisplayNameFor(option.id);
  }

  protected onContinue(): void {
    const selected = this.selectedSource();
    if (selected && this.canContinue()) {
      this.continue.emit(selected);
    }
  }
}
