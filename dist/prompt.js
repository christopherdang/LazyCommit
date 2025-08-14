"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSystemPrompt = buildSystemPrompt;
exports.buildUserPrompt = buildUserPrompt;
exports.buildFewShotMessages = buildFewShotMessages;
function buildSystemPrompt(style) {
    if (style === "conventional") {
        return [
            "You are a world-class commit message generator.",
            "Given a Git diff, produce a single high-quality Conventional Commit subject line.",
            "Rules:",
            "- Output only the commit message, nothing else.",
            "- Use type(scope): summary format. Common types: feat, fix, refactor, docs, chore, test, build, ci, perf, style.",
            "- Scope is optional; include when it clarifies the area (e.g., api, ui, tests).",
            "- Keep the subject <= 72 characters.",
            "- Focus on user-facing impact and intent, not implementation details.",
            "- Prefer present tense, imperative mood (e.g., \"add\", \"fix\")."
        ].join("\n");
    }
    return [
        "You are a world-class commit message generator.",
        "Given a Git diff, produce a concise, single-line summary.",
        "Rules:",
        "- Output only the commit message, nothing else.",
        "- Keep it <= 72 characters.",
        "- Prefer present tense, imperative mood.",
        "- Focus on user-facing impact and intent."
    ].join("\n");
}
function buildUserPrompt(diffText) {
    const truncated = truncateDiff(diffText, 200000);
    return `Diff to summarize:\n\n${truncated}`;
}
function truncateDiff(diffText, maxChars) {
    if (diffText.length <= maxChars)
        return diffText;
    const head = diffText.slice(0, Math.floor(maxChars * 0.7));
    const tail = diffText.slice(-Math.floor(maxChars * 0.25));
    return `${head}\n...\n[diff truncated]\n...\n${tail}`;
}
function buildFewShotMessages(style, maxExamples) {
    const examplesConventional = [
        {
            user: [
                "Diff to summarize:",
                "",
                "diff --git a/src/api/user.ts b/src/api/user.ts",
                "--- a/src/api/user.ts",
                "+++ b/src/api/user.ts",
                "@@",
                "+ export async function createUser(req, res) {",
                "+   // create user from request body",
                "+   // ...",
                "+ }"
            ].join("\n"),
            assistant: "feat(api): add user creation endpoint"
        },
        {
            user: [
                "Diff to summarize:",
                "",
                "diff --git a/src/ui/Sidebar.tsx b/src/ui/Sidebar.tsx",
                "--- a/src/ui/Sidebar.tsx",
                "+++ b/src/ui/Sidebar.tsx",
                "@@",
                "- const isOpen = user.settings.sidebar.open;",
                "+ const isOpen = user?.settings?.sidebar?.open ?? false;"
            ].join("\n"),
            assistant: "fix(ui): prevent crash when toggling sidebar without user"
        },
        {
            user: [
                "Diff to summarize:",
                "",
                "diff --git a/src/core/data.ts b/src/core/data.ts",
                "--- a/src/core/data.ts",
                "+++ b/src/core/data.ts",
                "@@",
                "- export async function fetchData() {",
                "+ export async function loadData() {",
                "@@",
                "+ // extracted parse util"
            ].join("\n"),
            assistant: "refactor(core): rename fetchData to loadData and extract util"
        }
    ];
    const examplesNatural = [
        {
            user: examplesConventional[0].user,
            assistant: "Add user creation endpoint"
        },
        {
            user: examplesConventional[1].user,
            assistant: "Prevent crash when toggling sidebar without user"
        },
        {
            user: examplesConventional[2].user,
            assistant: "Rename fetchData to loadData and extract util"
        }
    ];
    const source = style === "conventional" ? examplesConventional : examplesNatural;
    const limited = source.slice(0, Math.max(0, Math.min(maxExamples, source.length)));
    return limited.flatMap(e => [
        { role: "user", content: e.user },
        { role: "assistant", content: e.assistant }
    ]);
}
//# sourceMappingURL=prompt.js.map