import "../shared/autofill-page.css";
import "../shared/autofill-page.scss";

import {
  AutofillPageI18nService,
  translationMapTranslate,
} from "../shared/autofill-page-i18n.service";
import { bootstrapAutofillPage } from "../shared/bootstrap-autofill-page";

import { InlineMenuListPageComponent } from "./inline-menu-list-page.component";

// Sandboxed page: translations arrive with the init message.
void bootstrapAutofillPage(
  InlineMenuListPageComponent,
  new AutofillPageI18nService(translationMapTranslate({})),
);
