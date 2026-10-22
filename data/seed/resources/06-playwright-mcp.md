---
type: mcp_config
title: Playwright MCP so your agent can click through your app
summary: Config for Microsoft's Playwright MCP server, which lets a coding agent open a real browser, click around your app and see what broke.
license: Apache-2.0
testedWith: [{"tool":"Claude Code","model":null,"version":null},{"tool":"VS Code","model":null,"version":null}]
---
[Playwright MCP](https://github.com/microsoft/playwright-mcp) (Microsoft, Apache-2.0) gives an agent a browser it can drive. Instead of you describing what's on the screen, the agent loads the page and checks for itself.

## Config

Add this to your MCP client's config (the `mcpServers` block that Claude Desktop, Cursor and others use):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

It needs Node.js installed. See the project's README for client-specific setup and options such as headless mode.

## Prompts to try

- "Start the dev server, open the home page, and tell me anything that looks broken."
- "Sign up as a new user and report each step that fails."

## Careful

The agent can click anything the browser can reach. Point it at local or preview builds, not your logged-in production accounts.
