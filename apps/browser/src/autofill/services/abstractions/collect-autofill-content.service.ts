import AutofillPageDetails from "../../models/autofill-page-details";

interface CollectAutofillContentService {
  getPageDetails(): Promise<AutofillPageDetails>;
  getAutofillFieldElementByOpid(opid: string): HTMLElement | null;
}

export { CollectAutofillContentService };
