"""HubSpot CRM settings — pydantic-settings with dotenv support."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings


class HubSpotSettings(BaseSettings):
    """Configuration loaded from environment / .env file."""

    # HubSpot auth (Private App Token for now)
    hubspot_access_token: str = ""

    # Server
    port: int = 8082
    cors_origins: str = "*"
    mcp_transport: Literal["http", "stdio"] = "http"

    # Dual mode: "ui" always renders the widget, "plain" is a conventional
    # text-only MCP server, "auto" decides per request from client capabilities.
    mcp_ui_mode: Literal["auto", "ui", "plain"] = "auto"
    plain_max_rows: int = 25

    # Telemetry (optional)
    appinsights_connection_string: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache(maxsize=1)
def get_settings() -> HubSpotSettings:
    """Return cached settings singleton."""
    return HubSpotSettings()


def reset_settings_cache() -> None:
    """Clear settings cache (useful for testing)."""
    get_settings.cache_clear()
