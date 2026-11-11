import "../shared/autofill-page.css";
import "../shared/autofill-page.scss";

import { AutofillPageI18nService, chromeI18nTranslate } from "../shared/autofill-page-i18n.service";
import { bootstrapAutofillPage } from "../shared/bootstrap-autofill-page";

import { NotificationBarPageComponent } from "./notification-bar-page.component";

void bootstrapAutofillPage(
  NotificationBarPageComponent,
  new AutofillPageI18nService(chromeI18nTranslate),
);
