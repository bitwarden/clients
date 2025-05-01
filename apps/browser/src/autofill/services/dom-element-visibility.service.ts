// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AutofillInlineMenuContentService } from "../overlay/inline-menu/abstractions/autofill-inline-menu-content.service";
import { FillableFormFieldElement, FormFieldElement } from "../types";

import { DomElementVisibilityService as DomElementVisibilityServiceInterface } from "./abstractions/dom-element-visibility.service";

class DomElementVisibilityService implements DomElementVisibilityServiceInterface {
  private cachedComputedStyle: CSSStyleDeclaration | null = null;

  constructor(private inlineMenuContentService?: AutofillInlineMenuContentService) {}

  /**
   * Checks if an element is viewable. This is done by checking if the element is within the
   * viewport bounds, not hidden by CSS, and not hidden behind another element.
   * @param element
   */
  async isElementViewable(element: HTMLElement): Promise<boolean> {
    const elementBoundingClientRect = element.getBoundingClientRect();
    if (
      this.isElementOutsideViewportBounds(element, elementBoundingClientRect) ||
      this.isElementHiddenByCss(element)
    ) {
      return false;
    }

    return this.formFieldIsNotHiddenBehindAnotherElement(element, elementBoundingClientRect);
  }

  /**
   * Check if the target element is hidden using CSS. This is done by checking the opacity, display,
   * visibility, and clip-path CSS properties of the element. We also check the opacity of all
   * parent elements to ensure that the target element is not hidden by a parent element.
   * @param {HTMLElement} element
   * @returns {boolean}
   * @public
   */
  isElementHiddenByCss(element: HTMLElement): boolean {
    this.cachedComputedStyle = null;

    if (
      this.isElementInvisible(element) ||
      this.isElementNotDisplayed(element) ||
      this.isElementNotVisible(element) ||
      this.isElementClipped(element)
    ) {
      return true;
    }

    let parentElement = element.parentElement;
    while (parentElement && parentElement !== element.ownerDocument.documentElement) {
      this.cachedComputedStyle = null;
      if (this.isElementInvisible(parentElement)) {
        return true;
      }

      parentElement = parentElement.parentElement;
    }

    return false;
  }

  /**
   * Gets the computed style of a given element, will only calculate the computed
   * style if the element's style has not been previously cached.
   * @param {HTMLElement} element
   * @param {string} styleProperty
   * @returns {string}
   * @private
   */
  private getElementStyle(element: HTMLElement, styleProperty: string): string {
    if (!this.cachedComputedStyle) {
      this.cachedComputedStyle = (element.ownerDocument.defaultView || globalThis).getComputedStyle(
        element,
      );
    }

    return this.cachedComputedStyle.getPropertyValue(styleProperty);
  }

  /**
   * Checks if the opacity of the target element is less than 0.1.
   * @param {HTMLElement} element
   * @returns {boolean}
   * @private
   */
  private isElementInvisible(element: HTMLElement): boolean {
    return parseFloat(this.getElementStyle(element, "opacity")) < 0.1;
  }

  /**
   * Checks if the target element has a display property of none.
   * @param {HTMLElement} element
   * @returns {boolean}
   * @private
   */
  private isElementNotDisplayed(element: HTMLElement): boolean {
    return this.getElementStyle(element, "display") === "none";
  }

  /**
   * Checks if the target element has a visibility property of hidden or collapse.
   * @param {HTMLElement} element
   * @returns {boolean}
   * @private
   */
  private isElementNotVisible(element: HTMLElement): boolean {
    return new Set(["hidden", "collapse"]).has(this.getElementStyle(element, "visibility"));
  }

  /**
   * Checks if the target element has a clip-path property that hides the element.
   * @param {HTMLElement} element
   * @returns {boolean}
   * @private
   */
  private isElementClipped(element: HTMLElement): boolean {
    return new Set([
      "inset(50%)",
      "inset(100%)",
      "circle(0)",
      "circle(0px)",
      "circle(0px at 50% 50%)",
      "polygon(0 0, 0 0, 0 0, 0 0)",
      "polygon(0px 0px, 0px 0px, 0px 0px, 0px 0px)",
    ]).has(this.getElementStyle(element, "clipPath"));
  }

  /**
   * Checks if the target element is outside the viewport bounds. This is done by checking if the
   * element is too small or is overflowing the viewport bounds.
   * @param {HTMLElement} targetElement
   * @param {DOMRectReadOnly | null} targetElementBoundingClientRect
   * @returns {boolean}
   * @private
   */
  private isElementOutsideViewportBounds(
    targetElement: HTMLElement,
    targetElementBoundingClientRect: DOMRectReadOnly | null = null,
  ): boolean {
    const documentElement = targetElement.ownerDocument.documentElement;
    const documentElementWidth = documentElement.scrollWidth;
    const documentElementHeight = documentElement.scrollHeight;
    const elementBoundingClientRect =
      targetElementBoundingClientRect || targetElement.getBoundingClientRect();
    const elementTopOffset = elementBoundingClientRect.top - documentElement.clientTop;
    const elementLeftOffset = elementBoundingClientRect.left - documentElement.clientLeft;

    const isElementSizeInsufficient =
      elementBoundingClientRect.width < 10 || elementBoundingClientRect.height < 10;
    const isElementOverflowingLeftViewport = elementLeftOffset < 0;
    const isElementOverflowingRightViewport =
      elementLeftOffset + elementBoundingClientRect.width > documentElementWidth;
    const isElementOverflowingTopViewport = elementTopOffset < 0;
    const isElementOverflowingBottomViewport =
      elementTopOffset + elementBoundingClientRect.height > documentElementHeight;

    return (
      isElementSizeInsufficient ||
      isElementOverflowingLeftViewport ||
      isElementOverflowingRightViewport ||
      isElementOverflowingTopViewport ||
      isElementOverflowingBottomViewport
    );
  }

  /**
   * Checks if a passed FormField is not hidden behind another element. This is done by
   * checking if the element at the center point of the FormField is the FormField itself
   * or one of its labels.
   * @param {FormFieldElement} targetElement
   * @param {DOMRectReadOnly | null} targetElementBoundingClientRect
   * @returns {boolean}
   * @private
   */
  private formFieldIsNotHiddenBehindAnotherElement(
    targetElement: FormFieldElement,
    targetElementBoundingClientRect: DOMRectReadOnly | null = null,
  ): boolean {
    const elementBoundingClientRect =
      targetElementBoundingClientRect || targetElement.getBoundingClientRect();
    const elementRootNode = targetElement.getRootNode();
    const rootElement =
      elementRootNode instanceof ShadowRoot ? elementRootNode : targetElement.ownerDocument;
    const elementAtCenterPoint = rootElement.elementFromPoint(
      elementBoundingClientRect.left + elementBoundingClientRect.width / 2,
      elementBoundingClientRect.top + elementBoundingClientRect.height / 2,
    );

    if (elementAtCenterPoint === targetElement) {
      return true;
    }

    if (this.inlineMenuContentService?.isElementInlineMenu(elementAtCenterPoint as HTMLElement)) {
      return true;
    }

    const targetElementLabelsSet = new Set((targetElement as FillableFormFieldElement).labels);
    if (targetElementLabelsSet.has(elementAtCenterPoint as HTMLLabelElement)) {
      return true;
    }

    const closestParentLabel = elementAtCenterPoint?.parentElement?.closest("label");

    return targetElementLabelsSet.has(closestParentLabel);
  }
}

export default DomElementVisibilityService;
