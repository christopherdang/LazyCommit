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
- `lazyCommit.openai.useProxy`: enable to route requests through a proxy you host
- `lazyCommit.openai.proxyBaseUrl`: base URL of your proxy (the extension will call `<base>/chat/completions`)
- `lazyCommit.openai.proxyHeaders`: optional non-secret headers to send to your proxy
- `lazyCommit.style`: `conventional` or `natural`

## Setup

1. Set your OpenAI API key via environment variable `OPENAI_API_KEY` or in VS Code settings `lazyCommit.openai.apiKey`.
2. Stage your changes (recommended) or let the extension use unstaged changes.
3. Run one of the commands.

## Notes

- The extension prefers staged changes (`git diff --cached`). If none are staged, it will summarize unstaged changes.
- You can edit the generated message before committing.

## Optional: Host a proxy (use your own key securely)

This repo includes a minimal proxy in `proxy/` that forwards to OpenAI and injects your key server-side.

1. Configure environment variables:

- `OPENAI_API_KEY` (required)
- `PUBLIC_ACCESS_TOKEN` (optional): if set, the proxy requires `x-api-key` header to match

2. Run locally:

```bash
cd proxy
npm install
npm run start
```

3. Point the extension to your proxy:

- `lazyCommit.openai.useProxy = true`
- `lazyCommit.openai.proxyBaseUrl = http://localhost:8787`
- Optionally `lazyCommit.openai.proxyHeaders = { "x-api-key": "public-token" }` if you set `PUBLIC_ACCESS_TOKEN`.

Deploy the proxy to your preferred platform (Render/Fly.io/Railway/Heroku/etc.) and set `proxyBaseUrl` accordingly.
