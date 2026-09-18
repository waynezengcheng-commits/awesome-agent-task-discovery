const ISSUE_URL = "https://github.com/waynezengcheng-commits/awesome-agent-task-discovery/issues/new";
const OWNER = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const REPOSITORY = /^[a-z\d_.-]{1,100}$/i;

function repositoryPath(path) {
  const [owner, rawName] = path.replace(/^\//, "").split("/");
  const name = rawName?.replace(/\.git$/i, "");
  if (!OWNER.test(owner ?? "") || !REPOSITORY.test(name ?? "")) return null;
  if (name === "." || name === "..") return null;
  return `https://github.com/${owner}/${name}`;
}

function normalizeCandidate(candidate) {
  if (/[\s\\\u0000-\u001f\u007f]/u.test(candidate)) return null;

  const ssh = /^git@github\.com:([^?#]+)$/i.exec(candidate);
  if (ssh) return candidate.startsWith("git@") ? repositoryPath(ssh[1]) : null;

  if (/^(?:www\.)?github\.com\//i.test(candidate))
    candidate = `https://${candidate}`;
  if (/^(?:https?|ssh):\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      const authority = candidate.match(/^[a-z]+:\/\/([^/]+)/i)?.[1];
      if (url.password || url.port) return null;
      if (url.protocol === "ssh:") {
        if (
          url.username !== "git" ||
          !/^git@github\.com$/i.test(authority ?? "")
        )
          return null;
      } else if (
        url.username ||
        !/^(?:www\.)?github\.com$/i.test(authority ?? "")
      ) {
        return null;
      }
      // Check the original ASCII authority too: URL() normalizes some lookalike characters.
      // Read the original path: URL() silently resolves dot segments before validation.
      const path = candidate.replace(/^[a-z]+:\/\/[^/]+/i, "").split(/[?#]/)[0];
      return repositoryPath(path);
    } catch {
      return null;
    }
  }

  if (/^[^/:?#]+\/[^/:?#]+\/?$/.test(candidate))
    return repositoryPath(candidate);
  return null;
}

/** Accept a repository shorthand, URL, SSH remote, or one URL pasted with surrounding text. */
export function normalizeRepository(input) {
  const value = input.trim();
  if (!value) return null;
  if (/(?:^|[\s[(])(?:javascript|data|vbscript|file|ftp):/i.test(value))
    return null;
  const direct = normalizeCandidate(value);
  if (direct) return direct;

  // Match entire URLs before extracting GitHub links so nested URLs and fake protocols
  // cannot turn an unrelated host into an apparently valid GitHub repository.
  const candidates =
    value.match(
      /git@github\.com:[^\s<>"'`()\]]+|[a-z][a-z\d+.-]*:[^\s<>"'`()\]]+|(?<![\w@./:+-])(?:www\.)?github\.com\/[^\s<>"'`()\]]+/gi,
    ) ?? [];
  if (candidates.length !== 1) return null;
  return normalizeCandidate(candidates[0].replace(/[.,;!，。；！？]+$/u, ""));
}

export function validateSubmission({ repo, purpose, decision }, locale = "zh") {
  const normalized = normalizeRepository(repo);
  const values = {
    repo: normalized ?? repo.trim(),
    purpose: purpose.trim(),
    decision: decision.trim(),
  };
  const errors = {};
  const english = locale === "en";
  if (!normalized)
    errors.repo = english
      ? "Enter a GitHub repository URL or owner/repo."
      : "请输入 GitHub 仓库地址或 owner/repo";
  for (const [field, maximum] of [
    ["purpose", 200],
    ["decision", 600],
  ]) {
    const count = Array.from(values[field].replace(/\s/gu, "")).length;
    if (count < 5)
      errors[field] = english
        ? "Please add a description (at least 5 characters)."
        : "请补充说明（至少 5 个字）";
    else if (Array.from(values[field]).length > maximum)
      errors[field] = english
        ? `Please shorten the description (at most ${maximum} characters).`
        : `请精简说明（最多 ${maximum} 个字）`;
  }
  return { values, errors };
}

/** Build an encoded issue URL from values returned by a successful validation. */
export function createIssueUrl(values, locale = "zh") {
  const url = new URL(ISSUE_URL);
  url.searchParams.set("title", `[Task opportunity] ${values.repo.split("/").pop()}`);
  url.searchParams.set(
    "body",
    locale === "en"
      ? `## Evidence repository\n${values.repo}\n\n## Agent task\n${values.purpose}\n\n## Execution loop and value\n${values.decision}\n\n## Evidence\nAdd README or implementation links, the expected measurable outcome, and any safety or human-approval boundary.`
      : `## 证据仓库\n${values.repo}\n\n## Agent 任务\n${values.purpose}\n\n## 执行闭环与价值\n${values.decision}\n\n## 证据\n请补充 README 或实现代码链接、可衡量的预期结果，以及安全或人工确认边界。`,
  );
  return url.toString();
}
