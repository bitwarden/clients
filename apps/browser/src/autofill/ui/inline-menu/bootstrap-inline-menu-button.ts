import "../shared/autofill-page.css";
import "../shared/autofill-page.scss";

import {
  AutofillPageI18nService,
  translationMapTranslate,
} from "../shared/autofill-page-i18n.service";
import { bootstrapAutofillPage } from "../shared/bootstrap-autofill-page";

import { InlineMenuButtonPageComponent } from "./inline-menu-button-page.component";

// Sandboxed page: translations arrive with the init message.
void bootstrapAutofillPage(
  InlineMenuButtonPageComponent,
  new AutofillPageI18nService(translationMapTranslate({})),
);
