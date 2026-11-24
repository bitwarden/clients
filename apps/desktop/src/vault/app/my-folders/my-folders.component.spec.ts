import { NO_ERRORS_SCHEMA } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { MyFoldersComponent } from "./my-folders.component";

describe("MyFoldersComponent", () => {
  it("autofocuses the page search", async () => {
    await TestBed.configureTestingModule({ imports: [MyFoldersComponent] })
      .overrideComponent(MyFoldersComponent, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();

    const fixture = TestBed.createComponent(MyFoldersComponent);
    fixture.detectChanges();

    const page = fixture.debugElement.query(By.css("vault-my-folders")).nativeElement;
    expect(page.hasAttribute("autofocusSearch")).toBe(true);
  });
});
