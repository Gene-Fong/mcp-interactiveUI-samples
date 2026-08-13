import importlib.util
import json
from pathlib import Path


def _load_regen_module():
    module_path = Path(__file__).resolve().parents[1] / "deploy" / "regen_manifests.py"
    spec = importlib.util.spec_from_file_location("regen_manifests", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_validate_written_allows_plain_mode_without_ui_meta(tmp_path, monkeypatch):
    module = _load_regen_module()
    monkeypatch.setenv("MCP_UI_MODE", "plain")

    tools_path = tmp_path / "mcp-tools.json"
    plugin_path = tmp_path / "ai-plugin.json"
    tools_path.write_text(json.dumps({"tools": [{
        "name": "hs__demo",
        "description": "demo",
        "inputSchema": {"type": "object", "properties": {}}
    }]}) , encoding="utf-8")
    plugin_path.write_text(json.dumps({
        "functions": [{"name": "hs__demo", "description": "demo"}],
        "runtimes": [{
            "type": "RemoteMCPServer",
            "spec": {"url": "https://example.com/mcp", "mcp_tool_description": {"file": "mcp-tools.json"}},
            "run_for_functions": ["hs__demo"],
            "auth": {"type": "None"},
        }],
    }), encoding="utf-8")

    module.TOOLS_PATH = tools_path
    module.PLUGIN_PATH = plugin_path

    assert module.validate_written("hs__") == []
