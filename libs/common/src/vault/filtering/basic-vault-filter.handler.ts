import { LogService } from "../../platform/abstractions/log.service";
import {
  AstNode,
  isAnd,
  isBinary,
  isHasField,
  isInCollection,
  isInFolder,
  isInMyVault,
  isInOrg,
  isOr,
  isParentheses,
  isTypeFilter,
} from "../search/ast";
import { parseQuery } from "../search/parse";

export type BasicFilter = {
  terms: string[];
  vaults: string[];
  folders: string[];
  collections: string[];
  types: string[];
  fields: string[];
};

export class BasicVaultFilterHandler {
  constructor(private readonly logService: LogService) {}

  tryParse(rawFilter: string): { success: true; filter: BasicFilter } | { success: false } {
    const expectedBinaryOperator: Record<string, string> = {
      vaults: "or",
      folders: "or",
      collections: "and",
      types: "or",
      fields: "and",
    };

    // Parse into AST
    const ast = parseQuery(rawFilter, this.logService).ast;

    const basicFilter: Partial<BasicFilter> = {
      vaults: null,
      folders: null,
      collections: null,
      types: null,
      fields: null,
    };

    type VisitData = {
      operator: "or" | "and" | null;
      type: keyof BasicFilter | null;
      values: string[];
    };

    const isValidOperator = (data: VisitData) => {
      if (data.type == null) {
        return false;
      }

      if (data.values.length === 1) {
        // If there aren't multiple values, a null operator is fine and implied
        return data.operator === null;
      }

      return expectedBinaryOperator[data.type] === data.operator;
    };

    const visitNode = (node: AstNode, data: VisitData): boolean => {
      if (isParentheses(node)) {
        return visitNode(node.inner, data);
      }

      if (isBinary(node)) {
        if (data.operator != null && data.operator !== node.type) {
          // All inner operators must be the same
          return false;
        }

        // Set the operator in case it is null
        data.operator = node.type;
        // Visit both left and right
        return visitNode(node.left, data) && visitNode(node.right, data);
      }

      let expressionType: keyof BasicFilter = null;
      let value: string | null | undefined = undefined;

      if (isInMyVault(node)) {
        expressionType = "vaults";
        // null is used to indicate personal vault in basic filter
        value = null;
      } else if (isInOrg(node)) {
        expressionType = "vaults";
        value = node.org;
      } else if (isInFolder(node)) {
        expressionType = "folders";
        value = node.folder;
      } else if (isInCollection(node)) {
        expressionType = "collections";
        value = node.collection;
      } else if (isTypeFilter(node)) {
        expressionType = "types";
        value = node.cipherType;
      } else if (isHasField(node)) {
        expressionType = "fields";
        value = node.field;
      } else {
        // There are various nodes we don't support in the basic filter, this is likely one of those.
        return false;
      }

      if (data.type == null) {
        data.type = expressionType;
      } else if (data.type !== expressionType) {
        // We've previously visited a node of a different type, unsupported
        return false;
      }

      if (value === undefined) {
        throw new Error("Unreachable");
      }

      // Is the string quoted?
      if (value != null && value[0] === '"' && value[value.length - 1] === '"') {
        // Unquote the string if it's quoted, ideally the ast offers this.
        value = value.substring(1, value.length - 1);
      }

      data.values.push(value);
      return true;
    };

    const visitTopLevel = (node: AstNode): boolean => {
      if (isParentheses(node)) {
        // Process top-level parentheses
        // Process singular group
        // TODO: Visit out "useless" parentheses
        const parenthesesData: VisitData = {
          operator: null,
          type: null,
          values: [],
        };

        if (!visitNode(node.inner, parenthesesData)) {
          return false;
        }

        if (basicFilter[parenthesesData.type] != null) {
          // We've already got data for this type
          return false;
        }

        basicFilter[parenthesesData.type] = parenthesesData.values;
        return isValidOperator(parenthesesData);
      } else if (isAnd(node)) {
        // Process top-level and
        return visitTopLevel(node.left) && visitTopLevel(node.right);
      } else if (isOr(node)) {
        // We do not support top level or
        return false;
      } else {
        // Process singular node
        const singularData: VisitData = {
          operator: null,
          type: null,
          values: [],
        };
        const visitResult = visitNode(node, singularData);

        if (!visitResult) {
          return false;
        }

        if (singularData.operator != null) {
          // If one of these nodes came back with an operator, it was not the kind of node we were expecting
          return false;
        }

        if (singularData.values.length !== 1) {
          // If one of these nodes came back with multiple values, it was not the kind of node we were expecting
          return false;
        }

        if (basicFilter[singularData.type] != null) {
          // Can't have multiple groups about the same type
          return false;
        }

        basicFilter[singularData.type] = singularData.values;

        return true;
      }
    };

    if (visitTopLevel(ast.contents)) {
      // Normalize filter for return
      return {
        success: true,
        filter: {
          terms: basicFilter.terms ?? [],
          vaults: basicFilter.vaults ?? [],
          collections: basicFilter.collections ?? [],
          folders: basicFilter.folders ?? [],
          fields: basicFilter.fields ?? [],
          types: basicFilter.types ?? [],
        },
      };
    } else {
      return { success: false };
    }
  }

  toFilter(basicFilter: BasicFilter) {
    let filter = "";
    let addedItem = false;

    const addGroupAdvanced = (
      items: string[],
      selector: (item: string) => string,
      binaryOp: string,
    ) => {
      if (items == null || items.length === 0) {
        return;
      }

      const group = `(${items.map(selector).join(` ${binaryOp} `)})`;
      if (addedItem) {
        filter += " AND ";
      }
      addedItem = true;
      filter += group;
    };

    const addGroup = (items: string[], preamble: string, binaryOp: string) => {
      // TODO: Maybe only quote item when there is containing whitespace so we create as "pretty" of a filter as possible
      addGroupAdvanced(items, (i) => `${preamble}:"${i}"`, binaryOp);
    };

    if (basicFilter.terms != null) {
      if (basicFilter.terms.length === 2) {
        throw new Error("Not currently supported and not currently possible through the UI.");
      }

      if (basicFilter.terms.length === 1) {
        // Add term
        addGroup(basicFilter.terms, "term", "WHAT_TO_PUT_HERE_UNREACHABLE");
      }
    }

    addGroupAdvanced(
      basicFilter.vaults,
      (i) => (i == null ? "in:my_vault" : `in:org:"${i}"`),
      "OR",
    );
    addGroup(basicFilter.folders, "in:folder", "OR");
    addGroup(basicFilter.collections, "in:collection", "AND");
    addGroup(basicFilter.types, "type", "OR");
    addGroup(basicFilter.fields, "has:field", "AND");

    return filter;
  }
}
