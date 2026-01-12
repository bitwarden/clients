import requiredUsing from "./required-using.mjs";
import noEnums from "./no-enums.mjs";
import noPageScriptUrlLeakage from "./no-page-script-url-leakage.mjs";

export default {
  rules: {
    "required-using": requiredUsing,
    "no-enums": noEnums,
    "no-page-script-url-leakage": noPageScriptUrlLeakage,
  },
};
