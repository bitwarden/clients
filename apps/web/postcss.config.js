/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");

module.exports = {
  plugins: [
    require("postcss-import")({
      path: [path.resolve(__dirname, "../../libs"), path.resolve(__dirname, "src/scss")],
    }),
    require("postcss-nested"),
    require("tailwindcss")({ config: path.resolve(__dirname, "tailwind.config.js") }),
    require("autoprefixer"),
  ],
};
