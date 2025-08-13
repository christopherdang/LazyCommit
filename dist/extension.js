"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const openaiProvider_1 = require("./ai/openaiProvider");
const prompt_1 = require("./prompt");
const exec = (0, util_1.promisify)(child_process_1.exec);
const EXEC_MAX_BUFFER = 64 * 1024 * 1024; // 64MB to handle large diffs
const GIT_ENV = { ...process.env, GIT_EXTERNAL_DIFF: "", GIT_PAGER: "", PAGER: "", LESS: "" };
async function activate(context) {
    const generateDisposable = vscode.commands.registerCommand("lazyCommit.generateMessage", async () => {
        await withProgress("Generating commit message", async () => {
            const repoRoot = await getRepoRoot();
            if (!repoRoot) {
                throw new Error("No Git repository found in the current workspace.");
            }
            const { diffText, source } = await getRelevantDiff(repoRoot);
            if (!diffText.trim()) {
                throw new Error("No changes found to summarize.");
            }
            const message = await generateMessage(diffText);
            const edited = await vscode.window.showInputBox({
                title: `Lazy Commit (${source})`,
                value: message,
                prompt: "Edit the commit message if desired, then press Enter to copy to clipboard.",
                valueSelection: [0, message.length]
            });
            if (!edited)
                return;
            await vscode.env.clipboard.writeText(edited);
            vscode.window.showInformationMessage("Commit message copied to clipboard");
        });
    });
    const generateAndCommitDisposable = vscode.commands.registerCommand("lazyCommit.generateAndCommit", async () => {
        await withProgress("Generating commit and committing", async () => {
            const repoRoot = await getRepoRoot();
            if (!repoRoot) {
                throw new Error("No Git repository found in the current workspace.");
            }
            let { diffText, source } = await getRelevantDiff(repoRoot);
            if (!diffText.trim()) {
                throw new Error("No changes found to summarize.");
            }
            const message = await generateMessage(diffText);
            const finalMessage = await vscode.window.showInputBox({
                title: `Lazy Commit (${source})`,
                value: message,
                prompt: "Edit the commit message. Press Enter to commit.",
                valueSelection: [0, message.length]
            });
            if (!finalMessage)
                return;
            // Ensure we have staged changes; if not, stage all working changes
            const staged = await hasStagedChanges(repoRoot);
            if (!staged) {
                const choice = await vscode.window.showWarningMessage("No staged changes detected. Stage all and continue?", { modal: true }, "Stage All", "Cancel");
                if (choice !== "Stage All")
                    return;
                await runGit(repoRoot, "git add -A");
                // Refresh diff source label
                source = "staged";
            }
            await runGit(repoRoot, `git commit -m ${shellQuote(finalMessage)}`);
            vscode.window.showInformationMessage("Committed with Lazy Commit ✨");
        });
    });
    context.subscriptions.push(generateDisposable, generateAndCommitDisposable);
}
function deactivate() { }
async function generateMessage(diffText) {
    const config = vscode.workspace.getConfiguration();
    const provider = config.get("lazyCommit.provider", "openai");
    const style = config.get("lazyCommit.style", "conventional");
    if (provider !== "openai") {
        throw new Error("Unsupported provider. Configure `lazyCommit.provider` to 'openai'.");
    }
    const model = config.get("lazyCommit.openai.model", "gpt-4o-mini");
    const apiKey = (config.get("lazyCommit.openai.apiKey") || process.env.OPENAI_API_KEY || "").trim();
    if (!apiKey) {
        throw new Error("OpenAI API key not set. Provide `lazyCommit.openai.apiKey` or the OPENAI_API_KEY env var.");
    }
    const systemPrompt = (0, prompt_1.buildSystemPrompt)(style);
    const userPrompt = (0, prompt_1.buildUserPrompt)(diffText);
    const openai = new openaiProvider_1.OpenAIProvider(apiKey, model);
    const message = await openai.generateCommitMessage(systemPrompt, userPrompt);
    return sanitizeCommitMessage(message);
}
async function getRepoRoot() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0)
        return undefined;
    const workspacePath = folders[0].uri.fsPath;
    try {
        const { stdout } = await exec("git --no-pager rev-parse --show-toplevel", { cwd: workspacePath, env: GIT_ENV, maxBuffer: EXEC_MAX_BUFFER });
        return stdout.trim();
    }
    catch {
        return undefined;
    }
}
async function getRelevantDiff(repoRoot) {
    const staged = await hasStagedChanges(repoRoot);
    if (staged) {
        const { stdout } = await exec("git --no-pager -c core.pager= -c diff.external= diff --cached --no-ext-diff --no-textconv", { cwd: repoRoot, env: GIT_ENV, maxBuffer: EXEC_MAX_BUFFER });
        return { diffText: stdout, source: "staged" };
    }
    const { stdout } = await exec("git --no-pager -c core.pager= -c diff.external= diff --no-ext-diff --no-textconv", { cwd: repoRoot, env: GIT_ENV, maxBuffer: EXEC_MAX_BUFFER });
    return { diffText: stdout, source: "unstaged" };
}
async function hasStagedChanges(repoRoot) {
    const { stdout } = await exec("git --no-pager -c core.pager= -c diff.external= diff --name-only --cached --no-ext-diff --no-textconv", { cwd: repoRoot, env: GIT_ENV, maxBuffer: EXEC_MAX_BUFFER });
    return stdout.trim().length > 0;
}
async function runGit(cwd, command) {
    const prefixed = command.startsWith("git ") ? command.replace(/^git\s+/, "git --no-pager ") : command;
    await exec(prefixed, { cwd, env: GIT_ENV, maxBuffer: EXEC_MAX_BUFFER });
}
async function withProgress(title, task) {
    return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title }, async () => {
        try {
            return await task();
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(message);
            throw err;
        }
    });
}
function sanitizeCommitMessage(message) {
    const singleLine = message.split(/\r?\n/)[0] ?? "";
    return singleLine.trim();
}
function shellQuote(s) {
    // Quote for cross-platform shell (Windows PowerShell/CMD and POSIX)
    // Use double quotes and escape existing double quotes
    const escaped = s.replace(/"/g, '\\"');
    return `"${escaped}"`;
}
//# sourceMappingURL=extension.js.map