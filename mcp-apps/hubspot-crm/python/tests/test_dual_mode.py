"""Tests for dual-mode (UI app vs plain MCP) rendering and mode resolution."""

import pytest
from mcp import types
from mcp.types import TextContent

from hs_crm_mcp.hubspot_text import render
from shared_mcp import ui_mode

COMPANY_SCHEMA = {
    "columns": [
        {"apiName": "name", "label": "Name"},
        {"apiName": "domain", "label": "Domain"},
    ],
    "hiddenColumns": [{"apiName": "phone", "label": "Phone"}],
    "formFields": [
        {"name": "name", "label": "Company Name", "required": True},
        {"name": "type", "label": "Type", "picklist": ["PROSPECT", "PARTNER"]},
    ],
}


def _companies(count: int, total: int | None = None) -> dict:
    return {
        "type": "companies",
        "total": total if total is not None else count,
        "items": [
            {"id": str(i), "name": f"Acme {i}", "domain": f"acme{i}.com", "phone": "555"}
            for i in range(count)
        ],
        "_schema": COMPANY_SCHEMA,
        "_cache": {"hit": False, "cached_at": "2026-01-01T00:00:00+00:00"},
    }


# ── render ────────────────────────────────────────────────────────────────────

def test_render_table_has_header_and_ids():
    text = render(_companies(3))
    assert "| id | Name | Domain |" in text
    assert "| 1 | Acme 1 | acme1.com |" in text
    assert "3 companies:" in text


def test_render_single_record_uses_detail_with_hidden_columns():
    text = render(_companies(1))
    assert "- Name: Acme 0" in text
    assert "- Phone: 555" in text


def test_render_truncates_to_max_rows():
    text = render(_companies(10, total=10), max_rows=4)
    assert len([ln for ln in text.splitlines() if ln.startswith("| ")]) == 6  # header+sep+4
    assert "acme4.com" not in text
    assert "Showing 4 of 10" in text


def test_render_empty_list():
    assert render({"type": "companies", "total": 0, "items": [], "_schema": COMPANY_SCHEMA}) == (
        "No companies found."
    )


def test_render_form_describes_follow_up_tool():
    text = render({
        "type": "form", "entity": "company", "mode": "create",
        "recordId": "", "prefill": {"name": "Acme"}, "_schema": COMPANY_SCHEMA,
    })
    assert "hs__create_company" in text
    assert "`name`" in text and "(required)" in text
    assert "PROSPECT, PARTNER" in text
    assert "current: Acme" in text


def test_render_edit_form_points_at_update_tool():
    text = render({
        "type": "form", "entity": "company", "mode": "edit",
        "recordId": "42", "prefill": {"name": "Acme"}, "_schema": COMPANY_SCHEMA,
    })
    assert "hs__update_company" in text
    assert 'company_id="42"' in text


def test_render_alert_includes_suggestions():
    text = render({
        "type": "alert", "message": "Company 'Acmee' not found.",
        "suggestions": ["Acme", "Acme Corp"],
    })
    assert "not found" in text
    assert "Acme Corp" in text


def test_render_error():
    assert render({"type": "error", "message": "boom"}) == "boom"


def test_render_unknown_shape_returns_empty():
    assert render({"type": "something-new"}) == ""


def test_cell_escapes_pipes():
    text = render({
        "type": "companies", "total": 2, "_schema": COMPANY_SCHEMA,
        "items": [{"id": "1", "name": "A|B"}, {"id": "2", "name": "C"}],
    })
    assert r"A\|B" in text


# ── mode resolution ───────────────────────────────────────────────────────────

def test_configure_rejects_unknown_mode():
    try:
        with pytest.raises(ValueError):
            ui_mode.configure("widgets-please")
    finally:
        ui_mode.configure(ui_mode.AUTO)


def test_ui_enabled_only_off_in_plain_mode():
    try:
        assert ui_mode.configure(ui_mode.UI) == ui_mode.UI
        assert ui_mode.ui_enabled()
        ui_mode.configure(ui_mode.AUTO)
        assert ui_mode.ui_enabled()
        ui_mode.configure(ui_mode.PLAIN)
        assert not ui_mode.ui_enabled()
    finally:
        ui_mode.configure(ui_mode.AUTO)


# ── result rewriting ──────────────────────────────────────────────────────────

def _result(structured, text="5 company(ies)."):
    return types.CallToolResult(
        content=[TextContent(type="text", text=text)], structuredContent=structured
    )


def test_adapt_is_a_no_op_in_ui_mode():
    try:
        ui_mode.configure(ui_mode.UI)
        original = _result(_companies(2))
        assert ui_mode.adapt(original, render) is original
    finally:
        ui_mode.configure(ui_mode.AUTO)


def test_adapt_in_auto_mode_renders_text_and_keeps_widget_payload():
    ui_mode.configure(ui_mode.AUTO)
    adapted = ui_mode.adapt(_result(_companies(2)), render)
    assert "| id | Name | Domain |" in adapted.content[0].text
    assert "_schema" in adapted.structuredContent


def test_adapt_in_plain_mode_strips_widget_metadata():
    try:
        ui_mode.configure(ui_mode.PLAIN)
        adapted = ui_mode.adapt(_result(_companies(2)), render)
        assert "_schema" not in adapted.structuredContent
        assert "_cache" not in adapted.structuredContent
        assert adapted.structuredContent["items"]
        assert "| id | Name | Domain |" in adapted.content[0].text
    finally:
        ui_mode.configure(ui_mode.AUTO)


def test_adapt_keeps_write_confirmation():
    structured = _companies(2)
    structured["_updatedId"] = "42"
    adapted = ui_mode.adapt(_result(structured, "Company 42 updated."), render)
    assert adapted.content[0].text.startswith("Company 42 updated.")


def test_adapt_passes_through_unrenderable_result():
    original = _result({"type": "something-new"}, "raw text")
    assert ui_mode.adapt(original, render) is original


@pytest.mark.anyio
async def test_wrap_specs_ui_applies_the_active_mode():
    async def handler():
        return _result(_companies(2))

    try:
        ui_mode.configure(ui_mode.PLAIN)
        wrapped = ui_mode.wrap_specs_ui([{"name": "t", "handler": handler}], render)
        result = await wrapped[0]["handler"]()
        assert "_schema" not in result.structuredContent

        ui_mode.configure(ui_mode.UI)
        wrapped = ui_mode.wrap_specs_ui([{"name": "t", "handler": handler}], render)
        result = await wrapped[0]["handler"]()
        assert "_schema" in result.structuredContent
        assert result.content[0].text == "5 company(ies)."
    finally:
        ui_mode.configure(ui_mode.AUTO)


@pytest.fixture
def anyio_backend():
    return "asyncio"
