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
import { AutoFillConstants } from "./autofill-constants";

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
   * Half 1: for each declared field, at least one alternative qualifies.
   * Side-effect free. Collects enclosing `<form>` elements along the way so
   * Half 2 knows which forms to detect fields within.
   */
  private async checkStructural(
    rule: FormContent[],
  ): Promise<{ ok: boolean; inScopeForms: InScopeFormsDetection }> {
    const inScopeForms = new Set<HTMLFormElement>();

    for (const form of rule) {
      for (const alternatives of this.extractAlternativeGroups(form)) {
        const winningElements = this.firstQualifyingAlternative(alternatives);
        if (winningElements === null) {
          return { ok: false, inScopeForms: { forms: inScopeForms } };
        }
        for (const element of winningElements) {
          const enclosingForm = element.closest("form");
          if (enclosingForm) {
            inScopeForms.add(enclosingForm);
          }
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
   * The declared set includes elements for every alternative that resolves,
   * not just the one Half 1 picked. If a rule declares `username: ["#email",
   * "#login"]` and both exist on the page, neither counts as an extra.
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
    const declaredElements = new Set<Element>();
    for (const selector of this.flattenDeclaredSelectors(rule)) {
      if (selector.includes(">>>") && this.domQueryService.findIframeCrossing(selector)) {
        continue;
      }
      const element = this.domQueryService.queryDeepSelector(selector);
      if (element) {
        declaredElements.add(element);
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
   * Returns one list of alternatives per declared field, plus the container
   * if present. A field qualifies when any one alternative qualifies. An
   * alternative is a list of selectors that must all resolve together. A
   * string entry becomes a one-member list. A `DeepSelectorSequence` entry
   * carries all its members.
   *
   * Container selectors are grouped the same way: multiple entries name the
   * same container element, so any one that resolves qualifies.
   */
  private extractAlternativeGroups(form: FormContent): string[][][] {
    const groups: string[][][] = [];

    if (form.container) {
      groups.push(form.container.map((selector) => [selector]));
    }

    for (const typeSelectors of Object.values(form.fields)) {
      if (!typeSelectors) {
        continue;
      }
      groups.push(typeSelectors.map((entry) => (typeof entry === "string" ? [entry] : entry)));
    }

    return groups;
  }

  /**
   * Flattens every declared selector from a rule into one list. The extras
   * check only needs element identity, not alternative grouping, so a flat
   * walk keeps the caller free of deep nesting.
   */
  private flattenDeclaredSelectors(rule: FormContent[]): string[] {
    const selectors: string[] = [];
    for (const form of rule) {
      for (const alternatives of this.extractAlternativeGroups(form)) {
        for (const members of alternatives) {
          selectors.push(...members);
        }
      }
    }
    return selectors;
  }

  /**
   * Returns the resolved elements of the first alternative that fully
   * qualifies, or null if none do. An iframe `>>>` selector with a resolved
   * first-hop iframe counts as qualifying without contributing a local
   * element. Later segments live in child frames and are not checked here.
   */
  private firstQualifyingAlternative(alternatives: string[][]): HTMLElement[] | null {
    for (const members of alternatives) {
      const resolved: HTMLElement[] = [];
      let allResolve = true;
      for (const selector of members) {
        if (selector.includes(">>>") && this.domQueryService.findIframeCrossing(selector)) {
          continue;
        }
        const element = this.domQueryService.queryDeepSelector(selector) as HTMLElement | null;
        if (!element || this.isElementIneligible(element)) {
          allResolve = false;
          break;
        }
        resolved.push(element);
      }
      if (allResolve) {
        return resolved;
      }
    }
    return null;
  }

  /**
   * Treats `input type="hidden"` and CSS-hidden elements (display, visibility,
   * opacity, clip-path) as unresolved, matching the eligibility probe.
   */
  private isElementIneligible(element: HTMLElement): boolean {
    const isHiddenInput = element instanceof HTMLInputElement && element.type === "hidden";
    return isHiddenInput || this.domElementVisibilityService.isElementHiddenByCss(element);
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
   * Uses the same `queryWithUnresolvedShadowHosts` call the full heuristic
   * scan uses, so shadow-rooted fields and `span[data-bwautofill]` surface
   * the same way. The predicate narrows further via `isFillableField`.
   * Unresolved shadow hosts are discarded. The collect service handles
   * shadow tracker reconciliation on its own full scan.
   */
  private detectHeuristicFieldsInForm(form: HTMLFormElement): FormFieldElement[] {
    const { elements } = this.domQueryService.queryWithUnresolvedShadowHosts<FormFieldElement>(
      form,
      (element) => this.isFillableField(element),
    );
    return elements;
  }

  /**
   * Narrows the collect service's form-field filter to elements the autofill
   * engine can actually fill. Rules have no field type for checkbox or radio
   * and the autofill engine does not fill them, so counting them as extras
   * would misfire on common login forms (e.g. a Remember Me checkbox).
   * CSS-hidden elements are also skipped so honeypot inputs do not trip the
   * extras check.
   */
  private isFillableField(element: Element): boolean {
    if (!this.collectAutofillContentService.isElementFormFieldElement(element)) {
      return false;
    }
    if (
      element instanceof HTMLInputElement &&
      AutoFillConstants.ExcludedAutofillTypes.includes(element.type)
    ) {
      return false;
    }
    return !this.domElementVisibilityService.isElementHiddenByCss(element as HTMLElement);
  }
}
