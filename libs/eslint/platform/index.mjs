import requiredUsing from "./required-using.mjs";
import noEnums from "./no-enums.mjs";
import noPageScriptUrlLeakage from "./no-page-script-url-leakage.mjs";
import noSelfPackageImport from "./no-self-package-import.mjs";
import noUnawaitedUsingReturn from "./no-unawaited-using-return.mjs";

export default {
  rules: {
    "required-using": requiredUsing,
    "no-enums": noEnums,
    "no-page-script-url-leakage": noPageScriptUrlLeakage,
    "no-self-package-import": noSelfPackageImport,
    "no-unawaited-using-return": noUnawaitedUsingReturn,
  },
};
