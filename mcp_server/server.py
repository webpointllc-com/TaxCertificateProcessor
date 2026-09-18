"""I Just Farted — MCP server.

Exposes the API as MCP tools so an AI client (Cursor, Claude Desktop, etc.)
can record and query farts through a chat interface.

Transport: stdio (default MCP transport). Configure your MCP client to run:

  python -m mcp_server.server

Environment:
  IJF_API_BASE_URL   Base URL of the API (default: http://localhost:8000)
  IJF_API_TIMEOUT    HTTP timeout in seconds (default: 15)
"""
from __future__ import annotations

import asyncio
import os
from typing import Any, Optional

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

API_BASE_URL = os.environ.get("IJF_API_BASE_URL", "http://localhost:8000").rstrip("/")
API_TIMEOUT = float(os.environ.get("IJF_API_TIMEOUT", "15"))

server: Server = Server("i-just-farted")


async def _request(method: str, path: str, **kwargs: Any) -> Any:
    async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
        resp = await client.request(method, f"{API_BASE_URL}{path}", **kwargs)
        resp.raise_for_status()
        if resp.status_code == 204 or not resp.content:
            return {"ok": True}
        return resp.json()


def _text(payload: Any) -> list[TextContent]:
    import json

    return [TextContent(type="text", text=json.dumps(payload, indent=2, default=str))]


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="record_fart",
            description="Record a fart for a user. Creates the user if they don't exist.",
            inputSchema={
                "type": "object",
                "properties": {
                    "handle": {"type": "string", "description": "User handle, e.g. 'bill'."},
                    "note": {"type": "string", "description": "Optional note about the fart."},
                    "lat": {"type": "number", "description": "Optional latitude."},
                    "lng": {"type": "number", "description": "Optional longitude."},
                    "intensity": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 10,
                        "description": "Optional intensity 1-10.",
                    },
                    "source": {
                        "type": "string",
                        "description": "Optional source label (e.g. 'mcp', 'pythonista').",
                    },
                },
                "required": ["handle"],
            },
        ),
        Tool(
            name="list_farts",
            description="List recent farts, optionally filtered by handle and time window.",
            inputSchema={
                "type": "object",
                "properties": {
                    "handle": {"type": "string"},
                    "limit": {"type": "integer", "minimum": 1, "maximum": 500, "default": 50},
                    "since_minutes": {
                        "type": "integer",
                        "minimum": 1,
                        "description": "Only return farts newer than this many minutes.",
                    },
                },
            },
        ),
        Tool(
            name="delete_fart",
            description="Delete a fart by its numeric id.",
            inputSchema={
                "type": "object",
                "properties": {"fart_id": {"type": "integer"}},
                "required": ["fart_id"],
            },
        ),
        Tool(
            name="add_friend",
            description="Add a friend to a user's network. Both users are auto-created if needed.",
            inputSchema={
                "type": "object",
                "properties": {
                    "owner_handle": {"type": "string"},
                    "friend_handle": {"type": "string"},
                },
                "required": ["owner_handle", "friend_handle"],
            },
        ),
        Tool(
            name="remove_friend",
            description="Remove a friend from a user's network.",
            inputSchema={
                "type": "object",
                "properties": {
                    "owner_handle": {"type": "string"},
                    "friend_handle": {"type": "string"},
                },
                "required": ["owner_handle", "friend_handle"],
            },
        ),
        Tool(
            name="list_friends",
            description="List all friends for a user handle.",
            inputSchema={
                "type": "object",
                "properties": {"owner_handle": {"type": "string"}},
                "required": ["owner_handle"],
            },
        ),
        Tool(
            name="get_stats",
            description="Get aggregate stats: total farts, users, last-24h counts, top farters.",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: Optional[dict[str, Any]] = None) -> list[TextContent]:
    args = arguments or {}
    try:
        if name == "record_fart":
            body = {k: v for k, v in args.items() if v is not None}
            body.setdefault("source", "mcp")
            data = await _request("POST", "/farts", json=body)
            return _text(data)

        if name == "list_farts":
            params = {k: v for k, v in args.items() if v is not None}
            data = await _request("GET", "/farts", params=params)
            return _text(data)

        if name == "delete_fart":
            fart_id = int(args["fart_id"])
            data = await _request("DELETE", f"/farts/{fart_id}")
            return _text(data)

        if name == "add_friend":
            data = await _request("POST", "/friends", json=args)
            return _text(data)

        if name == "remove_friend":
            data = await _request("DELETE", "/friends", json=args)
            return _text(data)

        if name == "list_friends":
            data = await _request(
                "GET", f"/friends/{args['owner_handle']}"
            )
            return _text(data)

        if name == "get_stats":
            data = await _request("GET", "/stats")
            return _text(data)

        return [TextContent(type="text", text=f"Unknown tool: {name}")]

    except httpx.HTTPStatusError as exc:
        return [
            TextContent(
                type="text",
                text=f"API error {exc.response.status_code}: {exc.response.text}",
            )
        ]
    except Exception as exc:  # noqa: BLE001
        return [TextContent(type="text", text=f"Error: {exc}")]


async def _main() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


def main() -> None:
    asyncio.run(_main())


if __name__ == "__main__":
    main()
