"""HubSpot MCP server — bootstrap only. Tools in hubspot_tools.py, client in hubspot_client.py."""

import sys
from pathlib import Path

import structlog
import uvicorn
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.middleware.cors import CORSMiddleware

from .hubspot_settings import get_settings
from .hubspot_text import render as render_plain
from .hubspot_tools import TOOL_SPECS, PROMPT_SPECS
from shared_mcp.telemetry import wrap_specs
from shared_mcp.file_logger import wrap_specs_logging
from shared_mcp import ui_mode

log = structlog.get_logger("hs")
settings = get_settings()

UI_MODE = ui_mode.configure(settings.mcp_ui_mode, settings.plain_max_rows)

# Outermost wrapper: logging and telemetry still see the full widget payload.
TOOL_SPECS = ui_mode.wrap_specs_ui(
    wrap_specs_logging(wrap_specs(TOOL_SPECS)), render_plain
)

WIDGET_URI = "ui://widget/hubspot.html"
WIDGET_HTML_PATH = Path(__file__).parent.parent / "web" / "widget.html"

mcp = FastMCP(
    "ask-hubspot-crm",
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)

if ui_mode.ui_enabled():

    @mcp.resource(WIDGET_URI, mime_type="text/html;profile=mcp-app")
    async def hubspot_widget() -> str:
        """Serve the single-file React widget."""
        return WIDGET_HTML_PATH.read_text(encoding="utf-8")


_TOOL_META = {"ui": {"resourceUri": WIDGET_URI}} if ui_mode.ui_enabled() else None
_TEXT_HINT = (
    "" if UI_MODE == ui_mode.UI else " Results are returned as markdown in the text content."
)

# Register tools
for _spec in TOOL_SPECS:
    mcp.tool(
        name=_spec["name"],
        description=_spec["description"] + _TEXT_HINT,
        meta=_TOOL_META,
    )(_spec["handler"])

# Register prompts
for _spec in PROMPT_SPECS:
    mcp.prompt(name=_spec["name"], description=_spec["description"])(_spec["handler"])


def _validate_env(stream=sys.stdout) -> None:
    """Check required env vars and print status banner."""
    def emit(line: str = "") -> None:
        print(line, file=stream)

    token = settings.hubspot_access_token
    emit("  +-- Environment " + "-" * 33)
    tag = "[OK] " + token[:16] + "..." if token else "[MISSING]"
    emit(f"  | HUBSPOT_ACCESS_TOKEN  {tag}")
    emit(f"  | PORT                  {settings.port}")
    emit(f"  | MCP_TRANSPORT         {settings.mcp_transport}")
    emit(f"  | MCP_UI_MODE           {UI_MODE}")
    emit("  +" + "-" * 50)
    if not token:
        log.error("missing_env_vars", vars=["HUBSPOT_ACCESS_TOKEN"])
        emit("\n  [ERROR] Missing required env var: HUBSPOT_ACCESS_TOKEN")
        sys.exit(1)
    if ui_mode.ui_enabled() and not WIDGET_HTML_PATH.exists():
        log.error("missing_widget", path=str(WIDGET_HTML_PATH))
        emit(f"\n  [ERROR] Widget not built: {WIDGET_HTML_PATH}")
        emit("          Run 'npm install && npm run build' in widgets/, "
             "or set MCP_UI_MODE=plain.")
        sys.exit(1)


def main() -> None:
    """Entry point for the HubSpot MCP server."""
    if settings.mcp_transport == "stdio":
        # stdout carries the protocol — the banner and every log line must go to stderr.
        structlog.configure(logger_factory=structlog.PrintLoggerFactory(file=sys.stderr))
        _validate_env(sys.stderr)
        mcp.run(transport="stdio")
        return

    _validate_env()
    log.info("starting", port=settings.port, ui_mode=UI_MODE)
    print(f"\n  [*] Ask - HubSpot CRM starting on port {settings.port}")

    app = mcp.streamable_http_app()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins.split(","),
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "mcp-session-id"],
    )
    uvicorn.run(app, host="0.0.0.0", port=settings.port)


if __name__ == "__main__":
    main()
