import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRepository,
  validateSubmission,
  createIssueUrl,
} from "../src/lib/submission.mjs";

test("repository input accepts shorthand, deep links, git remotes and pasted text", () => {
  const inputs = [
    "logicrw/awesome-jev-projects",
    "logicrw/awesome-jev-projects/",
    "  github.com/logicrw/awesome-jev-projects  ",
    "www.github.com/logicrw/awesome-jev-projects",
    "https://www.github.com/logicrw/awesome-jev-projects",
    "http://github.com/logicrw/awesome-jev-projects",
    "https://github.com/logicrw/awesome-jev-projects/",
    "https://github.com/logicrw/awesome-jev-projects/blob/main/README.md?plain=1#demo",
    "https://github.com/logicrw/awesome-jev-projects/tree/main/src",
    "https://github.com/logicrw/awesome-jev-projects/issues/42",
    "https://github.com/logicrw/awesome-jev-projects.git",
    "git@github.com:logicrw/awesome-jev-projects.git",
    "ssh://git@github.com/logicrw/awesome-jev-projects.git",
    "[SSH remote](ssh://git@github.com/logicrw/awesome-jev-projects.git)",
    "[项目地址](https://github.com/logicrw/awesome-jev-projects)",
    "项目在这里：https://github.com/logicrw/awesome-jev-projects 。",
    "仓库 github.com/logicrw/awesome-jev-projects，",
    "仓库 www.github.com/logicrw/awesome-jev-projects，",
    "See https://github.com/logicrw/awesome-jev-projects.",
  ];
  for (const input of inputs)
    assert.equal(
      normalizeRepository(input),
      "https://github.com/logicrw/awesome-jev-projects",
      input,
    );
});

test("repository input rejects unrelated hosts, ambiguous links and URL tricks", () => {
  const inputs = [
    "",
    " ",
    "github.com",
    "owner",
    "owner/",
    "./repo",
    "../repo",
    "owner/.",
    "owner/..",
    "https://github.com/owner/../repo",
    "https://github.com/./owner/repo",
    "https://github.com.evil.test/owner/repo",
    "https://evilgithub.com/owner/repo",
    "https://www.github.com.evil.test/owner/repo",
    "www.github.com.evil.test/owner/repo",
    "https://ｇithub.com/owner/repo",
    "https://gіthub.com/owner/repo",
    "https://www.ｇithub.com/owner/repo",
    "https://github。com/owner/repo",
    "https://github.com@evil.test/owner/repo",
    "https://evil.test@github.com/owner/repo",
    "https://evil.test/?next=https://github.com/owner/repo",
    "https://github.com:8443/owner/repo",
    "https://github.com/owner%2fevil/repo",
    "javascript:https://github.com/owner/repo",
    "javascript:alert('github.com/owner/repo')",
    "javascript:(https://github.com/owner/repo)",
    "file:(https://github.com/owner/repo)",
    "data:text/plain,https://github.com/owner/repo",
    "ftp://github.com/owner/repo",
    "https://github.com\\@evil.test/owner/repo",
    "git@evil.test:owner/repo",
    "ssh://git@evil.test/owner/repo.git",
    "ssh://other@github.com/owner/repo.git",
    "ssh://Git@github.com/owner/repo.git",
    "Git@github.com:owner/repo.git",
    "ssh://git:password@github.com/owner/repo.git",
    "ssh://git:@github.com/owner/repo.git",
    "ssh://git@github.com.evil.test/owner/repo.git",
    "ssh://git@ｇithub.com/owner/repo.git",
    "ssh://git@github.com:22/owner/repo.git",
    "ssh://github.com/owner/repo.git",
    "user@github.com/owner/repo",
    "notgithub.com/owner/repo",
    "https://github.com/a/b https://github.com/c/d",
  ];
  for (const input of inputs)
    assert.equal(normalizeRepository(input), null, input);
});

test("validation reports all empty fields and does not count whitespace toward minimum", () => {
  const empty = validateSubmission({ repo: "", purpose: "", decision: "" });
  assert.deepEqual(Object.keys(empty.errors), ["repo", "purpose", "decision"]);
  const short = validateSubmission({
    repo: "owner/repo",
    purpose: " 一 二 三 四 ",
    decision: "😀 😃 😄 😁",
  });
  assert.deepEqual(short.errors, {
    purpose: "请补充说明（至少 5 个字）",
    decision: "请补充说明（至少 5 个字）",
  });
});

test("validation trims fields, accepts Unicode and enforces text length limits", () => {
  const valid = validateSubmission({
    repo: " owner/repo ",
    purpose: "  一二三四五  ",
    decision: "  😀😃😄😁😆  ",
  });
  assert.deepEqual(valid, {
    values: {
      repo: "https://github.com/owner/repo",
      purpose: "一二三四五",
      decision: "😀😃😄😁😆",
    },
    errors: {},
  });
  const boundary = validateSubmission({
    repo: "owner/repo",
    purpose: "字".repeat(200),
    decision: "字".repeat(600),
  });
  assert.deepEqual(boundary.errors, {});
  const long = validateSubmission({
    repo: "owner/repo",
    purpose: "字".repeat(201),
    decision: "字".repeat(601),
  });
  assert.deepEqual(long.errors, {
    purpose: "请精简说明（最多 200 个字）",
    decision: "请精简说明（最多 600 个字）",
  });
});

test("issue URL keeps Chinese and query-like user input inside its encoded body", () => {
  const { values, errors } = validateSubmission({
    repo: "owner/repo",
    purpose: "选择 A&B，节省开销",
    decision: "路径 #main?labels=evil&body=替换\n执行下一步",
  });
  assert.deepEqual(errors, {});
  const url = new URL(createIssueUrl(values));
  assert.equal(
    url.origin + url.pathname,
    "https://github.com/waynezengcheng-commits/awesome-agent-task-discovery/issues/new",
  );
  assert.equal(url.searchParams.get("title"), "[Task opportunity] repo");
  assert.deepEqual([...url.searchParams.keys()], ["title", "body"]);
  assert.equal(url.hash, "");
  assert.ok(url.searchParams.get("body").includes(values.repo));
  assert.ok(url.searchParams.get("body").includes(values.purpose));
  assert.ok(url.searchParams.get("body").includes(values.decision));
});

test("English validation changes messages while preserving normalization and length rules", () => {
  const invalid = validateSubmission(
    {
      repo: "https://github.com.evil.test/owner/repo",
      purpose: " a b c d ",
      decision: "",
    },
    "en",
  );
  assert.deepEqual(invalid.errors, {
    repo: "Enter a GitHub repository URL or owner/repo.",
    purpose: "Please add a description (at least 5 characters).",
    decision: "Please add a description (at least 5 characters).",
  });
  const long = validateSubmission(
    { repo: "owner/repo", purpose: "x".repeat(201), decision: "x".repeat(601) },
    "en",
  );
  assert.deepEqual(long.errors, {
    purpose: "Please shorten the description (at most 200 characters).",
    decision: "Please shorten the description (at most 600 characters).",
  });
  const input = {
    repo: "https://www.github.com/owner/repo/blob/main/README.md",
    purpose: "  Routes simple choices  ",
    decision: "  Selects the next action  ",
  };
  assert.deepEqual(
    validateSubmission(input, "en"),
    validateSubmission(input, "zh"),
  );
});

test("English issue body localizes headings and evidence guidance without changing user content", () => {
  const values = {
    repo: "https://github.com/owner/repo",
    purpose: "选择 A&B / Cut costs",
    decision: "Chooses #1?labels=custom&body=hello",
  };
  const url = new URL(createIssueUrl(values, "en"));
  assert.equal(
    url.origin + url.pathname,
    "https://github.com/waynezengcheng-commits/awesome-agent-task-discovery/issues/new",
  );
  assert.equal(url.searchParams.get("title"), "[Task opportunity] repo");
  assert.deepEqual([...url.searchParams.keys()], ["title", "body"]);
  assert.equal(url.hash, "");
  assert.equal(
    url.searchParams.get("body"),
    `## Evidence repository\n${values.repo}\n\n## Agent task\n${values.purpose}\n\n## Execution loop and value\n${values.decision}\n\n## Evidence\nAdd README or implementation links, the expected measurable outcome, and any safety or human-approval boundary.`,
  );
  assert.equal(createIssueUrl(values), createIssueUrl(values, "zh"));
});
