import { tokens } from '@fluentui/react-components';

// ── HubSpot Picklist Constants ─────────────────────────────────────────────
export const HS_TYPES = ['PROSPECT', 'PARTNER', 'RESELLER', 'VENDOR', 'OTHER'];
export const HS_LIFECYCLESTAGES = ['subscriber', 'lead', 'marketingqualifiedlead', 'salesqualifiedlead', 'opportunity', 'customer', 'evangelist', 'other'];

// ── Status pill styles ─────────────────────────────────────────────────────
export type PillStyle = { background: string; color: string; border: string };
export const STATUS_STYLES: Record<string, PillStyle> = {
  prospect:  { background: tokens.colorPaletteDarkOrangeBackground1, color: tokens.colorPaletteDarkOrangeForeground2, border: tokens.colorPaletteDarkOrangeBorder1 },
  customer:  { background: tokens.colorPaletteGreenBackground1,      color: tokens.colorPaletteGreenForeground2,      border: tokens.colorPaletteGreenBorder1 },
  lead:      { background: tokens.colorPaletteYellowBackground1,     color: tokens.colorPaletteYellowForeground2,     border: tokens.colorPaletteYellowBorder1 },
  partner:   { background: tokens.colorPaletteLavenderBackground2,   color: tokens.colorPaletteLavenderForeground2,   border: tokens.colorPaletteLavenderBorderActive },
  other:     { background: tokens.colorPaletteRedBackground1,        color: tokens.colorPaletteRedForeground2,        border: tokens.colorPaletteRedBorder1 },
};

export function getStatusKey(type: string): string {
  const v = (type || '').toLowerCase();
  if (v.includes('customer') || v.includes('evangelist')) return 'customer';
  if (v.includes('lead') || v.includes('subscriber') || v.includes('qualified')) return 'lead';
  if (v.includes('partner') || v.includes('reseller')) return 'partner';
  if (v.includes('prospect') || v.includes('opportunity')) return 'prospect';
  return 'other';
}

// Prettify raw enum values for display. Guarded so it only transforms
// ALL_CAPS / snake_case tokens (e.g. NOT_STARTED -> "Not Started",
// INBOUND -> "Inbound"); already-friendly values (e.g. "pending",
// "salesqualifiedlead") are returned unchanged to avoid regressions.
export function prettyEnum(v: string): string {
  if (!v) return v;
  if (!v.includes('_') && v !== v.toUpperCase()) return v;
  return v.split(/[_\s]+/).map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w)).join(' ');
}

// Convert a stored HubSpot date/datetime value (ISO 8601 string or epoch ms)
// into the string an <input type="date"> ("yyyy-MM-dd") or
// type="datetime-local" ("yyyy-MM-ddThh:mm") expects. Without this the input
// can't parse a full ISO datetime and renders an empty mm/dd/yyyy placeholder.
// Idempotent: an already-formatted value passes straight through.
export function toDateInput(value: string, inputType?: string): string {
  if (!value) return '';
  if (inputType !== 'date' && inputType !== 'datetime-local') return value;
  const s = String(value);
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  let d: Date;
  if (iso) {
    if (inputType === 'date') return iso[1];
    if (iso[2]) return `${iso[1]}T${iso[2]}`;
    d = new Date(s);
  } else if (/^\d+$/.test(s)) {
    d = new Date(Number(s)); // epoch ms
  } else {
    d = new Date(s);
  }
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  // Date-only fields are stored at midnight UTC — read in UTC to avoid a tz
  // day-shift. datetime-local (e.g. meeting times) must display in LOCAL time.
  if (inputType === 'date') {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Form field definitions ─────────────────────────────────────────────────
export const COMPANY_FORM_FIELDS = [
  { label: 'Company Name *', key: 'name' },
  { label: 'Domain', key: 'domain' },
  { label: 'Type', key: 'type', type: 'select' as const, options: HS_TYPES },
  { label: 'Lifecycle Stage', key: 'lifecyclestage', type: 'select' as const, options: HS_LIFECYCLESTAGES },
  { label: 'Phone', key: 'phone' },
  { label: 'City', key: 'city' },
  { label: 'Country', key: 'country' },
];
