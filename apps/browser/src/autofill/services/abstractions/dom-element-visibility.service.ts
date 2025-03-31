export interface DomElementVisibilityService {
  isElementViewable: (element: HTMLElement) => Promise<boolean>;
  isElementHiddenByCss: (element: HTMLElement) => boolean;
}
