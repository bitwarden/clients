import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { mock } from "jest-mock-extended";

import { HumanApprovalEditorComponent } from "./human-approval-editor.component";

describe("HumanApprovalEditorComponent", () => {
  let fixture: ComponentFixture<HumanApprovalEditorComponent>;
  let component: HumanApprovalEditorComponent;

  beforeEach(() => {
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    TestBed.configureTestingModule({
      imports: [HumanApprovalEditorComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    });

    fixture = TestBed.createComponent(HumanApprovalEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("renders without error", () => {
    expect(component).toBeTruthy();
  });

  describe("buildPolicy", () => {
    it("returns { kind: 'human_approval' }", () => {
      expect(component.buildPolicy()).toEqual({ kind: "human_approval" });
    });

    it("always passes validation — returns a policy without any form input", () => {
      const policy = component.buildPolicy();

      expect(policy.kind).toBe("human_approval");
    });
  });

  describe("manageMembersClicked output", () => {
    it("emits when the manage link is clicked", () => {
      const spy = jest.fn();
      component.manageMembersClicked.subscribe(spy);

      const link = fixture.debugElement.query(By.css("a[bitLink]"));
      link.nativeElement.click();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
