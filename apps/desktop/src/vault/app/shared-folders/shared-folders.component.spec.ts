import { NO_ERRORS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { SharedFoldersComponent } from "./shared-folders.component";

describe("SharedFoldersComponent", () => {
  it("autofocuses the page search", async () => {
    await TestBed.configureTestingModule({ imports: [SharedFoldersComponent] })
      .overrideComponent(SharedFoldersComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    const fixture = TestBed.createComponent(SharedFoldersComponent);
    fixture.detectChanges();

    const page = fixture.debugElement.query(By.css("vault-shared-folders")).nativeElement;
    expect(page.hasAttribute("autofocusSearch")).toBe(true);
  });
});
