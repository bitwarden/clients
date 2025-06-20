import { ComponentFixture, TestBed } from "@angular/core/testing";

import { SetupExtensionComponent } from "./setup-extension.component";

describe("SetupExtensionComponent", () => {
  let fixture: ComponentFixture<SetupExtensionComponent>;
  let component: SetupExtensionComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({}).compileComponents();

    fixture = TestBed.createComponent(SetupExtensionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("creates", () => {
    expect(component).toBeTruthy();
  });
});
