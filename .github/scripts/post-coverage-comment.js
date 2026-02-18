/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");

module.exports = async function postCoverageComment({ github, context, core }) {
  const path = process.env.COVERAGE_PATH || "coverage/coverage-comment.txt";
  if (!fs.existsSync(path)) {
    core.warning(`Coverage summary not found at ${path}, skipping comment.`);
    return;
  }

  const marker = "<!-- pqp-coverage-report -->";
  const fullOutput = fs.readFileSync(path, "utf8").trim();

  // Extract only the coverage table (Jest text reporter writes a table after "File | % Stmts ...")
  const lines = fullOutput.split("\n");
  const tableStart = lines.findIndex(
    (line) => line.includes("% Stmts") || line.includes("% Branch"),
  );
  let tableLines = [];
  if (tableStart !== -1) {
    // Include the separator line before the header if present
    if (tableStart > 0 && lines[tableStart - 1].match(/^-+/)) {
      tableLines.push(lines[tableStart - 1]);
    }
    tableLines.push(lines[tableStart]);
    for (let i = tableStart + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === "") break;
      tableLines.push(line);
    }
  } else {
    // Fallback: keep all lines with pipes and percentages
    tableLines = lines.filter((line) => line.includes("%") && line.includes("|"));
  }

  const coverageReport = tableLines.join("\n");
  const commentBody = `${marker}
**PQP Coverage Report**
\`\`\`text
${coverageReport}
\`\`\``;

  const { owner, repo } = context.repo;
  const issue_number =
    (context.payload.pull_request && context.payload.pull_request.number) ||
    (context.issue && context.issue.number);

  if (!issue_number) {
    core.warning("No pull request number found in context, skipping comment.");
    return;
  }

  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number,
  });
  const existing = comments.find((c) => c.body && c.body.includes(marker));

  if (existing) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body: commentBody,
    });
  } else {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body: commentBody,
    });
  }
};
