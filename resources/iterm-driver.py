#!/usr/bin/env python3
"""
ccswarm iTerm2 driver.

JSON-RPC over stdio. Each line on stdin is a JSON request:
  {"id": "...", "method": "create_grid",  "params": {"count": N}}
  {"id": "...", "method": "send_text",    "params": {"session_id": "...", "text": "..."}}
  {"id": "...", "method": "close_window", "params": {"window_id": "..."}}
  {"id": "...", "method": "ping"}

Each response line is JSON:
  {"id": "...", "ok": true,  "result": {...}}
  {"id": "...", "ok": false, "error": "msg"}

Requires: python3 -m pip install iterm2
And iTerm2 Preferences -> General -> Magic -> "Enable Python API" must be on.
"""
from __future__ import annotations

import asyncio
import json
import math
import sys
import threading
import traceback
from typing import Any, Dict, List

try:
    import iterm2
except Exception as exc:  # pragma: no cover
    sys.stderr.write(
        "ccswarm: failed to import iterm2. Install with: python3 -m pip install iterm2\n"
        f"underlying error: {exc}\n"
    )
    sys.exit(2)


def emit(payload: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


def start_stdin_reader(loop: asyncio.AbstractEventLoop, queue: "asyncio.Queue[str]") -> None:
    def _reader() -> None:
        for line in sys.stdin:
            line = line.rstrip("\n")
            if not line:
                continue
            asyncio.run_coroutine_threadsafe(queue.put(line), loop)
        asyncio.run_coroutine_threadsafe(queue.put(""), loop)  # EOF sentinel

    threading.Thread(target=_reader, daemon=True).start()


async def create_grid(connection: iterm2.Connection, count: int) -> Dict[str, Any]:
    """Create a window with `count` panes arranged in a grid."""
    if count < 1:
        raise ValueError("count must be >= 1")
    cols = max(1, int(math.ceil(math.sqrt(count))))
    rows = int(math.ceil(count / cols))

    window = await iterm2.Window.async_create(connection)
    if window is None:
        raise RuntimeError("could not create iTerm2 window - is the Python API enabled?")
    sessions: List[iterm2.Session] = [window.current_tab.current_session]
    grid: List[List[iterm2.Session]] = [[sessions[0]]]

    # Fill first row horizontally (vertical=True splits to the right).
    for _ in range(cols - 1):
        if len(sessions) >= count:
            break
        new = await grid[0][-1].async_split_pane(vertical=True)
        grid[0].append(new)
        sessions.append(new)

    # Subsequent rows: split the leftmost pane of the previous row downward,
    # then fill horizontally.
    for r in range(1, rows):
        if len(sessions) >= count:
            break
        new_left = await grid[r - 1][0].async_split_pane(vertical=False)
        grid.append([new_left])
        sessions.append(new_left)
        for _ in range(cols - 1):
            if len(sessions) >= count:
                break
            new = await grid[r][-1].async_split_pane(vertical=True)
            grid[r].append(new)
            sessions.append(new)

    sessions = sessions[:count]
    await window.async_activate()

    return {
        "window_id": window.window_id,
        "session_ids": [s.session_id for s in sessions],
        "rows": rows,
        "cols": cols,
    }


async def send_text(connection: iterm2.Connection, session_id: str, text: str) -> Dict[str, Any]:
    app = await iterm2.async_get_app(connection)
    session = app.get_session_by_id(session_id)
    if session is None:
        raise RuntimeError(f"session {session_id} not found")
    await session.async_send_text(text)
    return {"sent": len(text)}


async def close_window(connection: iterm2.Connection, window_id: str) -> Dict[str, Any]:
    app = await iterm2.async_get_app(connection)
    for w in app.windows:
        if w.window_id == window_id:
            await w.async_close(force=True)
            return {"closed": True}
    return {"closed": False}


async def dispatch(
    connection: iterm2.Connection, method: str, params: Dict[str, Any]
) -> Dict[str, Any]:
    if method == "ping":
        return {"pong": True}
    if method == "create_grid":
        return await create_grid(connection, int(params.get("count", 1)))
    if method == "send_text":
        return await send_text(connection, str(params["session_id"]), str(params["text"]))
    if method == "close_window":
        return await close_window(connection, str(params["window_id"]))
    raise ValueError(f"unknown method: {method}")


async def main(connection: iterm2.Connection) -> None:
    loop = asyncio.get_running_loop()
    queue: "asyncio.Queue[str]" = asyncio.Queue()
    start_stdin_reader(loop, queue)
    emit({"id": "_ready", "ok": True, "result": {"ready": True}})
    while True:
        line = await queue.get()
        if line == "":
            return
        req: Any = None
        try:
            req = json.loads(line)
            rid = req.get("id")
            method = req["method"]
            params = req.get("params", {}) or {}
            result = await dispatch(connection, method, params)
            emit({"id": rid, "ok": True, "result": result})
        except Exception as exc:  # noqa: BLE001
            emit(
                {
                    "id": req.get("id") if isinstance(req, dict) else None,
                    "ok": False,
                    "error": f"{exc.__class__.__name__}: {exc}",
                    "trace": traceback.format_exc(),
                }
            )


if __name__ == "__main__":
    iterm2.run_until_complete(main, retry=True)
