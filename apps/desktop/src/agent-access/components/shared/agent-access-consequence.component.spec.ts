import { ComponentFixture, TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { AgentAccessConsequence } from "../../models/agent-access-consequence";

import { AgentAccessConsequenceComponent } from "./agent-access-consequence.component";

describe("AgentAccessConsequenceComponent", () => {
  let fixture: ComponentFixture<AgentAccessConsequenceComponent>;

  const setInputs = (inputs: Partial<AgentAccessConsequenceComponent>) => {
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
  };

  beforeEach(async () => {
    const i18nService = mock<I18nService>();
    i18nService.t.mockImplementation((key: string) => key);

    await TestBed.configureTestingModule({
      imports: [AgentAccessConsequenceComponent],
      providers: [{ provide: I18nService, useValue: i18nService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentAccessConsequenceComponent);
  });

  it("renders the summary sentence", () => {
    setInputs({ grade: AgentAccessConsequence.Change, summary: "creates a new secret" });

    expect(fixture.nativeElement.textContent).toContain("creates a new secret");
  });

  it("omits the detail line when not provided", () => {
    setInputs({ grade: AgentAccessConsequence.Change, summary: "creates a new secret" });

    expect(fixture.nativeElement.querySelectorAll("[bittypography='helper']").length).toBe(0);
  });

  it("renders the detail line, muted, when provided, in the filled treatment", () => {
    setInputs({
      grade: AgentAccessConsequence.Disclose,
      summary: "receives this secret's value",
      detail: "47 secrets will be released",
    });

    expect(fixture.nativeElement.textContent).toContain("47 secrets will be released");
    const detailEl: HTMLElement = fixture.nativeElement.querySelector("[bittypography='helper']");
    expect(detailEl.className).toContain("tw-text-muted");
  });

  it("renders the detail line, muted, when provided, in the plain treatment", () => {
    setInputs({
      grade: AgentAccessConsequence.Metadata,
      summary: "lists project names",
      detail: "12 projects will be listed",
    });

    expect(fixture.nativeElement.textContent).toContain("12 projects will be listed");
    const detailEl: HTMLElement = fixture.nativeElement.querySelector("[bittypography='helper']");
    expect(detailEl.className).toContain("tw-text-muted");
  });

  describe.each([
    [
      AgentAccessConsequence.Disclose,
      "tw-border-border-warning",
      "tw-bg-bg-warning-soft",
      "bwi-key",
    ],
    [
      AgentAccessConsequence.Destroy,
      "tw-border-border-danger",
      "tw-bg-bg-danger-soft",
      "bwi-trash",
    ],
  ])("grade %s (Disclose/Destroy — filled treatment)", (grade, borderClass, bgClass, iconClass) => {
    it(`uses ${borderClass} / ${bgClass} / ${iconClass}`, () => {
      setInputs({ grade, summary: "summary text" });

      const wrapper: HTMLElement = fixture.nativeElement.firstElementChild;
      expect(wrapper.className).toContain(borderClass);
      expect(wrapper.className).toContain(bgClass);
      expect(wrapper.className).toContain("tw-border-s-4");
      expect(fixture.nativeElement.querySelector(`bit-icon.${iconClass}`)).not.toBeNull();
    });
  });

  describe.each([[AgentAccessConsequence.Metadata], [AgentAccessConsequence.Change]])(
    "grade %s (Metadata/Change — plain treatment)",
    (grade) => {
      it("renders no fill, no border box, and no icon", () => {
        setInputs({ grade, summary: "summary text" });

        const wrapper: HTMLElement = fixture.nativeElement.firstElementChild;
        expect(wrapper.className).not.toContain("tw-border-s-4");
        expect(wrapper.className).not.toContain("tw-rounded-md");
        expect(wrapper.className).not.toMatch(/tw-bg-/);
        expect(fixture.nativeElement.querySelector("bit-icon")).toBeNull();
      });

      it("renders the summary as muted body text", () => {
        setInputs({ grade, summary: "summary text" });

        const summaryEl: HTMLElement =
          fixture.nativeElement.querySelector("[bittypography='body2']");
        expect(summaryEl.textContent).toContain("summary text");
        expect(summaryEl.className).toContain("tw-text-muted");
      });
    },
  );

  it("renders the identical summary sentence across both treatments", () => {
    setInputs({ grade: AgentAccessConsequence.Destroy, summary: "same sentence" });
    const filledText = fixture.nativeElement.textContent;

    setInputs({ grade: AgentAccessConsequence.Metadata, summary: "same sentence" });
    const plainText = fixture.nativeElement.textContent;

    expect(filledText).toContain("same sentence");
    expect(plainText).toContain("same sentence");
  });
});
