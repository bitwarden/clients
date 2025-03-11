import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { of } from "rxjs";

import {
  SelectItemView,
  FormFieldModule,
  ButtonModule,
  LinkModule,
  CheckboxModule,
} from "@bitwarden/components";

@Component({
  selector: "app-filter-builder",
  template: `
    <h4>Search within</h4>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <bit-form-field>
        <bit-label>Vaults</bit-label>
        <bit-multi-select
          class="tw-w-full"
          formControlName="vaults"
          placeholder="--Type to select--"
          [baseItems]="vaults$ | async"
        ></bit-multi-select>
      </bit-form-field>
      <bit-form-field>
        <bit-label>Folders</bit-label>
        <bit-multi-select
          class="tw-w-full"
          formControlName="folders"
          placeholder="--Type to select--"
          [baseItems]="folders$ | async"
        ></bit-multi-select>
      </bit-form-field>
      <bit-form-field>
        <bit-label>Collections</bit-label>
        <bit-multi-select
          class="tw-w-full"
          formControlName="collections"
          placeholder="--Type to select--"
          [baseItems]="collections$ | async"
        ></bit-multi-select>
      </bit-form-field>
      <bit-form-field>
        <bit-label>Types</bit-label>
        <bit-multi-select
          class="tw-w-full"
          formControlName="types"
          placeholder="--Type to select--"
          [baseItems]="types$ | async"
        ></bit-multi-select>
      </bit-form-field>
      <bit-form-field>
        <bit-label>Field</bit-label>
        <bit-multi-select
          class="tw-w-full"
          formControlName="fields"
          placeholder="--Type to select--"
          [baseItems]="fields$ | async"
        ></bit-multi-select>
      </bit-form-field>
      <h3>Item includes</h3>
      <bit-form-field>
        <bit-label>Words</bit-label>
        <input bitInput formControlName="words" />
      </bit-form-field>
      <bit-form-control>
        <input type="checkbox" bitCheckbox formControlName="hasAttachment" />
        <bit-label>Attachment</bit-label>
      </bit-form-control>
      <div>
        <div>
          <button type="button" bitLink linkType="primary" class="tw-mr-2">Cancel</button>
          <button type="submit" bitButton buttonType="primary">Search</button>
        </div>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    LinkModule,
    FormFieldModule,
    ButtonModule,
    ReactiveFormsModule,
    CheckboxModule,
    AsyncPipe,
  ],
})
export class FilterBuilderComponent implements OnInit {
  readonly vaults$ = of<SelectItemView[]>([
    { id: "vaultOne", listName: "Vault 1", labelName: "Vault 1", icon: "bwi-vault" },
    { id: "vaultTwo", listName: "Vault 2", labelName: "Vault 2", icon: "bwi-vault" },
    { id: "vaultThree", listName: "Vault 3", labelName: "Vault 3", icon: "bwi-vault" },
  ] satisfies SelectItemView[]);

  readonly folders$ = of<SelectItemView[]>([
    { id: "folderOne", listName: "Folder 1", labelName: "Folder 1", icon: "bwi-folder" },
    { id: "folderTwo", listName: "Folder 2", labelName: "Folder 2", icon: "bwi-folder" },
    { id: "folderThree", listName: "Folder 3", labelName: "Folder 3", icon: "bwi-folder" },
  ]);

  readonly collections$ = of<SelectItemView[]>([
    { id: "vaultOne", listName: "Vault 1", labelName: "Vault 1", icon: "bwi-collection" },
    { id: "vaultTwo", listName: "Vault 2", labelName: "Vault 2", icon: "bwi-collection" },
    { id: "vaultThree", listName: "Vault 3", labelName: "Vault 3", icon: "bwi-collection" },
  ]);

  readonly types$ = of<SelectItemView[]>([
    { id: "login", listName: "Login", labelName: "Login", icon: "bwi-globe" },
    { id: "card", listName: "Card", labelName: "Card", icon: "bwi-credit-card" },
    { id: "identity", listName: "Identity", labelName: "Identity", icon: "bwi-id-card" },
    { id: "note", listName: "Secure Note", labelName: "Secure Note", icon: "bwi-sticky-note" },
  ]);

  readonly fields$ = of<SelectItemView[]>([
    { id: "fieldOne", listName: "Field 1", labelName: "Field 1" },
    { id: "fieldTwo", listName: "Field 2", labelName: "Field 2" },
    { id: "fieldThree", listName: "Field 3", labelName: "Field 3" },
  ]);

  form = this.formBuilder.group({
    words: "",
    hasAttachment: false,
    types: this.formBuilder.control([]),
    collections: this.formBuilder.control([]),
    vaults: this.formBuilder.control([]),
    folders: this.formBuilder.control([]),
    fields: this.formBuilder.control([]),
  });

  constructor(private readonly formBuilder: FormBuilder) {}

  ngOnInit(): void {
    // console.log(this.form);
  }

  submit() {
    // console.log(this.form.value);
  }
}
