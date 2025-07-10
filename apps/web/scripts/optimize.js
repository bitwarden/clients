const child_process = require("child_process");
const path = require("path");

const images = process.argv.slice(2);

images.forEach((img) => {
  switch (img.split(".").pop()) {
    case "png":
      child_process.execSync(
        `npx @squoosh/cli --oxipng {} --output-dir "${path.dirname(img)}" "${img}"`,
      );
      break;
    case "jpg":
      child_process.execSync(
        `npx @squoosh/cli --mozjpeg {"quality":85,"baseline":false,"arithmetic":false,"progressive":true,"optimize_coding":true,"smoothing":0,"color_space":3,"quant_table":3,"trellis_multipass":false,"trellis_opt_zero":false,"trellis_opt_table":false,"trellis_loops":1,"auto_subsample":true,"chroma_subsample":2,"separate_chroma_quality":false,"chroma_quality":75} --output-dir "${path.dirname(
          img,
        )}" "${img}"`,
      );
      break;
  }
});
