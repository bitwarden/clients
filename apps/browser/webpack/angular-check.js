/**
 * Webpack plugin that errors if it detects angular imports.
 */
class AngularCheckPlugin {
  apply(compiler) {
    compiler.hooks.assetEmitted.tap("AngularCheckPlugin", (file, info) => {
      // Ensure we only check outputted JavaScript files
      if (!file.endsWith(".js")) {
        return;
      }

      if (info.content.includes("@angular")) {
        throw new Error(
          `Angular detected in ${file}. Please ensure angular is not imported to non popup scripts.`,
        );
      }
    });
  }
}

module.exports = AngularCheckPlugin;
