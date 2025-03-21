import { AsyncPipe, CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormsModule, ReactiveFormsModule } from "@angular/forms";
import {
  BehaviorSubject,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  map,
  Observable,
  of,
  startWith,
  switchMap,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  BasicFilter,
  BasicVaultFilterHandler,
} from "@bitwarden/common/vault/filtering/basic-vault-filter.handler";
import { VaultFilterMetadataService } from "@bitwarden/common/vault/filtering/vault-filter-metadata.service";
import { SearchContext } from "@bitwarden/common/vault/search/query.types";
import {
  FilterName,
  FilterString,
  SavedFiltersService,
} from "@bitwarden/common/vault/search/saved-filters.service";

import { ButtonModule } from "../button";
import { CheckboxModule } from "../checkbox";
import { ChipMultiSelectComponent } from "../chip-multi-select";
import { ChipSelectComponent, ChipSelectOption } from "../chip-select";
import { FormFieldModule } from "../form-field";
import { LinkModule } from "../link";
import { ToggleGroupModule } from "../toggle-group";

import { SearchComponent } from "./search.component";

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
  selector: "bit-filter-builder",
  template: `
    <form [formGroup]="form" *ngIf="filterData$ | async as filter">
      <div class="tw-mb-2">
        <bit-search formControlName="text" [savedFilters]="savedFilters$ | async" />
      </div>
      @if (mode() === "basic") {
        @if (filter.vaults != null && filter.vaults.length > 1) {
          <bit-chip-multi-select
            placeholderText="Vault"
            placeholderIcon="bwi-vault"
            formControlName="vaults"
            [options]="filter.vaults"
          ></bit-chip-multi-select>
        }
        @if (filter.folders != null && filter.folders.length > 0) {
          <bit-chip-multi-select
            placeholderText="Folders"
            placeholderIcon="bwi-folder"
            formControlName="folders"
            [options]="filter.folders"
            class="tw-pl-2"
          ></bit-chip-multi-select>
        }
        @if (filter.collections != null && filter.collections.length > 0) {
          <bit-chip-multi-select
            placeholderText="Collections"
            placeholderIcon="bwi-collection"
            formControlName="collections"
            [options]="filter.collections"
            class="tw-pl-2"
          ></bit-chip-multi-select>
        }
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
      }
      @if (formIsDirty) {
        @if (mode() === "basic") {
          <span
            class="tw-border-l tw-border-0 tw-border-solid tw-border-secondary-300 tw-mx-2"
          ></span>
        }
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
      <bit-toggle-group [selected]="mode()" (selectedChange)="modeChanged($event)">
        <bit-toggle value="basic">Basic</bit-toggle>
        <bit-toggle value="advanced" disabled="true">Advanced</bit-toggle>
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

  @Input({ required: true }) searchContext: Observable<SearchContext>;

  @Output() searchFilterEvent = new EventEmitter<Filter>();

  @Output() saveFilterEvent = new EventEmitter<string>();

  protected mode = signal("basic");

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

  protected savedFilters$: Observable<Record<FilterName, FilterString>>;

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
    private readonly logService: LogService,
    private readonly savedFilterService: SavedFiltersService,
    private readonly accountService: AccountService,
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

    this.savedFilters$ = this.accountService.activeAccount$.pipe(
      switchMap((acc) => this.savedFilterService.filtersFor$(acc.id)),
    );

    this.form.valueChanges
      .pipe(
        debounceTime(200),
        map((v) => this.convertFilter(v)),
        distinctUntilChanged((previous, current) => {
          return previous.raw === current.raw;
        }),
        takeUntilDestroyed(),
      )
      .subscribe((f) => this.searchFilterEvent.emit(f));
  }

  private convertFilter(filter: Partial<FilterModel>): Filter {
    if (this.mode() === "advanced") {
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
      if (!this.trySetBasicFilterElements(this.initialFilter)) {
        this.form.controls.text.setValue(this.initialFilter);
        this.mode.set("advanced");
      }
    }

    this.filterData$ = this.searchContext.pipe(
      switchMap((context) => {
        return of(context.ciphers).pipe(
          this.vaultFilterMetadataService.collectMetadata(),
          map((metadata) => {
            {
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
                    const org = context.organizations.find((o) => o.id === v);

                    return {
                      value: org.name,
                      label: org.name,
                    };
                  }
                }),
                folders: customMap(metadata.folders, (id, i) => {
                  const folder = context.folders.find((f) => f.id === id);
                  return {
                    value: folder.name,
                    label: folder.name,
                  } satisfies ChipSelectOption<string>;
                }),
                collections: customMap(metadata.collections, (id, i) => {
                  const collection = context.collections.find((c) => c.id === id);
                  return {
                    value: collection.name,
                    label: collection.name,
                  } satisfies ChipSelectOption<string>;
                }),
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
            }
          }),
        );
      }),
      startWith(this.loadingFilter),
    );
  }

  protected selectedOptions() {
    return this.form.controls.selectedOtherOptions.value;
  }

  protected get formIsDirty() {
    return this.form.dirty;
  }

  private trySetBasicFilterElements(value: string) {
    if (value == null || value === "") {
      this.logService.info("Reseting form.");
      this.resetFilter();
      return true;
    }

    try {
      this.logService.info("Parsing", value);
      const parseResult = this.basicVaultFilterHandler.tryParse(value);

      if (!parseResult.success) {
        // Could not parse query
        return false;
      }

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

      const term = parseResult.filter.terms.length === 1 ? parseResult.filter.terms[0] : null;

      this.form.setValue({
        text: term === "" ? null : term,
        vaults: parseResult.filter.vaults,
        folders: parseResult.filter.folders,
        collections: parseResult.filter.collections,
        fields: parseResult.filter.fields,
        types: parseResult.filter.types,
        otherOptions: null,
        selectedOtherOptions: selectedOtherOptions,
      });
      return true;
    } catch (err) {
      // How should I show off parse errors
      this.logService.debug("Error while parsing advanced query", err);
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

  protected async saveFilter() {
    const currentFilter = this.convertFilter(this.form.value);

    if (currentFilter.raw == null || currentFilter.raw === "") {
      // Skip
      return;
    }

    const activeUser = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((acc) => acc.id)),
    );
    await this.savedFilterService.saveFilter(
      activeUser,
      currentFilter.raw as FilterName,
      currentFilter.raw as FilterString,
    );
  }

  protected modeChanged(newMode: string) {
    if (this.mode() === newMode) {
      return;
    }

    if (newMode === "advanced") {
      // Switching to advanced, place basic contents into text
      this.form.controls.text.setValue(
        this.basicVaultFilterHandler.toFilter(this.convertToBasic(this.form.value)),
      );
    } else {
      if (!this.trySetBasicFilterElements(this.form.controls.text.value)) {
        this.logService.info(
          "Could not set filter back to basic, button should have been disabled.",
        );
        // This doesn't actually change the UI, we need to actually disable the button but that
        // doesn't look available right now.
        return;
      }
    }

    this.mode.set(newMode);
  }
}
