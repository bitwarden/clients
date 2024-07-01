export interface DomElementVisibilityService {
  isFormFieldViewable: (element: HTMLElement) => Promise<boolean>;
  isElementHiddenByCss: (element: HTMLElement) => boolean;
}
