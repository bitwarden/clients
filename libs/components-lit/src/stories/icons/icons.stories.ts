import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import type { TableColumn } from "../../table/table";
import "../../icon/icon";
import "../../table/table";

import { IconStoryData } from "./icon-data";

type IconWithUsage = { id: string; usage: string };

type VariantRow = { variant: string; usage: string };

export default {
  title: "Documentation/Icons",
} satisfies Meta;

type Story = StoryObj;

const code = (value: string) => html`<code class="tw-text-danger-700">${value}</code>`;

const iconColumns: TableColumn<IconWithUsage>[] = [
  { id: "icon", header: "Icon", cell: (row) => html`<bit-icon name=${row.id}></bit-icon>` },
  { id: "class", header: "Icon Class", cell: (row) => code(row.id) },
  { id: "usage", header: "Usage", cell: (row) => row.usage },
];

const iconTable = (rows: IconWithUsage[]): Story => ({
  render: () =>
    html`<bit-table align-content="middle" .columns=${iconColumns} .rows=${rows}></bit-table>`,
});

/** Variant classes go on the `bit-icon` host: size classes set its font size, which the glyph inherits. */
const variantTable = (icon: string, header: string, rows: VariantRow[]): Story => {
  const columns: TableColumn<VariantRow>[] = [
    {
      id: "icon",
      header: "Icon",
      cell: (row) => html`<bit-icon name=${icon} class=${row.variant}></bit-icon>`,
    },
    { id: "class", header, cell: (row) => code(row.variant) },
    { id: "usage", header: "Class notes", cell: (row) => row.usage },
  ];
  return {
    render: () =>
      html`<bit-table align-content="middle" .columns=${columns} .rows=${rows}></bit-table>`,
  };
};

export const StatusIcons = iconTable(IconStoryData.statusIndicators);

export const BitwardenObjects = iconTable(IconStoryData.bitwardenObjects);

export const Actions = iconTable(IconStoryData.actions);

export const DirectionalMenuIndicators = iconTable(IconStoryData.directionalMenuIndicators);

export const MiscObjects = iconTable(IconStoryData.miscObjects);

export const PlatformsAndLogos = iconTable(IconStoryData.platformsAndLogos);

export const SizeVariants = variantTable("bwi-plus", "Size Class", [
  { variant: "", usage: "default size" },
  { variant: "bwi-sm", usage: "reduce font size to 0.875em" },
  { variant: "bwi-lg", usage: "increase font size to ~1.33em" },
  { variant: "bwi-2x", usage: "increase font size to 2em" },
  { variant: "bwi-3x", usage: "increase font size to 3em" },
  { variant: "bwi-4x", usage: "increase font size to 4em" },
  { variant: "bwi-fw", usage: "set fixed width of ~1.3em and text-align center" },
]);

export const RotationVariants = variantTable("bwi-lock", "Rotation Class", [
  { variant: "", usage: "default" },
  { variant: "bwi-rotate-270", usage: "rotate by 270 degrees" },
  { variant: "bwi-spin", usage: "animated spin" },
]);
