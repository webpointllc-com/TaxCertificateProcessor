# I Just Farted — MCP Server

Exposes the API as MCP tools so an AI client (Cursor, Claude Desktop, etc.) can operate on farts through a chat interface.

## Install

```bash
pip install -r mcp_server/requirements.txt
```

## Run

Point it at a running API:

```bash
IJF_API_BASE_URL=http://localhost:8000 python -m mcp_server.server
```

Transport is stdio. The client (Cursor / Claude Desktop / etc.) launches the process for you — you don't run it manually in day-to-day use.

## Environment

| Var | Purpose | Default |
| --- | --- | --- |
| `IJF_API_BASE_URL` | Base URL of the running API | `http://localhost:8000` |
| `IJF_API_TIMEOUT` | HTTP timeout (seconds) | `15` |

## Wire into Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "i-just-farted": {
      "command": "python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "/absolute/path/to/this/repo",
      "env": {
        "IJF_API_BASE_URL": "https://ijf-api.onrender.com"
      }
    }
  }
}
```

## Wire into Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "i-just-farted": {
      "command": "python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "/absolute/path/to/this/repo",
      "env": {
        "IJF_API_BASE_URL": "https://ijf-api.onrender.com"
      }
    }
  }
}
```

## Tools

| Tool | Purpose |
| --- | --- |
| `record_fart` | Record a fart for a handle (auto-creates the user) |
| `list_farts` | List recent farts, filter by handle / time |
| `delete_fart` | Delete a fart by id |
| `add_friend` | Add a friend to a user's network |
| `remove_friend` | Remove a friend |
| `list_friends` | List a user's friends |
| `get_stats` | Aggregate stats + top farters |
