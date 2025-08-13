"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSystemPrompt = buildSystemPrompt;
exports.buildUserPrompt = buildUserPrompt;
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
//# sourceMappingURL=prompt.js.map