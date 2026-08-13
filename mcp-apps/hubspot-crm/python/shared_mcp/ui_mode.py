"""Dual-mode support — run one server as an MCP UI app *and* as a plain MCP server.

UI hosts render the widget from ``structuredContent``; plain clients (Claude
Desktop, VS Code, stdio agents) only ever see ``content[0].text``, which by
default carries nothing but a row count. Modes:

    ui     original behaviour — widget payload only.
    plain  text-only server; no widget resource, widget metadata stripped.
    auto   both — the widget payload is untouched and the text is rendered in
           full, so no client sniffing is required.
"""

from __future__ import annotations

import functools
import os
from typing import Any, Callable, Iterable

import structlog
from mcp import types

log = structlog.get_logger("ui_mode")

AUTO, UI, PLAIN = "auto", "ui", "plain"

# Widget-only keys stripped from structuredContent in plain mode.
_WIDGET_KEYS = ("_schema", "_cache", "prefill", "style", "field")

_mode: str = os.getenv("MCP_UI_MODE", AUTO).strip().lower() or AUTO
_max_rows: int = int(os.getenv("PLAIN_MAX_ROWS", "25"))


def configure(mode: str | None = None, max_rows: int | None = None) -> str:
    """Set the configured mode (usually from the app's settings). Returns the mode."""
    global _mode, _max_rows
    if mode:
        candidate = mode.strip().lower()
        if candidate not in (AUTO, UI, PLAIN):
            raise ValueError(f"Invalid MCP_UI_MODE {mode!r}; expected auto|ui|plain")
        _mode = candidate
    if max_rows:
        _max_rows = max_rows
    return _mode


def configured_mode() -> str:
    return _mode


def max_rows() -> int:
    return _max_rows


def ui_enabled() -> bool:
    """Whether the widget resource and tool `meta.ui` should be registered."""
    return _mode != PLAIN


def adapt(result: Any, renderer: Callable[[dict, int], str]) -> Any:
    """Re-render a CallToolResult's text for clients that cannot show the widget."""
    if _mode == UI:
        return result
    structured = getattr(result, "structuredContent", None)
    if not isinstance(structured, dict):
        return result
    try:
        text = renderer(structured, _max_rows)
    except Exception as exc:  # a rendering bug must not break the tool
        log.warning("plain_render_failed", error=str(exc), type=structured.get("type"))
        return result
    if not text:
        return result
    # Keep the original line for writes ("Company 123 updated.") — for reads it
    # is only a row count, which the rendered output already states.
    if structured.get("_createdId") or structured.get("_updatedId"):
        lead = _lead_text(result)
        if lead and lead not in text:
            text = f"{lead}\n\n{text}"
    slim = structured if _mode == AUTO else {
        k: v for k, v in structured.items() if k not in _WIDGET_KEYS
    }
    return types.CallToolResult(
        content=[types.TextContent(type="text", text=text)],
        structuredContent=slim,
        isError=getattr(result, "isError", False),
    )


def _lead_text(result: Any) -> str:
    """First text block of the original result — often a create/update confirmation."""
    for block in getattr(result, "content", None) or []:
        text = getattr(block, "text", "")
        if text:
            return text.strip()
    return ""


def wrap_specs_ui(specs: Iterable[dict], renderer: Callable[[dict, int], str]) -> list[dict]:
    """Wrap tool handlers so non-widget clients get readable text.

    Apply this outermost so logging and telemetry still observe the full payload.
    """

    def wrap(fn):
        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            return adapt(await fn(*args, **kwargs), renderer)

        return wrapper

    return [{**spec, "handler": wrap(spec["handler"])} for spec in specs]
