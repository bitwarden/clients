import { ImportType } from "../models/import-options";

/** One way to import from a grouped source. The label is an i18n key when `translate` is set. */
export interface ImportSourceMethod {
  format: ImportType;
  label: string;
  translate?: boolean;
}

/**
 * A vendor offered as a single source in the dropdown, whose formats are picked from a secondary
 * Method dropdown. The member formats keep their own ids, so the CLI and the importer factory are
 * unaffected: the grouping only exists in the import UI.
 */
export interface ImportSourceGroup {
  id: ImportSourceGroupId;
  name: string;
  featuredImporter: boolean;
  methods: readonly ImportSourceMethod[];
}

export type ImportSourceGroupId = "group:1password" | "group:1password-legacy";

export const importSourceGroups: readonly ImportSourceGroup[] = [
  {
    id: "group:1password",
    name: "1Password",
    featuredImporter: true,
    methods: [
      { format: "onepassword", label: "directImporter", translate: true },
      { format: "1password1pux", label: "1pux/json" },
      { format: "1password1pif", label: "1pif" },
    ],
  },
  {
    id: "group:1password-legacy",
    name: "1Password 6 and 7",
    featuredImporter: false,
    methods: [
      { format: "1passwordmaccsv", label: "Mac csv" },
      { format: "1passwordwincsv", label: "Windows csv" },
    ],
  },
];

export function isImportSourceGroupId(value: unknown): value is ImportSourceGroupId {
  return importSourceGroups.some((group) => group.id === value);
}

export function importSourceGroup(id: ImportSourceGroupId): ImportSourceGroup {
  return importSourceGroups.find((group) => group.id === id)!;
}

/** The group a format is offered under, or undefined when it is a source of its own. */
export function importSourceGroupForFormat(format: string): ImportSourceGroup | undefined {
  return importSourceGroups.find((group) => group.methods.some((m) => m.format === format));
}

/**
 * The group with only the methods this client offers, or undefined when it offers none. The first
 * remaining method is the default, which puts direct import first where it is available.
 */
export function availableImportSourceGroup(
  group: ImportSourceGroup,
  isAvailable: (format: ImportType) => boolean,
): ImportSourceGroup | undefined {
  const methods = group.methods.filter((m) => isAvailable(m.format));
  return methods.length > 0 ? { ...group, methods } : undefined;
}
