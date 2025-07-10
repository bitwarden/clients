import { FormBuilder } from "@angular/forms";

import { FormSelectionList, SelectionItemId } from "./form-selection-list";

interface TestItemView extends SelectionItemId {
  displayName: string;
}

interface TestItemValue extends SelectionItemId {
  value: string;
}

const initialTestItems: TestItemView[] = [
  { id: "1", displayName: "1st Item" },
  { id: "2", displayName: "2nd Item" },
  { id: "3", displayName: "3rd Item" },
];
const totalTestItemCount = initialTestItems.length;

describe("FormSelectionList", () => {
  let formSelectionList: FormSelectionList<TestItemView, TestItemValue>;
  let testItems: TestItemView[];

  const formBuilder = new FormBuilder();

  const testCompareFn = (a: TestItemView, b: TestItemView) => {
    return a.displayName.localeCompare(b.displayName);
  };

  const testControlFactory = (item: TestItemView) => {
    return formBuilder.group({
      id: [item.id],
      value: [""],
    });
  };

  beforeEach(() => {
    formSelectionList = new FormSelectionList<TestItemView, TestItemValue>(
      testControlFactory,
      testCompareFn,
    );
    testItems = [...initialTestItems];
  });

  it("should create with empty arrays", () => {
    expect(formSelectionList.selectedItems.length).toEqual(0);
    expect(formSelectionList.deselectedItems.length).toEqual(0);
    expect(formSelectionList.formArray.length).toEqual(0);
  });

  describe("populateItems()", () => {
    it("should have no selected items when populated without a selection", () => {
      // Act
      formSelectionList.populateItems(testItems, []);

      // Assert
      expect(formSelectionList.selectedItems.length).toEqual(0);
    });

    it("should have selected items when populated with a list of selected items", () => {
      // Act
      formSelectionList.populateItems(testItems, [{ id: "1", value: "test" }]);

      // Assert
      expect(formSelectionList.selectedItems.length).toEqual(1);
      expect(formSelectionList.selectedItems).toHaveProperty("[0].id", "1");
    });
  });

  describe("selectItem()", () => {
    beforeEach(() => {
      formSelectionList.populateItems(testItems);
    });

    it("should add item to selectedItems, remove from deselectedItems, and create a form control when called with a valid id", () => {
      // Act
      formSelectionList.selectItem("1");

      // Assert
      expect(formSelectionList.selectedItems.length).toEqual(1);
      expect(formSelectionList.formArray.length).toEqual(1);
      expect(formSelectionList.deselectedItems.length).toEqual(totalTestItemCount - 1);
    });

    it("should do nothing when called with a invalid id", () => {
      // Act
      formSelectionList.selectItem("bad-id");

      // Assert
      expect(formSelectionList.selectedItems.length).toEqual(0);
      expect(formSelectionList.formArray.length).toEqual(0);
      expect(formSelectionList.deselectedItems.length).toEqual(totalTestItemCount);
    });

    it("should create a form control with an initial value when called with an initial value and valid id", () => {
      // Arrange
      const testValue = "TestValue";
      const idToSelect = "1";

      // Act
      formSelectionList.selectItem(idToSelect, { value: testValue });

      // Assert
      expect(formSelectionList.formArray.length).toEqual(1);
      expect(formSelectionList.formArray.value).toHaveProperty("[0].id", idToSelect);
      expect(formSelectionList.formArray.value).toHaveProperty("[0].value", testValue);

      expect(formSelectionList.selectedItems.length).toEqual(1);
      expect(formSelectionList.deselectedItems.length).toEqual(totalTestItemCount - 1);
    });

    it("should ensure the id value is set for the form control when called with a valid id", () => {
      // Arrange
      const testValue = "TestValue";
      const idToSelect = "1";
      const idOverride = "some-other-id";

      // Act
      formSelectionList.selectItem(idToSelect, { value: testValue, id: idOverride });

      // Assert
      expect(formSelectionList.formArray.value).toHaveProperty("[0].id", idOverride);
      expect(formSelectionList.formArray.value).toHaveProperty("[0].value", testValue);
    });

    // Ensure Angular's Change Detection will pick up any modifications to the array
    it("should create new copies of the selectedItems and deselectedItems arrays when called with a valid id", () => {
      // Arrange
      const initialSelected = formSelectionList.selectedItems;
      const initialdeselected = formSelectionList.deselectedItems;

      // Act
      formSelectionList.selectItem("1");

      // Assert
      expect(formSelectionList.selectedItems).not.toEqual(initialSelected);
      expect(formSelectionList.deselectedItems).not.toEqual(initialdeselected);
    });

    it("should add items to selectedItems array in sorted order when called with a valid id", () => {
      // Act
      formSelectionList.selectItems(["2", "3", "1"]); // Use out of order ids

      // Assert
      expect(formSelectionList.selectedItems).toHaveProperty("[0].id", "1");
      expect(formSelectionList.selectedItems).toHaveProperty("[1].id", "2");
      expect(formSelectionList.selectedItems).toHaveProperty("[2].id", "3");

      // Form array values should be in the same order
      expect(formSelectionList.formArray.value[0].id).toEqual(
        formSelectionList.selectedItems[0].id,
      );

      expect(formSelectionList.formArray.value[1].id).toEqual(
        formSelectionList.selectedItems[1].id,
      );

      expect(formSelectionList.formArray.value[2].id).toEqual(
        formSelectionList.selectedItems[2].id,
      );
    });
  });

  describe("deselectItem()", () => {
    beforeEach(() => {
      formSelectionList.populateItems(testItems, [
        { id: "1", value: "testValue" },
        { id: "2", value: "testValue" },
      ]);
    });

    it("should add item to deselectedItems, remove from selectedItems and remove from formArray when called with a valid id", () => {
      // Act
      formSelectionList.deselectItem("1");

      // Assert
      expect(formSelectionList.selectedItems.length).toEqual(1);
      expect(formSelectionList.formArray.length).toEqual(1);
      expect(formSelectionList.deselectedItems.length).toEqual(2);

      // Value and View should still be in sync
      expect(formSelectionList.formArray.value[0].id).toEqual(
        formSelectionList.selectedItems[0].id,
      );
    });

    it("should do nothing when called with a invalid id", () => {
      // Act
      formSelectionList.deselectItem("bad-id");

      // Assert
      expect(formSelectionList.selectedItems.length).toEqual(2);
      expect(formSelectionList.formArray.length).toEqual(2);
      expect(formSelectionList.deselectedItems.length).toEqual(1);
    });

    // Ensure Angular's Change Detection will pick up any modifications to the array
    it("should create new copies of the selectedItems and deselectedItems arrays when called with a valid id", () => {
      // Arrange
      const initialSelected = formSelectionList.selectedItems;
      const initialdeselected = formSelectionList.deselectedItems;

      // Act
      formSelectionList.deselectItem("1");

      // Assert
      expect(formSelectionList.selectedItems).not.toEqual(initialSelected);
      expect(formSelectionList.deselectedItems).not.toEqual(initialdeselected);
    });

    it("should add items to deselectedItems array in sorted order when called with a valid id", () => {
      // Act
      formSelectionList.deselectItems(["2", "1"]); // Use out of order ids

      // Assert
      expect(formSelectionList.deselectedItems).toHaveProperty("[0].id", "1");
      expect(formSelectionList.deselectedItems).toHaveProperty("[1].id", "2");
      expect(formSelectionList.deselectedItems).toHaveProperty("[2].id", "3");
    });
  });

  describe("deselectAll()", () => {
    beforeEach(() => {
      formSelectionList.populateItems(testItems, [
        { id: "1", value: "testValue" },
        { id: "2", value: "testValue" },
      ]);
    });

    it("should clear the formArray and selectedItems arrays and populate the deselectedItems array when called", () => {
      // Act
      formSelectionList.deselectAll();

      // Assert
      expect(formSelectionList.selectedItems.length).toEqual(0);
      expect(formSelectionList.formArray.length).toEqual(0);
      expect(formSelectionList.deselectedItems.length).toEqual(totalTestItemCount);
    });

    it("should create new arrays for selectedItems and deselectedItems when called", () => {
      // Arrange
      const initialSelected = formSelectionList.selectedItems;
      const initialdeselected = formSelectionList.deselectedItems;

      // Act
      formSelectionList.deselectAll();

      // Assert
      expect(formSelectionList.selectedItems).not.toEqual(initialSelected);
      expect(formSelectionList.deselectedItems).not.toEqual(initialdeselected);
    });
  });
});
