import { AsyncPipe, CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { map, Observable, startWith } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { VaultFilterMetadataService } from "@bitwarden/common/vault/filtering/vault-filter-metadata.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  SelectItemView,
  FormFieldModule,
  ButtonModule,
  LinkModule,
  CheckboxModule,
} from "@bitwarden/components";

type Filter = {
  vaults: SelectItemView[] | null;
  folders: SelectItemView[] | null;
  collections: SelectItemView[] | null;
  types: SelectItemView[];
  fields: SelectItemView[] | null;
};

const setMap = <T, TResult>(
  set: Set<T>,
  selector: (element: T, index: number) => TResult,
): TResult[] => {
  let index = 0;
  const results: TResult[] = [];
  for (const element of set) {
    results.push(selector(element, index++));
  }

  return results;
};

@Component({
  selector: "app-filter-builder",
  template: `
    <h4>Search within</h4>
    <form [formGroup]="form" (ngSubmit)="submit()" *ngIf="filter$ | async as filter">
      <bit-form-field>
        <bit-label>Vaults</bit-label>
        <bit-multi-select
          class="tw-w-full"
          formControlName="vaults"
          placeholder="--Type to select--"
          [loading]="filter.vaults == null"
          [baseItems]="filter.vaults"
        ></bit-multi-select>
      </bit-form-field>
      <bit-form-field>
        <bit-label>Folders</bit-label>
        <bit-multi-select
          class="tw-w-full"
          formControlName="folders"
          placeholder="--Type to select--"
          [loading]="filter.folders == null"
          [baseItems]="filter.folders"
        ></bit-multi-select>
      </bit-form-field>
      <bit-form-field>
        <bit-label>Collections</bit-label>
        <bit-multi-select
          class="tw-w-full"
          formControlName="collections"
          placeholder="--Type to select--"
          [loading]="filter.collections == null"
          [baseItems]="filter.collections"
        ></bit-multi-select>
      </bit-form-field>
      <bit-form-field>
        <bit-label>Types</bit-label>
        <bit-multi-select
          class="tw-w-full"
          formControlName="types"
          placeholder="--Type to select--"
          [baseItems]="filter.types"
        ></bit-multi-select>
      </bit-form-field>
      <bit-form-field>
        <bit-label>Field</bit-label>
        <bit-multi-select
          class="tw-w-full"
          formControlName="fields"
          placeholder="--Type to select--"
          [loading]="filter.fields == null"
          [baseItems]="filter.fields"
        ></bit-multi-select>
      </bit-form-field>
      <h3>Item includes</h3>
      <bit-form-field>
        <bit-label>Words</bit-label>
        <input bitInput formControlName="words" />
      </bit-form-field>
      <bit-form-control *ngIf="filter.anyHaveAttachment">
        <input type="checkbox" bitCheckbox formControlName="hasAttachment" />
        <bit-label>Attachment</bit-label>
      </bit-form-control>
      <div>
        <!-- <button class="tw-flex tw-justify-start" type="button" bitLink linkType="secondary">
          Give feedback
        </button> -->
        <div class="tw-flex tw-justify-end">
          <button type="button" bitLink linkType="primary" class="tw-mr-2">Cancel</button>
          <button type="submit" bitButton buttonType="primary">Search</button>
        </div>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    LinkModule,
    FormFieldModule,
    ButtonModule,
    ReactiveFormsModule,
    CheckboxModule,
    AsyncPipe,
  ],
})
export class FilterBuilderComponent implements OnInit {
  form = this.formBuilder.group({
    words: "",
    hasAttachment: false,
    types: this.formBuilder.control<SelectItemView[]>([]),
    collections: this.formBuilder.control<SelectItemView[]>([]),
    vaults: this.formBuilder.control<SelectItemView[]>([]),
    folders: this.formBuilder.control<SelectItemView[]>([]),
    fields: this.formBuilder.control<SelectItemView[]>([]),
  });

  @Input({ required: true }) ciphers: Observable<CipherView[]> | undefined;

  @Output() searchFilter = new EventEmitter<
    Partial<{
      words: string;
      types: SelectItemView[];
      collections: SelectItemView[];
      vaults: SelectItemView[];
      folders: SelectItemView[];
      fields: SelectItemView[];
    }>
  >();

  private loadingFilter: Filter;
  filter$: Observable<Filter>;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly i18nService: I18nService,
    private readonly vaultFilterMetadataService: VaultFilterMetadataService,
  ) {
    this.loadingFilter = {
      vaults: null,
      folders: null,
      collections: null,
      types: [
        { id: "login", listName: "Login", labelName: "Login", icon: "bwi-globe" },
        { id: "card", listName: "Card", labelName: "Card", icon: "bwi-credit-card" },
        { id: "identity", listName: "Identity", labelName: "Identity", icon: "bwi-id-card" },
        { id: "note", listName: "Secure Note", labelName: "Secure Note", icon: "bwi-sticky-note" },
      ],
      fields: null,
    };
  }

  ngOnInit(): void {
    this.filter$ = this.ciphers.pipe(
      this.vaultFilterMetadataService.collectMetadata(),
      map((metadata) => {
        // TODO: Combine with other info
        return {
          vaults: setMap(metadata.vaults, (v, i) => {
            if (v == null) {
              // Personal vault
              return {
                id: "personal",
                labelName: "My Vault",
                listName: "My Vault",
                icon: "bwi-vault",
              };
            } else {
              // Get organization info
              return {
                id: v,
                labelName: `Organization ${i}`,
                listName: `Organization ${i}`,
                icon: "bwi-business",
              };
            }
          }),
          folders: setMap(
            metadata.folders,
            (f, i) =>
              ({
                id: f,
                labelName: `Folder ${i}`,
                listName: `Folder ${i}`,
                icon: "bwi-folder",
              }) satisfies SelectItemView,
          ),
          collections: setMap(
            metadata.collections,
            (c, i) =>
              ({
                id: c,
                labelName: `Collection ${i}`,
                listName: `Collection ${i}`,
                icon: "bwi-collection",
              }) satisfies SelectItemView,
          ),
          types: setMap(metadata.itemTypes, (t) => {
            switch (t) {
              case CipherType.Login:
                return { id: "login", listName: "Login", labelName: "Login", icon: "bwi-globe" };
              case CipherType.Card:
                return { id: "card", listName: "Card", labelName: "Card", icon: "bwi-credit-card" };
              case CipherType.Identity:
                return {
                  id: "identity",
                  listName: "Identity",
                  labelName: "Identity",
                  icon: "bwi-id-card",
                };
              case CipherType.SecureNote:
                return {
                  id: "note",
                  listName: "Secure Note",
                  labelName: "Secure Note",
                  icon: "bwi-sticky-note",
                };
              case CipherType.SshKey:
                return {
                  id: "sshkey",
                  listName: "SSH Key",
                  labelName: "SSH Key",
                  icon: "bwi-key",
                };
              default:
                throw new Error("Unreachable");
            }
          }),
          fields: setMap(
            metadata.fieldNames,
            (f, i) => ({ id: f, labelName: f, listName: f }) satisfies SelectItemView,
          ),
        } satisfies Filter;
      }),
      startWith(this.loadingFilter),
    );
  }

  submit() {
    this.searchFilter.emit(this.form.value);
  }
}
