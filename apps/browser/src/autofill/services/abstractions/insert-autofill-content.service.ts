import AutofillScript from "../../models/autofill-script";

interface InsertAutofillContentService {
  fillForm(fillScript: AutofillScript, showAnimations?: boolean): void;
}

export { InsertAutofillContentService };
