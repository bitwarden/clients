import AutofillField from "../../models/autofill-field";
import AutofillPageDetails from "../../models/autofill-page-details";

export interface InlineMenuFieldQualificationService {
  isFieldForLoginForm(field: AutofillField, pageDetails: AutofillPageDetails): boolean;
}
