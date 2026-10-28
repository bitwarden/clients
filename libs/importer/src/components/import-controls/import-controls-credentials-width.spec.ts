import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormControl, FormGroup } from "@angular/forms";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { KeeperRegion } from "../../importers/keeper/access";

import { ImportControlsKeeperCredentialsComponent } from "./import-controls-keeper-credentials.component";
import { ImportControlsLastPassCredentialsComponent } from "./import-controls-lastpass-credentials.component";

/** Bounded inputs (email, server, and the like) are capped so their width hints at their content. */
describe("direct import credentials field widths", () => {
  beforeEach(async () => {
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key) => key as string);

    await TestBed.configureTestingModule({
      imports: [
        ImportControlsKeeperCredentialsComponent,
        ImportControlsLastPassCredentialsComponent,
      ],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();
  });

  function fieldClassLists(fixture: ComponentFixture<unknown>): DOMTokenList[] {
    const root: HTMLElement = fixture.nativeElement;
    return Array.from(root.querySelectorAll("bit-form-field")).map((field) => field.classList);
  }

  it("caps the Keeper email and server fields at 400px", () => {
    const fixture = TestBed.createComponent(ImportControlsKeeperCredentialsComponent);
    fixture.componentRef.setInput(
      "form",
      new FormGroup({
        keeperEmail: new FormControl(""),
        keeperRegion: new FormControl(KeeperRegion.Us),
      }),
    );
    fixture.detectChanges();

    const fields = fieldClassLists(fixture);
    expect(fields).toHaveLength(2);
    fields.forEach((classList) => expect(classList).toContain("tw-max-w-[400px]"));
  });

  it("caps the LastPass email field at 400px", () => {
    const fixture = TestBed.createComponent(ImportControlsLastPassCredentialsComponent);
    fixture.componentRef.setInput(
      "form",
      new FormGroup({
        lastPassEmail: new FormControl(""),
        includeSharedFolders: new FormControl(false),
      }),
    );
    fixture.detectChanges();

    const fields = fieldClassLists(fixture);
    expect(fields).toHaveLength(1);
    expect(fields[0]).toContain("tw-max-w-[400px]");
  });
});
