import { FormContent } from "@bitwarden/common/autofill/types";

import { FormFieldElement } from "../types";

import { CollectAutofillContentService } from "./abstractions/collect-autofill-content.service";
import { DomElementVisibilityService } from "./abstractions/dom-element-visibility.service";
import { DomQueryService } from "./abstractions/dom-query.service";
import {
  InScopeFormsDetection,
  QualificationResult,
  RuleQualificationService,
} from "./abstractions/rule-qualification.service";

export class DefaultRuleQualificationService implements RuleQualificationService {
  constructor(
    private collectAutofillContentService: CollectAutofillContentService,
    private domQueryService: DomQueryService,
    private domElementVisibilityService: DomElementVisibilityService,
  ) {}

  async qualifyRule(url: string, matchedRule: FormContent[]): Promise<QualificationResult> {
    const startTime = performance.now();
    // Hostname only. URL paths and queries can carry sensitive values.
    const domain = new URL(url).hostname;
    const structural = await this.checkStructural(matchedRule);
    if (!structural.ok) {
      const pageDetails =
        await this.collectAutofillContentService.collectHeuristicPageDetailsBypass();
      // eslint-disable-next-line no-console -- this is running in a content-script; `LogService` is unavailable
      console.debug("[RuleQualificationService] structural miss", {
        domain,
        durationMs: performance.now() - startTime,
        inScopeForms: structural.inScopeForms.forms.size,
      });
      return { kind: "fallback", missReason: "structural", pageDetails };
    }

    const extras = await this.checkInScopeExtras(matchedRule, structural.inScopeForms);
    if (!extras.ok) {
      const pageDetails =
        await this.collectAutofillContentService.collectHeuristicPageDetailsBypass(
          structural.inScopeForms,
        );
      // eslint-disable-next-line no-console -- this is running in a content-script; `LogService` is unavailable
      console.debug("[RuleQualificationService] in_scope_extras miss", {
        domain,
        durationMs: performance.now() - startTime,
        inScopeForms: structural.inScopeForms.forms.size,
      });
      return { kind: "fallback", missReason: "in_scope_extras", pageDetails };
    }

    // eslint-disable-next-line no-console -- this is running in a content-script; `LogService` is unavailable
    console.debug("[RuleQualificationService] proceedTargeted", {
      domain,
      durationMs: performance.now() - startTime,
      inScopeForms: structural.inScopeForms.forms.size,
    });
    return { kind: "proceedTargeted" };
  }

  /**
   * Half 1: every declared selector resolves to an eligible field. Side-effect
   * free. Collects enclosing `<form>` elements along the way so Half 2 knows
   * which forms to detect fields within.
   */
  private async checkStructural(
    rule: FormContent[],
  ): Promise<{ ok: boolean; inScopeForms: InScopeFormsDetection }> {
    const inScopeForms = new Set<HTMLFormElement>();

    for (const form of rule) {
      for (const selector of this.extractDeclaredSelectors(form)) {
        // Iframe `>>>` selectors are partially checked: verify the first-hop
        // iframe exists in the parent's DOM. Later segments live in child
        // frames and are not checked here.
        if (selector.includes(">>>")) {
          const iframeCrossing = this.domQueryService.findIframeCrossing(selector);
          if (iframeCrossing) {
            continue;
          }
        }

        // Plain selector, shadow DOM `>>>`, or broken iframe `>>>` (first
        // segment missing). queryDeepSelector resolves valid cases and returns
        // null for broken chains.
        const element = this.domQueryService.queryDeepSelector(selector) as HTMLElement | null;
        // `isElementHiddenByCss` covers display, visibility, opacity, and
        // clip-path, but not `input type="hidden"`. The eligibility probe
        // treats both as unresolved.
        const isHiddenInput = element instanceof HTMLInputElement && element.type === "hidden";
        if (
          !element ||
          isHiddenInput ||
          this.domElementVisibilityService.isElementHiddenByCss(element)
        ) {
          return { ok: false, inScopeForms: { forms: inScopeForms } };
        }

        const enclosingForm = element.closest("form");
        if (enclosingForm) {
          inScopeForms.add(enclosingForm);
        }
      }
    }

    return { ok: true, inScopeForms: { forms: inScopeForms } };
  }

  /**
   * Half 2: no undeclared field exists in any in-scope form. Populates
   * `inScopeForms.detectedFields` with the detection result so the miss path
   * can reuse it rather than detecting fields in those forms again.
   *
   * Note on formless pages: when every resolved declared selector sits outside
   * a `<form>`, `inScopeForms.forms` is empty and this method returns `ok: true`
   * without finding any extras. The check asks "is there an extra inside any
   * in-scope form?" and with zero in-scope forms the answer is no. This matches
   * the known limitation that formless pages are not covered by the extras check.
   */
  private async checkInScopeExtras(
    rule: FormContent[],
    inScopeForms: InScopeFormsDetection,
  ): Promise<{ ok: boolean }> {
    // Resolve declared selectors to element references for the membership check.
    // Iframe `>>>` selectors resolve inside child frames and are skipped here.
    const declaredElements = new Set<Element>();
    for (const form of rule) {
      for (const selector of this.extractDeclaredSelectors(form)) {
        if (selector.includes(">>>") && this.domQueryService.findIframeCrossing(selector)) {
          continue;
        }
        const element = this.domQueryService.queryDeepSelector(selector);
        if (element) {
          declaredElements.add(element);
        }
      }
    }

    const detectedFields = new Map<HTMLFormElement, FormFieldElement[]>();
    for (const form of inScopeForms.forms) {
      const fields = this.detectHeuristicFieldsInForm(form);
      detectedFields.set(form, fields);
      for (const field of fields) {
        if (!declaredElements.has(field as Element)) {
          inScopeForms.detectedFields = detectedFields;
          return { ok: false };
        }
      }
    }

    inScopeForms.detectedFields = detectedFields;
    return { ok: true };
  }

  /**
   * Flattens a form's declared selectors from `fields` and `container` into a
   * single list. For a `DeepSelectorSequence` (e.g. a 6-digit OTP split across
   * 6 inputs), every member is included. The sequence qualifies only if all
   * members resolve.
   */
  private extractDeclaredSelectors(form: FormContent): string[] {
    const selectors: string[] = [];
    if (form.container) {
      selectors.push(...form.container);
    }
    for (const typeSelectors of Object.values(form.fields)) {
      if (!typeSelectors) {
        continue;
      }
      for (const entry of typeSelectors) {
        if (typeof entry === "string") {
          selectors.push(entry);
        } else {
          selectors.push(...entry);
        }
      }
    }
    return selectors;
  }

  /**
   * Detects heuristic-eligible fields within a single form container. Scoped,
   * side-effect-free equivalent of the field detection in
   * `buildAutofillFieldsData`.
   *
   * We chose a scoped reimplementation over making `buildAutofillFieldsData`
   * cache-optional because the shared method populates the collect service's
   * field caches as a side effect, and those caches must stay empty on the
   * heuristic bypass path. Adding a `skipCaching` branch to the shared path
   * would clutter it for just one caller.
   *
   * Uses the collect service's `isElementFormFieldElement` so the extras check
   * matches the heuristic pass definition of a fillable field. Without
   * this, submit buttons and hidden inputs would read as extras and almost
   * every real-world rule would fail Half 2.
   */
  private detectHeuristicFieldsInForm(form: HTMLFormElement): FormFieldElement[] {
    const candidates = form.querySelectorAll("input, select, textarea");
    return Array.from(candidates).filter((element) =>
      this.collectAutofillContentService.isElementFormFieldElement(element),
    ) as FormFieldElement[];
  }
}
