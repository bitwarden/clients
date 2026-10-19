import { TestBed } from "@angular/core/testing";

import { I18nMockService } from "@bitwarden/components";

import { LastPassInlineStage } from "./direct/lastpass/lastpass-inline-auth-ui";
import { ImportControlsLastPassLoginComponent } from "./import-controls-lastpass-login.component";

/** Every stage the card can show. A `Record` over the stage kinds, so adding a kind to the
 *  union without listing it here fails to compile, and the test below then requires a story. */
const STAGE_KINDS: Record<LastPassInlineStage["kind"], true> = {
  idle: true,
  loading: true,
  importing: true,
  password: true,
  code: true,
  sso: true,
};

/** Guards the LastPass login stories' mock i18n table against drifting from what each stage's
 *  template resolves: a missing key renders as MISSING_KEY in Storybook and nowhere else. */

// @storybook/angular is ESM-only (can't require() it here) — stub just enough to extract the
// real moduleMetadata() config.
jest.mock("@storybook/angular", () => ({
  moduleMetadata: (metadata: unknown) => (storyFn: () => unknown) => ({
    ...(storyFn() as object),
    moduleMetadata: metadata,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const stories = require("./import-controls-lastpass-login.stories");

describe("import-controls-lastpass-login.stories i18n coverage", () => {
  let missedKeys: string[];

  beforeEach(() => {
    missedKeys = [];
    jest.spyOn(I18nMockService.prototype, "t").mockImplementation(function (
      this: { lookupTable: Record<string, string | ((...args: unknown[]) => string)> },
      key: string,
      ...args: unknown[]
    ) {
      const value = this.lookupTable[key];
      if (value === undefined) {
        missedKeys.push(key);
        return `MISSING_KEY:${key}`;
      }
      return typeof value === "string" ? value : value(...args);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const storyNames = Object.keys(stories).filter((name) => name !== "default");

  it("has a story for every stage the card can show", () => {
    const shown = new Set<string>(storyNames.map((name) => stories[name].args.stage.kind));

    // "idle" is the credentials form, which has its own stories.
    const missing = Object.keys(STAGE_KINDS).filter((kind) => kind !== "idle" && !shown.has(kind));

    expect(missing).toEqual([]);
  });

  it("has a story for each rejected-value state", () => {
    const stages = storyNames.map((name) => stories[name].args.stage);

    expect(
      stages.some((stage) => stage.kind === "password" && stage.previousPasswordRejected),
    ).toBe(true);
    expect(stages.some((stage) => stage.kind === "code" && stage.previousCodeRejected)).toBe(true);
  });

  it.each(storyNames)("%s renders without a missing i18n key", async (name) => {
    const meta = stories.default;
    const metadata = (meta.decorators[0] as (storyFn: () => unknown) => any)(
      () => ({}),
    ).moduleMetadata;

    await TestBed.configureTestingModule({
      imports: [ImportControlsLastPassLoginComponent],
      providers: metadata.providers,
    }).compileComponents();

    const fixture = TestBed.createComponent(ImportControlsLastPassLoginComponent);
    fixture.componentRef.setInput("stage", stories[name].args.stage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).not.toBe("");
    expect(missedKeys).toEqual([]);
  });
});
