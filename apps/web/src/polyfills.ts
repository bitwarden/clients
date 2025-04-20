import "core-js/stable";
import "core-js/proposals/explicit-resource-management";
import "zone.js";

import "@angular/localize/init";

if (process.env.NODE_ENV === "production") {
  // Production
} else {
  // Development and test
  Error["stackTraceLimit"] = Infinity;
}
