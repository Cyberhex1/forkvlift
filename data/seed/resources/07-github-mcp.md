---
type: mcp_config
title: GitHub's official MCP server (remote)
summary: Connect your agent to GitHub's hosted MCP server so it can read issues, open pull requests and check CI without you copying things back and forth.
license: MIT
testedWith: [{"tool":"VS Code","model":null,"version":null},{"tool":"Claude Code","model":null,"version":null}]
---
[github/github-mcp-server](https://github.com/github/github-mcp-server) is GitHub's own MCP server (MIT). The simplest way in is the hosted version, so there's nothing to install.

## Config

For clients that support remote MCP servers over HTTP:

```json
{
  "mcpServers": {
    "github": {
      "url": "https://api.githubcopilot.com/mcp/"
    }
  }
}
```

Your client will ask you to sign in to GitHub. If it can't do the sign-in flow, the README shows how to pass a personal access token instead, and how to run the server locally with Docker.

## Keep it safe

- Give a token only the repos and scopes the agent needs.
- Read-only is enough for "summarize these issues" work; only grant write access when you want it opening PRs.
