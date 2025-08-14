import * as vscode from "vscode";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import { OpenAIProvider } from "./ai/openaiProvider";
import { buildSystemPrompt, buildUserPrompt, buildFewShotMessages } from "./prompt";

const exec = promisify(execCb);
const EXEC_MAX_BUFFER = 64 * 1024 * 1024; // 64MB to handle large diffs
const GIT_ENV = { ...process.env, GIT_EXTERNAL_DIFF: "", GIT_PAGER: "", PAGER: "", LESS: "" } as NodeJS.ProcessEnv;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const generateDisposable = vscode.commands.registerCommand(
    "lazyCommit.generateMessage",
    async () => {
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
        if (!edited) return;
        await vscode.env.clipboard.writeText(edited);
        vscode.window.showInformationMessage("Commit message copied to clipboard");
      });
    }
  );

  const generateAndCommitDisposable = vscode.commands.registerCommand(
    "lazyCommit.generateAndCommit",
    async () => {
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
        if (!finalMessage) return;

        // Ensure we have staged changes; if not, stage all working changes
        const staged = await hasStagedChanges(repoRoot);
        if (!staged) {
          const choice = await vscode.window.showWarningMessage(
            "No staged changes detected. Stage all and continue?",
            { modal: true },
            "Stage All",
            "Cancel"
          );
          if (choice !== "Stage All") return;
          await runGit(repoRoot, "git add -A");
          // Refresh diff source label
          source = "staged";
        }

        await runGit(repoRoot, `git commit -m ${shellQuote(finalMessage)}`);
        vscode.window.showInformationMessage("Committed with Lazy Commit ✨");
      });
    }
  );

  context.subscriptions.push(generateDisposable, generateAndCommitDisposable);
}

export function deactivate(): void {}

async function generateMessage(diffText: string): Promise<string> {
  const config = vscode.workspace.getConfiguration();
  const provider = config.get<string>("lazyCommit.provider", "openai");
  const style = config.get<"conventional" | "natural">("lazyCommit.style", "conventional");
  const fewShotEnabled = config.get<boolean>("lazyCommit.fewShot.enabled", true);
  const fewShotNum = config.get<number>("lazyCommit.fewShot.numExamples", 3);

  if (provider !== "openai") {
    throw new Error("Unsupported provider. Configure `lazyCommit.provider` to 'openai'.");
  }

  const model = config.get<string>("lazyCommit.openai.model", "gpt-4o-mini");
  const useProxy = config.get<boolean>("lazyCommit.openai.useProxy", false);
  const proxyBaseUrl = (config.get<string>("lazyCommit.openai.proxyBaseUrl") || "").trim();
  const proxyHeaders = config.get<Record<string, string>>("lazyCommit.openai.proxyHeaders", {});
  const apiKey = (config.get<string>("lazyCommit.openai.apiKey") || process.env.OPENAI_API_KEY || "").trim();
  if (!useProxy && !apiKey) {
    throw new Error("OpenAI API key not set. Provide `lazyCommit.openai.apiKey` or the OPENAI_API_KEY env var, or enable proxy mode.");
  }
  if (useProxy && !proxyBaseUrl) {
    throw new Error("Proxy mode enabled but `lazyCommit.openai.proxyBaseUrl` is not set.");
  }

  const systemPrompt = buildSystemPrompt(style);
  const userPrompt = buildUserPrompt(diffText);
  const fewShot = fewShotEnabled ? buildFewShotMessages(style, fewShotNum) : undefined;
  const baseUrl = useProxy ? proxyBaseUrl : "https://api.openai.com/v1";
  const headers = useProxy ? (proxyHeaders || {}) : {};
  const openai = new OpenAIProvider(apiKey, model, baseUrl, headers);
  const message = await openai.generateCommitMessage(systemPrompt, userPrompt, fewShot);
  return sanitizeCommitMessage(message);
}

async function getRepoRoot(): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return undefined;
  const workspacePath = folders[0].uri.fsPath;
  try {
    const { stdout } = await exec("git --no-pager rev-parse --show-toplevel", { cwd: workspacePath, env: GIT_ENV, maxBuffer: EXEC_MAX_BUFFER });
    return stdout.trim();
  } catch {
    return undefined;
  }
}

async function getRelevantDiff(repoRoot: string): Promise<{ diffText: string; source: "staged" | "unstaged" }>{
  const staged = await hasStagedChanges(repoRoot);
  if (staged) {
    const { stdout } = await exec("git --no-pager -c core.pager= -c diff.external= diff --cached --no-ext-diff --no-textconv", { cwd: repoRoot, env: GIT_ENV, maxBuffer: EXEC_MAX_BUFFER });
    return { diffText: stdout, source: "staged" };
  }
  const { stdout } = await exec("git --no-pager -c core.pager= -c diff.external= diff --no-ext-diff --no-textconv", { cwd: repoRoot, env: GIT_ENV, maxBuffer: EXEC_MAX_BUFFER });
  return { diffText: stdout, source: "unstaged" };
}

async function hasStagedChanges(repoRoot: string): Promise<boolean> {
  const { stdout } = await exec("git --no-pager -c core.pager= -c diff.external= diff --name-only --cached --no-ext-diff --no-textconv", { cwd: repoRoot, env: GIT_ENV, maxBuffer: EXEC_MAX_BUFFER });
  return stdout.trim().length > 0;
}

async function runGit(cwd: string, command: string): Promise<void> {
  const prefixed = command.startsWith("git ") ? command.replace(/^git\s+/, "git --no-pager ") : command;
  await exec(prefixed, { cwd, env: GIT_ENV, maxBuffer: EXEC_MAX_BUFFER });
}

async function withProgress<T>(title: string, task: () => Promise<T>): Promise<T> {
  return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title }, async () => {
    try {
      return await task();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(message);
      throw err;
    }
  });
}

function sanitizeCommitMessage(message: string): string {
  const singleLine = message.split(/\r?\n/)[0] ?? "";
  return singleLine.trim();
}

function shellQuote(s: string): string {
  // Quote for cross-platform shell (Windows PowerShell/CMD and POSIX)
  // Use double quotes and escape existing double quotes
  const escaped = s.replace(/"/g, '\\"');
  return `"${escaped}"`;
}
