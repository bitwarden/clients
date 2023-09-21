interface DomElementVisibilityService {
  isFormFieldViewable: (element: HTMLElement) => Promise<boolean>;
  isElementHiddenByCss: (element: HTMLElement) => boolean;
}

export { DomElementVisibilityService };
