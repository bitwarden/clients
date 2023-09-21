import { Component } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { mock, MockProxy } from "jest-mock-extended";

import { FeatureFlag, FeatureFlagValue } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { IfFeatureDirective } from "./if-feature.directive";

const testBooleanFeature: FeatureFlag = "boolean-feature" as FeatureFlag;
const testStringFeature: FeatureFlag = "string-feature" as FeatureFlag;
const testStringFeatureValue = "test-value";

@Component({
  template: `
    <div *appIfFeature="testBooleanFeature">
      <div data-testid="boolean-content">Hidden behind feature flag</div>
    </div>
    <div *appIfFeature="stringFeature; value: stringFeatureValue">
      <div data-testid="string-content">Hidden behind feature flag</div>
    </div>
    <div *appIfFeature="missingFlag">
      <div data-testid="missing-flag-content">
        Hidden behind missing flag. Should not be visible.
      </div>
    </div>
  `,
})
class TestComponent {
  testBooleanFeature = testBooleanFeature;
  stringFeature = testStringFeature;
  stringFeatureValue = testStringFeatureValue;

  missingFlag = "missing-flag" as FeatureFlag;
}

describe("IfFeatureDirective", () => {
  let fixture: ComponentFixture<TestComponent>;
  let content: HTMLElement;
  let mockConfigService: MockProxy<ConfigServiceAbstraction>;

  const mockConfigFlagValue = (flag: FeatureFlag, flagValue: FeatureFlagValue) => {
    mockConfigService.getFeatureFlag.mockImplementation((f, defaultValue) =>
      flag == f ? Promise.resolve(flagValue) : Promise.resolve(defaultValue)
    );
  };

  const queryContent = (testId: string) =>
    fixture.debugElement.query(By.css(`[data-testid="${testId}"]`))?.nativeElement;

  beforeEach(async () => {
    mockConfigService = mock<ConfigServiceAbstraction>();

    await TestBed.configureTestingModule({
      declarations: [IfFeatureDirective, TestComponent],
      providers: [
        { provide: LogService, useValue: mock<LogService>() },
        {
          provide: ConfigServiceAbstraction,
          useValue: mockConfigService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestComponent);
  });

  it("renders content when the feature flag is enabled", async () => {
    mockConfigFlagValue(testBooleanFeature, true);
    fixture.detectChanges();
    await fixture.whenStable();

    content = queryContent("boolean-content");

    expect(content).toBeDefined();
  });

  it("renders content when the feature flag value matches the provided value", async () => {
    mockConfigFlagValue(testStringFeature, testStringFeatureValue);
    fixture.detectChanges();
    await fixture.whenStable();

    content = queryContent("string-content");

    expect(content).toBeDefined();
  });

  it("hides content when the feature flag is disabled", async () => {
    mockConfigFlagValue(testBooleanFeature, false);
    fixture.detectChanges();
    await fixture.whenStable();

    content = queryContent("boolean-content");

    expect(content).toBeUndefined();
  });

  it("hides content when the feature flag value does not match the provided value", async () => {
    mockConfigFlagValue(testStringFeature, "wrong-value");
    fixture.detectChanges();
    await fixture.whenStable();

    content = queryContent("string-content");

    expect(content).toBeUndefined();
  });

  it("hides content when the feature flag is missing", async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    content = queryContent("missing-flag-content");

    expect(content).toBeUndefined();
  });

  it("hides content when the directive throws an unexpected exception", async () => {
    mockConfigService.getFeatureFlag.mockImplementation(() => Promise.reject("Some error"));
    fixture.detectChanges();
    await fixture.whenStable();

    content = queryContent("boolean-content");

    expect(content).toBeUndefined();
  });
});
