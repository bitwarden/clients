import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";

@Component({
    selector: "app-advanced-search",
    templateUrl: "advanced-search.component.html",
    standalone: false,
})
export class AdvancedSearchComponent implements OnChanges {
    @Input() searchText: string = "";
    @Output() searchTextChange = new EventEmitter<string>();

    isOpen: boolean = false;

    // Form model
    matchType: "and" | "or" = "and";

    nameInclude: string = "";
    nameExclude: string = "";

    usernameInclude: string = "";
    usernameExclude: string = "";

    notesInclude: string = "";
    notesExclude: string = "";

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['searchText']) {
            if (!this.isOpen || this.searchText !== this.getSerializedSearchText()) {
                this.parseSearchText(this.searchText);
            }
        }
    }

    togglePopup() {
        this.isOpen = !this.isOpen;
        if (this.isOpen && this.searchText !== this.getSerializedSearchText()) {
            this.parseSearchText(this.searchText);
        }
    }

    closePopup() {
        this.isOpen = false;
    }

    onFormChange() {
        this.serializeSearchText();
    }

    private parseSearchText(text: string | null) {
        this.matchType = "or";
        this.nameInclude = "";
        this.nameExclude = "";
        this.usernameInclude = "";
        this.usernameExclude = "";
        this.notesInclude = "";
        this.notesExclude = "";

        if (!text) {
            return;
        }

        const isAdvanced = text.startsWith(">");
        const workingText = isAdvanced ? text.substring(1) : text;
        const terms = workingText.split(/\s+/).filter(t => t.length > 0);

        let hasPlus = false;
        let hasPlain = false;

        // Helper to extract term value
        const extractTerm = (t: string, prefix: string) => {
            if (t.startsWith(prefix)) {
                return t.substring(prefix.length);
            }
            return null;
        };

        terms.forEach(t => {
            let isInclude = true;
            let isExclude = false;
            let isPlus = false;

            let termVal = t;

            if (t.startsWith("+")) {
                isPlus = true;
                termVal = t.substring(1);
                hasPlus = true;
            } else if (t.startsWith("-")) {
                isExclude = true;
                isInclude = false;
                termVal = t.substring(1);
            } else {
                hasPlain = true;
            }

            const nameVal = extractTerm(termVal, "name:");
            if (nameVal !== null) {
                if (isExclude) this.nameExclude = this.appendTerm(this.nameExclude, nameVal);
                else this.nameInclude = this.appendTerm(this.nameInclude, nameVal);
                return;
            }

            const userVal = extractTerm(termVal, "login.username:");
            if (userVal !== null) {
                if (isExclude) this.usernameExclude = this.appendTerm(this.usernameExclude, userVal);
                else this.usernameInclude = this.appendTerm(this.usernameInclude, userVal);
                return;
            }

            const notesVal = extractTerm(termVal, "notes:");
            if (notesVal !== null) {
                if (isExclude) this.notesExclude = this.appendTerm(this.notesExclude, notesVal);
                else this.notesInclude = this.appendTerm(this.notesInclude, notesVal);
                return;
            }

            // Fallback for terms without a specific field
            if (isExclude) this.nameExclude = this.appendTerm(this.nameExclude, termVal);
            else this.nameInclude = this.appendTerm(this.nameInclude, termVal);
        });

        if (hasPlus && !hasPlain) {
            this.matchType = "and";
        } else {
            this.matchType = "or";
        }
    }

    private appendTerm(existing: string, newTerm: string): string {
        if (!existing) return newTerm;
        return existing + " " + newTerm;
    }

    private getSerializedSearchText(): string {
        let parts: string[] = [];

        const includePrefix = this.matchType === "and" ? "+" : "";

        const addTerms = (fieldStr: string, includeStr: string, excludeStr: string) => {
            if (includeStr) {
                const includeTerms = includeStr.split(/\s+/).filter(t => t.length > 0);
                includeTerms.forEach(t => parts.push(`${includePrefix}${fieldStr}:${t}`));
            }
            if (excludeStr) {
                const excludeTerms = excludeStr.split(/\s+/).filter(t => t.length > 0);
                excludeTerms.forEach(t => parts.push(`-${fieldStr}:${t}`));
            }
        };

        addTerms("name", this.nameInclude, this.nameExclude);
        addTerms("login.username", this.usernameInclude, this.usernameExclude);
        addTerms("notes", this.notesInclude, this.notesExclude);

        if (parts.length > 0) {
            return ">" + parts.join(" ");
        } else {
            return "";
        }
    }

    private serializeSearchText() {
        this.searchTextChange.emit(this.getSerializedSearchText());
    }
}
