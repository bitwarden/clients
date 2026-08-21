import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup } from "@angular/forms";
import { By } from "@angular/platform-browser";
import { of } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { ChipFilterComponent, I18nMockService } from "@bitwarden/components";

import { VaultPopupListFiltersService } from "../../../services/vault-popup-list-filters.service";

import { VaultListFiltersComponent } from "./vault-list-filters.component";

const WORK = { id: "folder-1", name: "Work" } as FolderView;
const PERSONAL = { id: "folder-2", name: "Personal" } as FolderView;
const ENGINEERING = { id: "col-1", name: "Engineering" } as CollectionView;

/**
 * The header this covers renders only while `VFO1Foundation` is off, where it shares
 * `filterForm` with the table's multi-select chips. Its `bit-chip-filter`s hold one value each,
 * so the multi-select dimensions are narrowed to their first selection here.
 */
describe("VaultListFiltersComponent", () => {
  let fixture: ComponentFixture<VaultListFiltersComponent>;
  let filterForm: FormGroup<{
    organization: FormControl<Organization | null>;
    collection: FormControl<CollectionView[]>;
    folder: FormControl<FolderView[]>;
    cipherType: FormControl<CipherType | null>;
  }>;

  /** The chip for a dimension, found by the placeholder its column renders. */
  const chipFor = (placeholder: string) =>
    fixture.debugElement
      .queryAll(By.directive(ChipFilterComponent))
      .map((chip) => chip.componentInstance)
      .find((chip) => chip.placeholderText() === placeholder);

  // `selectOption`/`clear` are the chip's own click handlers. Reaching them directly keeps these
  // focused on the binding rather than on driving the chip's menu open.
  const selectOption = (placeholder: string, option: unknown) =>
    chipFor(placeholder)["selectOption"](option, new MouseEvent("click"));
  const clearChip = (placeholder: string) => chipFor(placeholder)["clear"]();
  /** The option the chip is showing as selected. */
  const selectedOption = (placeholder: string) => chipFor(placeholder)["selectedOption"];

  beforeEach(async () => {
    filterForm = new FormGroup({
      organization: new FormControl<Organization | null>(null),
      collection: new FormControl<CollectionView[]>([], { nonNullable: true }),
      folder: new FormControl<FolderView[]>([], { nonNullable: true }),
      cipherType: new FormControl<CipherType | null>(null),
    });

    await TestBed.configureTestingModule({
      imports: [VaultListFiltersComponent],
      providers: [
        // The header's placeholders resolve through `Vfo1TerminologyService`, which reads the flag.
        { provide: ConfigService, useValue: { getFeatureFlag$: () => of(false) } },
        {
          provide: VaultPopupListFiltersService,
          useValue: {
            filterForm,
            organizations$: of([{ value: { id: "org-1" } as Organization, label: "Acme" }]),
            collections$: of([{ value: ENGINEERING, label: "Engineering" }]),
            folders$: of([
              { value: WORK, label: "Work" },
              { value: PERSONAL, label: "Personal" },
            ]),
            cipherTypes$: of([{ value: CipherType.Login, label: "Login" }]),
          },
        },
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              filters: "Filters",
              type: "Type",
              // The VFO1 terminology keys the header's placeholders resolve through.
              vault: "Vault",
              vaults: "Vaults",
              collection: "Collection",
              sharedFolders: "Shared folders",
              folder: "Folder",
              myFolders: "My folders",
              removeItem: (label?: string) => `Remove ${label}`,
              backTo: (label?: string) => `Back to ${label}`,
              viewItemsIn: (label?: string) => `View items in ${label}`,
            }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VaultListFiltersComponent);
    fixture.detectChanges();
  });

  it("writes a folder selection to the form as a single-item selection", () => {
    selectOption("Folder", { value: WORK, label: "Work" });
    fixture.detectChanges();

    expect(filterForm.controls.folder.value).toEqual([WORK]);
  });

  it("replaces the selection rather than adding to it", () => {
    selectOption("Folder", { value: WORK, label: "Work" });
    fixture.detectChanges();
    selectOption("Folder", { value: PERSONAL, label: "Personal" });
    fixture.detectChanges();

    expect(filterForm.controls.folder.value).toEqual([PERSONAL]);
  });

  // The chips' own empty value, so this header and the table agree on "nothing selected" —
  // writing `null` would leave the two disagreeing about the shape.
  it("empties the control when the chip is cleared", () => {
    filterForm.controls.folder.setValue([WORK]);
    fixture.detectChanges();

    clearChip("Folder");
    fixture.detectChanges();

    expect(filterForm.controls.folder.value).toEqual([]);
  });

  it("writes a collection selection as a single-item selection", () => {
    selectOption("Collection", { value: ENGINEERING, label: "Engineering" });
    fixture.detectChanges();

    expect(filterForm.controls.collection.value).toEqual([ENGINEERING]);
  });

  it("seeds a chip from filters already applied before it rendered", () => {
    // The view cache restores filters into the form before this header mounts.
    filterForm.controls.folder.setValue([WORK]);
    fixture.detectChanges();

    expect(selectedOption("Folder")?.value).toBe(WORK);
  });

  /**
   * The chip can only show one, but the form stays authoritative — the vault stays narrowed to
   * every selection, which is what the table's multi-select chips wrote.
   */
  it("shows the first of several selections without narrowing the form", () => {
    filterForm.controls.folder.setValue([WORK, PERSONAL]);
    fixture.detectChanges();

    expect(selectedOption("Folder")?.value).toBe(WORK);
    expect(filterForm.controls.folder.value).toEqual([WORK, PERSONAL]);
  });
});
