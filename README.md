# Lazy Commit

Generate high-quality commit messages from your Git changes using AI, directly inside VS Code.

## Features

- Generate a commit message from staged (preferred) or unstaged changes
- Choose Conventional Commits or a concise natural style
- One-click: generate and commit

## Commands

- `Lazy Commit: Generate Commit Message`
- `Lazy Commit: Generate And Commit`

## Configuration

- `lazyCommit.provider`: `openai`
- `lazyCommit.openai.model`: default `gpt-4o-mini`
- `lazyCommit.openai.apiKey`: if empty, the extension will use the `OPENAI_API_KEY` environment variable
- `lazyCommit.style`: `conventional` or `natural`

## Setup

1. Set your OpenAI API key via environment variable `OPENAI_API_KEY` or in VS Code settings `lazyCommit.openai.apiKey`.
2. Stage your changes (recommended) or let the extension use unstaged changes.
3. Run one of the commands.

## Notes

- The extension prefers staged changes (`git diff --cached`). If none are staged, it will summarize unstaged changes.
- You can edit the generated message before committing.
