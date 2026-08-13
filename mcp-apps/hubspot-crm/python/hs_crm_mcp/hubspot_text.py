"""Plain-mode rendering — turn widget payloads into text an LLM client can read.

Driven entirely by the ``_schema`` each tool already emits, so all tools are
covered without per-tool changes.
"""

from __future__ import annotations

from typing import Any

# structuredContent["type"] -> the tools that act on that entity.
_FOLLOW_UP_TOOLS: dict[str, tuple[str, str]] = {
    "company": ("hs__create_company", "hs__update_company"),
    "contact": ("hs__create_contact", "hs__update_contact"),
    "deal": ("hs__create_deal", "hs__update_deal"),
    "order": ("hs__create_order", "hs__update_order"),
    "product": ("hs__create_product", "hs__update_product"),
    "activity": ("hs__create_activity", "hs__update_activity"),
}

_MAX_CELL = 200


def render(structured: dict, max_rows: int = 25) -> str:
    """Render a tool's structuredContent as markdown. Returns "" if not renderable."""
    kind = structured.get("type", "")
    if kind == "error":
        return structured.get("message", "The request failed.")
    if kind == "alert":
        return _render_alert(structured)
    if kind == "form":
        return _render_form(structured)
    if kind == "activity_form":
        return _render_activity_form(structured)
    if isinstance(structured.get("items"), list):
        return _render_records(structured, max_rows)
    return ""


def _render_alert(structured: dict) -> str:
    lines = [structured.get("message") or structured.get("title", "")]
    suggestions = structured.get("suggestions") or []
    if suggestions:
        lines.append("Closest matches: " + ", ".join(str(s) for s in suggestions))
    return "\n".join(line for line in lines if line)


def _render_form(structured: dict) -> str:
    """A form is a UI affordance — describe the follow-up call instead."""
    entity = structured.get("entity", "record")
    mode = structured.get("mode", "create")
    schema = structured.get("_schema") or {}
    fields = schema.get("formFields") or []
    prefill = structured.get("prefill") or {}
    record_id = structured.get("recordId", "")

    create_tool, update_tool = _FOLLOW_UP_TOOLS.get(entity, ("", ""))
    if mode == "edit":
        head = (
            f"Current values for {entity} {record_id}. "
            f"To apply changes call `{update_tool}` with {entity}_id=\"{record_id}\" "
            "plus only the fields you want to change."
        )
    else:
        head = f"To create a {entity}, call `{create_tool}` with these fields:"

    lines = [head, ""]
    for field in fields:
        name = field.get("name", "")
        parts = [f"- `{name}` — {field.get('label', name)}"]
        if field.get("required"):
            parts.append("(required)")
        picklist = field.get("picklist")
        if picklist:
            labels = field.get("picklistLabels") or {}
            allowed = ", ".join(f"{v} ({labels[v]})" if v in labels else str(v) for v in picklist)
            parts.append(f"— allowed values: {allowed}")
        if field.get("fk"):
            parts.append("— match on the full record name")
        value = prefill.get(name)
        if value not in (None, ""):
            parts.append(f"— current: {_cell(value)}")
        lines.append(" ".join(parts))
    return "\n".join(lines)


def _render_activity_form(structured: dict) -> str:
    """Activity forms carry activity_type instead of entity — describe the call."""
    activity_type = structured.get("activity_type", "activity")
    mode = structured.get("mode", "create")
    schema = structured.get("_schema") or {}
    fields = schema.get("formFields") or []
    prefill = structured.get("prefill") or {}
    record_id = structured.get("recordId", "")
    entity_type = structured.get("entity_type", "")
    entity_name = structured.get("entity_name", "")

    if mode == "edit":
        head = (
            f"Current values for {activity_type} {record_id}. "
            f"To apply changes call `hs__update_activity` with activity_type=\"{activity_type}\", "
            f"activity_id=\"{record_id}\" plus only the fields you want to change."
        )
    else:
        head = (
            f"To create a {activity_type}, call `hs__create_activity` with "
            f"activity_type=\"{activity_type}\" and these fields:"
        )
        if entity_name:
            head += f" (associate with {entity_type or 'record'} \"{entity_name}\")"

    lines = [head, ""]
    for field in fields:
        name = field.get("name", "")
        if name.startswith("_"):
            continue
        parts = [f"- `{name}` — {field.get('label', name)}"]
        if field.get("required"):
            parts.append("(required)")
        picklist = field.get("picklist")
        if picklist:
            labels = field.get("picklistLabels") or {}
            allowed = ", ".join(f"{v} ({labels[v]})" if v in labels else str(v) for v in picklist)
            parts.append(f"— allowed values: {allowed}")
        value = prefill.get(name)
        if value not in (None, ""):
            parts.append(f"— current: {_cell(value)}")
        lines.append(" ".join(parts))
    return "\n".join(lines)


def _render_records(structured: dict, max_rows: int) -> str:
    items: list[dict] = [i for i in structured["items"] if isinstance(i, dict)]
    schema = structured.get("_schema") or {}
    columns = list(schema.get("columns") or [])
    hidden = list(schema.get("hiddenColumns") or [])
    activity_type = structured.get("activity_type")
    label = f"{activity_type}(s)" if activity_type else structured.get("type", "record(s)")
    total = structured.get("total", len(items))

    if not items:
        return f"No {label} found."
    if len(items) == 1:
        return f"1 {label}:\n" + _render_detail(items[0], columns + hidden)

    shown = items[:max_rows]
    if not columns:
        return f"{total} {label}:\n\n" + "\n\n".join(_render_detail(i, []) for i in shown)

    header = ["id"] + [c.get("label", c["apiName"]) for c in columns]
    rows = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * len(header)) + " |",
    ]
    for item in shown:
        cells = [_cell(item.get("id", ""))] + [_cell(item.get(c["apiName"], "")) for c in columns]
        rows.append("| " + " | ".join(cells) + " |")

    out = [f"{total} {label}:", ""] + rows
    if total > len(shown):
        out.append("")
        out.append(f"Showing {len(shown)} of {total}. Narrow the filters to see the rest.")
    return "\n".join(out)


def _render_detail(item: dict, columns: list[dict]) -> str:
    if columns:
        pairs = [("id", item.get("id", ""))] + [
            (c.get("label", c["apiName"]), item.get(c["apiName"], "")) for c in columns
        ]
    else:
        pairs = list(item.items())
    return "\n".join(f"- {label}: {_cell(value)}" for label, value in pairs if value not in (None, ""))


def _cell(value: Any) -> str:
    text = " ".join(str(value if value is not None else "").split())
    if len(text) > _MAX_CELL:
        text = text[: _MAX_CELL - 1] + "…"
    return text.replace("|", "\\|")
