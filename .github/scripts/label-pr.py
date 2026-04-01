#!/usr/bin/env python3
# Requires Python 3.9+
"""
Label pull requests based on changed file paths and PR title patterns (conventional commit format).

Usage:
    python label-pr.py <pr-number> <pr-labels> [-a|--add|-r|--replace] [-d|--dry-run] [-c|--config CONFIG]

Arguments:
    pr-number: The pull request number
    pr-labels: Current PR labels as JSON array string
    -a, --add: Add labels without removing existing ones (default)
    -r, --replace: Replace all existing labels
    -d, --dry-run: Run without actually applying labels
    -c, --config: Path to JSON config file (default: .github/label-pr.json)

Examples:
    python label-pr.py 1234 '[]'
    python label-pr.py 1234 '[{"name":"label1"}]' -a
    python label-pr.py 1234 '[{"name":"label1"}]' --replace
    python label-pr.py 1234 '[{"name":"label1"}]' -r -d
    python label-pr.py 1234 '[]' --config custom-config.json
"""

import argparse
import json
import os
import subprocess
import sys

DEFAULT_MODE = "add"
DEFAULT_CONFIG_PATH = ".github/label-pr.json"

def load_config_json(config_file: str) -> dict:
    """Load configuration from JSON file."""
    if not os.path.exists(config_file):
        print(f"❌ Config file not found: {config_file}")
        sys.exit(1)

    try:
        with open(config_file, 'r') as f:
            config = json.load(f)
            print(f"✅ Loaded config from: {config_file}")

            valid_config = True
            if not config.get("title_patterns"):
                print("❌ Missing 'title_patterns' in config file")
                valid_config = False
            if not config.get("path_patterns"):
                print("❌ Missing 'path_patterns' in config file")
                valid_config = False

            if not valid_config:
                print("::error::Invalid label-pr.json config file, exiting...")
                sys.exit(1)

            return config
    except json.JSONDecodeError as e:
        print(f"❌ JSON deserialization error in label-pr.json config: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error loading label-pr.json config: {e}")
        sys.exit(1)

def gh_get_changed_files(pr_number: str) -> list[str]:
    """Get list of changed files in a pull request."""
    try:
        result = subprocess.run(
            ["gh", "pr", "diff", pr_number, "--name-only"],
            capture_output=True,
            text=True,
            check=True
        )
        changed_files = result.stdout.strip().split("\n")
        return list(filter(None, changed_files))
    except subprocess.CalledProcessError as e:
        print(f"::error::Error getting changed files: {e}")
        return []

def gh_get_pr_title(pr_number: str) -> str:
    """Get the title of a pull request."""
    try:
        result = subprocess.run(
            ["gh", "pr", "view", pr_number, "--json", "title", "--jq", ".title"],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"::error::Error getting PR title: {e}")
        return ""

def gh_add_labels(pr_number: str, labels: list[str]) -> None:
    """Add labels to a pull request (doesn't remove existing labels)."""
    gh_labels = ','.join(labels)
    subprocess.run(
        ["gh", "pr", "edit", pr_number, "--add-label", gh_labels],
        check=True
    )

def gh_replace_labels(pr_number: str, labels: list[str]) -> None:
    """Replace all labels on a pull request with the specified labels."""
    payload = json.dumps({"labels": labels})
    subprocess.run(
        ["gh", "api", "repos/{owner}/{repo}/issues/" + pr_number, "-X", "PATCH", "--silent", "--input", "-"],
        input=payload,
        text=True,
        check=True
    )

def label_filepaths(changed_files: list[str], path_patterns: dict) -> list[str]:
    """Check changed files against path patterns and return labels to apply."""
    if not changed_files:
        return []

    labels_to_apply = set()  # Use set to avoid duplicates

    for label, patterns in path_patterns.items():
        for file in changed_files:
            if any(file.startswith(pattern) for pattern in patterns):
                print(f"👀 File '{file}' matches pattern for label '{label}'")
                labels_to_apply.add(label)
                break

    if "app:shared" in labels_to_apply:
        labels_to_apply.add("app:password-manager")
        labels_to_apply.add("app:authenticator")
        labels_to_apply.remove("app:shared")

    if not labels_to_apply:
        print("::notice::No matching file paths found.")

    return list(labels_to_apply)

def label_title(pr_title: str, title_patterns: dict) -> list[str]:
    """Check PR title against patterns and return labels to apply."""
    if not pr_title:
        return []

    labels_to_apply = set()
    title_lower = pr_title.lower()
    for label, patterns in title_patterns.items():
        for pattern in patterns:
            # Check for pattern with : or ( suffix (conventional commits format)
            if f"{pattern}:" in title_lower or f"{pattern}(" in title_lower:
                print(f"📝 Title matches pattern '{pattern}' for label '{label}'")
                labels_to_apply.add(label)
                break

    if not labels_to_apply:
        print("::notice::No matching title patterns found.")

    return list(labels_to_apply)

def parse_pr_labels(pr_labels_str: str) -> list[str]:
    """Parse PR labels from JSON array string."""
    try:
        labels = json.loads(pr_labels_str)
        if not isinstance(labels, list):
            print("::warning::Failed to parse PR labels: not a list")
            return []
        return [item.get("name") for item in labels if item.get("name")]
    except (json.JSONDecodeError, TypeError) as e:
        print(f"::error::Error parsing PR labels: {e}")
        return []

def get_preserved_labels(pr_labels_str: str) -> list[str]:
    """Get existing PR labels that should be preserved (exclude app: and t: labels)."""
    existing_labels = parse_pr_labels(pr_labels_str)
    print(f"🔍 Parsed PR labels: {existing_labels}")
    preserved_labels = [label for label in existing_labels if not (label.startswith("app:") or label.startswith("t:"))]
    if preserved_labels:
        print(f"🔍 Preserving existing labels: {', '.join(preserved_labels)}")
    return preserved_labels

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Label pull requests based on changed file paths and PR title patterns."
    )
    parser.add_argument(
        "pr_number",
        help="The pull request number"
    )

    parser.add_argument(
        "pr_labels",
        help="Current PR labels (JSON array)"
    )

    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "-a", "--add",
        action="store_true",
        help="Add labels without removing existing ones (default)"
    )
    mode_group.add_argument(
        "-r", "--replace",
        action="store_true",
        help="Replace all existing labels"
    )

    parser.add_argument(
        "-d", "--dry-run",
        action="store_true",
        help="Run without actually applying labels"
    )

    parser.add_argument(
        "-c", "--config",
        default=DEFAULT_CONFIG_PATH,
        help=f"Path to JSON config file (default: {DEFAULT_CONFIG_PATH})"
    )
    args, unknown = parser.parse_known_args() # required to handle --dry-run passed as an empty string ("") by the workflow
    return args

def main():
    args = parse_args()
    config = load_config_json(args.config)
    LABEL_TITLE_PATTERNS = config["title_patterns"]
    LABEL_PATH_PATTERNS = config["path_patterns"]

    pr_number = args.pr_number
    mode = "replace" if args.replace else "add"

    if args.dry_run:
        print("🔍 DRY RUN MODE - Labels will not be applied")
    print(f"📌 Labeling mode: {mode}")
    print(f"🔍 Checking PR #{pr_number}...")

    pr_title = gh_get_pr_title(pr_number)
    print(f"📋 PR Title: {pr_title}\n")

    changed_files = gh_get_changed_files(pr_number)
    print("👀 Changed files:\n" + "\n".join(changed_files) + "\n")

    filepath_labels = label_filepaths(changed_files, LABEL_PATH_PATTERNS)
    title_labels = label_title(pr_title, LABEL_TITLE_PATTERNS)
    all_labels = set(filepath_labels + title_labels)

    if all_labels:
        print("--------------------------------")
        labels_str = ', '.join(sorted(all_labels))
        if mode == "add":
            print(f"::notice::🏷️ Adding labels: {labels_str}")
            if not args.dry_run:
                gh_add_labels(pr_number, list(all_labels))
        else:
            preserved_labels = get_preserved_labels(args.pr_labels)
            if preserved_labels:
                all_labels.update(preserved_labels)
                labels_str = ', '.join(sorted(all_labels))
            print(f"::notice::🏷️ Replacing labels with: {labels_str}")
            if not args.dry_run:
                gh_replace_labels(pr_number, list(all_labels))
    else:
        print("::warning::No matching patterns found, no labels applied.")

    print("✅ Done")

if __name__ == "__main__":
    main()
