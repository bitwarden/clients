import { AsyncPipe, CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { BehaviorSubject, distinctUntilChanged, map, Observable, startWith } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { VaultFilterMetadataService } from "@bitwarden/common/vault/filtering/vault-filter-metadata.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  FormFieldModule,
  ButtonModule,
  LinkModule,
  CheckboxModule,
  ChipMultiSelectComponent,
  ChipSelectOption,
  ChipSelectComponent,
  ToggleGroupModule,
} from "@bitwarden/components";

import {
  BasicFilter,
  BasicVaultFilterHandler,
} from "@bitwarden/common/vault/filtering/basic-vault-filter.handler";
import { SearchComponent } from "@bitwarden/components/src/search/search.component";

type FilterData = {
  vaults: ChipSelectOption<string>[] | null;
  folders: ChipSelectOption<string>[] | null;
  collections: ChipSelectOption<string>[] | null;
  types: ChipSelectOption<string>[];
  fields: ChipSelectOption<string>[] | null;
  anyHaveAttachment: boolean;
};

type FilterModel = {
  text: string;
  vaults: string[];
  folders: string[];
  collections: string[];
  types: string[];
  fields: string[];
};

// TODO: Include more details on basic so consumers can easily interact with it.
export type Filter =
  | { type: "basic"; details: BasicFilter; raw: string }
  | { type: "advanced"; raw: string };

const customMap = <T, TResult>(
  map: Map<T, unknown>,
  selector: (element: T, index: number) => TResult,
): TResult[] => {
  let index = 0;
  const results: TResult[] = [];
  for (const element of map.keys()) {
    results.push(selector(element, index++));
  }

  return results;
};

@Component({
  selector: "app-filter-builder",
  template: `
    <form [formGroup]="form" *ngIf="filterData$ | async as filter">
      <div class="tw-mb-2">
        <bit-search formControlName="text" />
      </div>
      @if (mode === "basic") {
        <bit-chip-multi-select
          placeholderText="Vault"
          placeholderIcon="bwi-vault"
          formControlName="vaults"
          [options]="filter.vaults"
        ></bit-chip-multi-select>
        <bit-chip-multi-select
          placeholderText="Folders"
          placeholderIcon="bwi-folder"
          formControlName="folders"
          [options]="filter.folders"
          class="tw-pl-2"
        ></bit-chip-multi-select>
        <bit-chip-multi-select
          placeholderText="Collections"
          placeholderIcon="bwi-collection"
          formControlName="collections"
          [options]="filter.collections"
          class="tw-pl-2"
        ></bit-chip-multi-select>
        @for (selectedOtherOption of selectedOptions(); track selectedOtherOption) {
          @switch (selectedOtherOption) {
            @case ("types") {
              <bit-chip-multi-select
                placeholderText="Types"
                placeholderIcon="bwi-sliders"
                formControlName="types"
                [options]="filter.types"
                class="tw-pl-2"
              ></bit-chip-multi-select>
            }
            @case ("fields") {
              <bit-chip-multi-select
                placeholderText="Fields"
                placeholderIcon="bwi-filter"
                formControlName="fields"
                [options]="filter.fields"
                class="tw-pl-2"
              ></bit-chip-multi-select>
            }
          }
        }
        <ng-container *ngIf="otherOptions$ | async as otherOptions">
          <bit-chip-select
            *ngIf="otherOptions.length !== 0"
            placeholderText="Other filters"
            placeholderIcon="bwi-sliders"
            formControlName="otherOptions"
            [options]="otherOptions"
            class="tw-pl-2"
          >
          </bit-chip-select>
        </ng-container>
        <span
          class="tw-border-l tw-border-0 tw-border-solid tw-border-secondary-300 tw-mx-2"
        ></span>
        <button
          type="button"
          bitLink
          linkType="secondary"
          class="tw-text-sm"
          (click)="resetFilter()"
        >
          Reset
        </button>
        <button type="button" bitLink class="tw-ml-2 tw-text-sm" (click)="saveFilter()">
          Save filter
        </button>
      }
      <!-- TODO: Align to the right -->
      <bit-toggle-group selected="basic" (selectedChange)="modeChanged($event)">
        <bit-toggle value="basic">Basic</bit-toggle>
        <bit-toggle value="advanced">Advanced</bit-toggle>
      </bit-toggle-group>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    LinkModule,
    ChipMultiSelectComponent,
    FormFieldModule,
    ButtonModule,
    FormsModule,
    ReactiveFormsModule,
    CheckboxModule,
    AsyncPipe,
    ChipSelectComponent,
    SearchComponent,
    ToggleGroupModule,
  ],
})
export class FilterBuilderComponent implements OnInit {
  @Input({ required: true }) initialFilter: string;

  @Input({ required: true }) ciphers: Observable<CipherView[]> | undefined;

  @Output() searchFilterEvent = new EventEmitter<Filter>();

  @Output() saveFilterEvent = new EventEmitter<string>();

  protected mode: string = "basic";

  protected form = this.formBuilder.group({
    text: this.formBuilder.control<string>(null),
    vaults: this.formBuilder.control<string[]>([]),
    folders: this.formBuilder.control<string[]>([]),
    collections: this.formBuilder.control<string[]>([]),
    types: this.formBuilder.control<string[]>([]),
    fields: this.formBuilder.control<string[]>([]),
    otherOptions: this.formBuilder.control<string>(null),
    selectedOtherOptions: this.formBuilder.control<string[]>([]),
  });

  private loadingFilter: FilterData;

  protected filterData$: Observable<FilterData>;

  private defaultOtherOptions: ChipSelectOption<string>[];

  // TODO: Set these dynamically based on metadata
  private _otherOptions: BehaviorSubject<ChipSelectOption<string>[]>;

  protected otherOptions$: Observable<ChipSelectOption<string>[]>;

  constructor(
    private readonly i18nService: I18nService,
    private readonly formBuilder: FormBuilder,
    private readonly vaultFilterMetadataService: VaultFilterMetadataService,
    private readonly basicVaultFilterHandler: BasicVaultFilterHandler,
  ) {
    // TODO: i18n
    this.loadingFilter = {
      vaults: null,
      folders: null,
      collections: null,
      types: [
        { value: "login", label: "Login", icon: "bwi-globe" },
        { value: "card", label: "Card", icon: "bwi-credit-card" },
        { value: "identity", label: "Identity", icon: "bwi-id-card" },
        { value: "note", label: "Secure Note", icon: "bwi-sticky-note" },
      ],
      fields: null,
      anyHaveAttachment: true,
    };

    // TODO: i18n
    this.defaultOtherOptions = [
      { value: "types", label: "Types", icon: "bwi-sliders" },
      { value: "fields", label: "Fields", icon: "bwi-filter" },
    ];

    this._otherOptions = new BehaviorSubject(this.defaultOtherOptions);

    this.otherOptions$ = this._otherOptions.asObservable();

    this.defaultOtherOptions = [
      { value: "types", label: "Types", icon: "bwi-sliders" },
      { value: "fields", label: "Fields", icon: "bwi-filter" },
    ];

    this.form.controls.otherOptions.valueChanges.pipe(takeUntilDestroyed()).subscribe((option) => {
      if (option == null) {
        return;
      }

      // TODO: Do I need to ensure unique?
      this.form.controls.selectedOtherOptions.setValue([
        ...this.form.controls.selectedOtherOptions.value,
        option,
      ]);
      const existingOptions = [...this._otherOptions.value];

      const index = existingOptions.findIndex((o) => o.value === option);

      if (index === -1) {
        throw new Error("Should never happen.");
      }

      existingOptions.splice(index, 1);
      this._otherOptions.next(existingOptions);

      this.form.controls.otherOptions.setValue(null);
    });

    this.form.valueChanges
      .pipe(
        // TODO: Debounce?
        map((v) => this.convertFilter(v)),
        distinctUntilChanged((previous, current) => {
          return previous.raw === current.raw;
        }),
        takeUntilDestroyed(),
      )
      .subscribe((f) => this.searchFilterEvent.emit(f));
  }

  private convertFilter(filter: Partial<FilterModel>): Filter {
    // TODO: Support advanced mode
    if (this.mode === "advanced") {
      return { type: "advanced", raw: filter.text };
    }

    const basic = this.convertToBasic(filter);

    return { type: "basic", details: basic, raw: this.basicVaultFilterHandler.toFilter(basic) };
  }

  private convertToBasic(filter: Partial<FilterModel>): BasicFilter {
    return {
      terms: filter.text != null ? [filter.text] : [],
      vaults: filter.vaults ?? [],
      collections: filter.collections ?? [],
      fields: filter.fields ?? [],
      folders: filter.folders ?? [],
      types: filter.types ?? [],
    };
  }

  ngOnInit(): void {
    if (this.initialFilter != null) {
      //
    }

    this.filterData$ = this.ciphers.pipe(
      this.vaultFilterMetadataService.collectMetadata(),
      map((metadata) => {
        // TODO: Combine with other info
        return {
          vaults: customMap(metadata.vaults, (v, i) => {
            if (v == null) {
              // Personal vault
              return {
                value: null,
                label: "My Vault",
              };
            } else {
              // Get organization info
              return {
                value: v,
                label: `Organization ${i}`,
              };
            }
          }),
          folders: customMap(
            metadata.folders,
            (f, i) =>
              ({
                value: f,
                label: `Folder ${i}`,
              }) satisfies ChipSelectOption<string>,
          ),
          collections: customMap(
            metadata.collections,
            (c, i) =>
              ({
                value: c,
                label: `Collection ${i}`,
              }) satisfies ChipSelectOption<string>,
          ),
          types: customMap(metadata.itemTypes, (t) => {
            switch (t) {
              case CipherType.Login:
                return { value: "login", label: "Login", icon: "bwi-globe" };
              case CipherType.Card:
                return {
                  value: "card",
                  label: "Card",
                  icon: "bwi-credit-card",
                };
              case CipherType.Identity:
                return {
                  value: "identity",
                  label: "Identity",
                  icon: "bwi-id-card",
                };
              case CipherType.SecureNote:
                return {
                  value: "note",
                  label: "Secure Note",
                  icon: "bwi-sticky-note",
                };
              case CipherType.SshKey:
                return {
                  value: "sshkey",
                  label: "SSH Key",
                  icon: "bwi-key",
                };
              default:
                throw new Error("Unreachable");
            }
          }),
          fields: customMap(
            metadata.customFields,
            (f, i) => ({ value: f.name, label: f.name }) satisfies ChipSelectOption<string>,
          ),
          anyHaveAttachment: metadata.attachmentCount !== 0,
        } satisfies FilterData;
      }),
      startWith(this.loadingFilter),
    );
  }

  protected selectedOptions() {
    return this.form.controls.selectedOtherOptions.value;
  }

  private trySetBasicFilterElements(value: string) {
    try {
      const parseResult = this.basicVaultFilterHandler.tryParse(value);

      if (parseResult.success) {
        if (parseResult.filter.terms.length >= 1) {
          throw new Error("More than 1 term not actually supported in basic");
        }

        // This item can be displayed with basic, lets do that.
        const selectedOtherOptions: string[] = [];

        if (parseResult.filter.types.length !== 0) {
          selectedOtherOptions.push("types");
        }

        if (parseResult.filter.fields.length !== 0) {
          selectedOtherOptions.push("fields");
        }

        console.log("Parse advanced query", value, parseResult.filter);

        this.form.setValue({
          text: parseResult.filter.terms.length === 1 ? parseResult.filter.terms[0] : null,
          vaults: parseResult.filter.vaults,
          folders: parseResult.filter.folders,
          collections: parseResult.filter.collections,
          fields: parseResult.filter.fields,
          types: parseResult.filter.types,
          otherOptions: null,
          selectedOtherOptions: selectedOtherOptions,
        });
        return true;
      } else {
        // set form to advanced mode and disable switching to basic
        return false;
      }
    } catch (err) {
      // How should I show off parse errors
      console.log("Error", err);
      return false;
    }
  }

  protected resetFilter() {
    this._otherOptions.next(this.defaultOtherOptions);
    this.form.reset({
      vaults: [],
      folders: [],
      types: [],
      fields: [],
      otherOptions: null,
      collections: [],
      selectedOtherOptions: [],
    });
  }

  protected saveFilter() {
    const currentFilter = this.convertFilter(this.form.value);
    this.saveFilterEvent.emit(currentFilter.raw);
  }

  protected modeChanged(newMode: string) {
    this.mode = newMode;
    if (newMode === "advanced") {
      // Switching to advanced, place basic contents into text
      this.form.controls.text.setValue(
        this.basicVaultFilterHandler.toFilter(this.convertToBasic(this.form.value)),
      );
    } else {
      if (!this.trySetBasicFilterElements(this.form.controls.text.value)) {
        console.log("Could not set filter back to basic, button should have been disabled.");
        this.mode = "advanced";
        return;
      }
    }
  }
}
