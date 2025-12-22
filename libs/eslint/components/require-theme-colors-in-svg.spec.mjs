import { RuleTester } from "@typescript-eslint/rule-tester";
import rule from "./require-theme-colors-in-svg.mjs";

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      project: [__dirname + "/../tsconfig.spec.json"],
      projectService: {
        allowDefaultProject: ["*.ts*"],
      },
      tsconfigRootDir: __dirname + "/..",
    },
  },
});

ruleTester.run("require-theme-colors-in-svg", rule.default, {
  valid: [
    {
      name: "Allows fill=none",
      code: 'const icon = svgIcon`<svg><path fill="none"/></svg>`;',
    },
    {
      name: "Allows CSS variable",
      code: 'const icon = svgIcon`<svg><path fill="var(--my-color)"/></svg>`;',
    },
    {
      name: "Allows class-based coloring",
      code: 'const icon = svgIcon`<svg><path class="tw-fill-art-primary"/></svg>`;',
    },
  ],
  invalid: [
    {
      name: "Errors on fill with hex color",
      code: 'const icon = svgIcon`<svg><path fill="#000000"/></svg>`;',
      errors: [{ messageId: "hardcodedColor", data: { color: "#000000" } }],
    },
    {
      name: "Errors on stroke with named color",
      code: 'const icon = svgIcon`<svg><path stroke="red"/></svg>`;',
      errors: [{ messageId: "hardcodedColor", data: { color: "red" } }],
    },
    {
      name: "Errors on fill with rgb()",
      code: 'const icon = svgIcon`<svg><path fill="rgb(255,0,0)"/></svg>`;',
      errors: [{ messageId: "hardcodedColor", data: { color: "rgb(255,0,0)" } }],
    },
    {
      name: "Errors on fill with named color",
      code: 'const icon = svgIcon`<svg><path fill="blue"/></svg>`;',
      errors: [{ messageId: "hardcodedColor", data: { color: "blue" } }],
    },
  ],
});
