import AutofillScript from "../../models/autofill-script";

interface InsertAutofillContentService {
  fillForm(fillScript: AutofillScript): void;
}

export { InsertAutofillContentService };
