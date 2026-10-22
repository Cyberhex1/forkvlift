---
type: mcp_config
title: Filesystem MCP limited to one folder
summary: Reference MCP server that lets a desktop chat app read and write files, but only inside the folders you list.
license: See source
testedWith: [{"tool":"Claude Desktop","model":null,"version":null}]
---
The filesystem server is one of the reference servers in [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers). It's the quickest way to let a chat app like Claude Desktop work on files in a project folder.

## Config

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/your/project"]
    }
  }
}
```

Replace the path with the one folder you want it to touch. You can list more than one folder, but each one is fully readable and writable by the agent.

## Careful

- Never point it at your home folder or anything holding keys, `.env` files or SSH config.
- Keep the folder under git so you can see and undo what the agent changed.
