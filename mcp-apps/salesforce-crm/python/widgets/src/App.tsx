import React, { useState, useEffect } from 'react';
import {
  Badge, Button, Field, Input, Spinner,
  Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow,
  Text, makeStyles, tokens,
} from '@fluentui/react-components';
import { AddRegular, EditRegular, PeopleRegular, ChatRegular, BuildingRegular, PersonRegular, MoneyRegular, DocumentRegular, CheckmarkRegular, ChevronRightRegular, ChevronDownRegular, ArrowSyncRegular } from '@fluentui/react-icons';
import { useToolData, useMcpBridge, useTheme, ExpandButton, useToast, FkHint } from '@gtc/mcp-shared';
import type {
  SfData, SfListData, SalesDashboardData,
} from './types';

// ── Global row hover styles ────────────────────────────────────────────────────
const GLOBAL_STYLES = `
.slds-row:hover { background: var(--colorBrandBackgroundHover); }
[data-theme="dark"] .slds-row:hover { background: var(--colorBrandBackgroundHover); }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
if (typeof document !== 'undefined' && !document.getElementById('sf-row-hover-styles')) {
  const style = document.createElement('style');
  style.id = 'sf-row-hover-styles';
  style.textContent = GLOBAL_STYLES;
  document.head.appendChild(style);
}

// ── Fluent v9 token shim ────────────────────────────────────────────────────
// FluentProvider already drives light/dark via the host's theme context.
// `slds(theme)` is kept as a thin alias mapping into Fluent tokens so that
// every existing call site continues to work without further edits.
function slds(_theme: 'light' | 'dark') {
  return {
    brand:        tokens.colorBrandBackground,
    brandHover:   tokens.colorBrandBackgroundHover,
    accent:       tokens.colorBrandForegroundLink,
    background:   tokens.colorNeutralBackground2,
    surface:      tokens.colorNeutralBackground1,
    text:         tokens.colorNeutralForeground1,
    textWeak:     tokens.colorNeutralForeground3,
    border:       tokens.colorNeutralStroke2,
    headerBg:     tokens.colorNeutralBackground3,
    success:      tokens.colorPaletteGreenForeground1,
    danger:       tokens.colorPaletteRedForeground1,
    warn:         tokens.colorPaletteDarkOrangeForeground1,
  };
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 5)  return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

// ── Constants ──────────────────────────────────────────────────────────────
const LEAD_STATUSES = ['Open - Not Contacted', 'Working - Contacted', 'Closed - Converted', 'Closed - Not Converted'];
const LEAD_SOURCES  = ['Web', 'Phone Inquiry', 'Partner Referral', 'External Referral', 'Partner', 'Public Relations', 'Trade Show', 'Word of Mouth', 'Employee Referral', 'Purchased List', 'Other'];
const OPP_STAGES    = ['Prospecting', 'Qualification', 'Needs Analysis', 'Proposal/Price Quote', 'Negotiation/Review', 'Closed Won', 'Closed Lost'];
const CASE_STATUSES = ['New', 'Working', 'Escalated', 'Closed'];
const CASE_PRIOS    = ['High', 'Medium', 'Low'];
const TASK_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Waiting on someone else', 'Deferred'];
const TASK_PRIOS    = ['Low', 'Normal', 'High'];
const ACCT_INDUSTRIES = ['Agriculture', 'Apparel', 'Banking', 'Biotechnology', 'Chemicals', 'Communications', 'Construction', 'Consulting', 'Education', 'Electronics', 'Energy', 'Engineering', 'Entertainment', 'Environmental', 'Finance', 'Food & Beverage', 'Government', 'Healthcare', 'Hospitality', 'Insurance', 'Machinery', 'Manufacturing', 'Media', 'Not For Profit', 'Other', 'Recreation', 'Retail', 'Shipping', 'Technology', 'Telecommunications', 'Transportation', 'Utilities'];
const ACCT_TYPES    = ['Prospect', 'Customer - Direct', 'Customer - Channel', 'Channel Partner / Reseller', 'Installation Partner', 'Technology Partner', 'Other'];
const CAMPAIGN_STATUSES = ['Planned', 'In Progress', 'Completed', 'Aborted'];
const CAMPAIGN_TYPES    = ['Advertising', 'Direct Mail', 'Email', 'Telemarketing', 'Banner Ads', 'Seminar/Conference', 'Public Relations', 'Partners', 'Referral Program', 'Other'];

// ── Status pill styles ─────────────────────────────────────────────────────
// Fluent v9 semantic palette tokens with light/dark auto-swap via FluentProvider.
type PillStyle = { background: string; color: string; border: string };
const STATUS_STYLES: Record<string, PillStyle> = {
  open:      { background: tokens.colorPaletteRedBackground1,          color: tokens.colorPaletteRedForeground2,          border: tokens.colorPaletteRedBorder1 },
  contacted: { background: tokens.colorPaletteDarkOrangeBackground1,    color: tokens.colorPaletteDarkOrangeForeground2,    border: tokens.colorPaletteDarkOrangeBorder1 },
  qualified: { background: tokens.colorPaletteGreenBackground1,         color: tokens.colorPaletteGreenForeground2,         border: tokens.colorPaletteGreenBorder1 },
  closed:    { background: tokens.colorPaletteRedBackground1,           color: tokens.colorPaletteRedForeground2,           border: tokens.colorPaletteRedBorder1 },
  warn:      { background: tokens.colorPaletteDarkOrangeBackground1,    color: tokens.colorPaletteDarkOrangeForeground2,    border: tokens.colorPaletteDarkOrangeBorder1 },
};
function getStatusKey(s: string): string {
  const v = s.toLowerCase();
  if (v.includes('not converted') || v.includes('lost') || v.includes('closed') || v.includes('aborted')) return 'closed';
  if (v.includes('converted') || v.includes('won') || v.includes('qualified') || v.includes('completed')) return 'qualified';
  if (v.includes('working') || v.includes('contacted') || v.includes('needs') || v.includes('proposal') || v.includes('negotiation') || v.includes('escalated') || v.includes('active') || v.includes('in progress')) return 'contacted';
  if (v.includes('high') || v.includes('critical')) return 'warn';
  return 'open';
}
function fmt$(v: number | null | undefined) { return v == null ? '—' : '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
function fmtDate(v?: string | null) { return v ? v.slice(0, 10) : '—'; }

// ── Styles ─────────────────────────────────────────────────────────────────
const useStyles = makeStyles({
  shell:      { margin: '0 auto', padding: '16px', fontFamily: tokens.fontFamilyBase, fontSize: '13px', color: tokens.colorNeutralForeground1 },
  card:       { borderRadius: '6px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', overflowX: 'auto' as const, border: `1px solid ${tokens.colorNeutralStroke2}` },
  headerBar:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  formPanel:  { padding: '16px', borderLeft: `4px solid ${tokens.colorBrandBackground}` },
  formTitle:  { fontSize: '15px', fontWeight: 700 as any, marginBottom: '12px', color: tokens.colorNeutralForeground1 },
  formGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px 16px', marginBottom: '16px' },
  formActions:{ display: 'flex', gap: '12px', justifyContent: 'flex-end' },
  amount:     { fontWeight: 600 as any, fontVariantNumeric: 'tabular-nums', color: tokens.colorNeutralForeground1 },
  empty:      { padding: '20px', textAlign: 'center' as const, fontSize: '13px', color: tokens.colorNeutralForeground2 },
  mcpFooter:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', fontSize: '12px', color: tokens.colorNeutralForeground3 },
  childTable: { padding: '0 24px 12px', background: 'transparent' },
  kpiGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px', padding: '16px' },
  kpiCard:    { borderRadius: '6px', padding: '16px', textAlign: 'center' as const, border: `1px solid ${tokens.colorNeutralStroke2}` },
});

const H_CELL: React.CSSProperties = { fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '8px 12px', color: tokens.colorNeutralForeground3 };
const D_CELL: React.CSSProperties = { padding: '8px 12px', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px', verticalAlign: 'middle', color: tokens.colorNeutralForeground1 };

// ── StatusPill ─────────────────────────────────────────────────────────────
function StatusPill({ status, theme: _theme }: { status: string; theme: 'light' | 'dark' }) {
  const key = getStatusKey(status);
  const s = STATUS_STYLES[key] || STATUS_STYLES.open;
  return (
    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, background: s.background, color: s.color, border: `1px solid ${s.border}` }}>
      {status || '—'}
    </span>
  );
}

// ── SldsFooter ─────────────────────────────────────────────────────────────
function SldsFooter({ theme }: { theme: 'light' | 'dark' }) {
  const styles = useStyles();
  const t = slds(theme);
  const { openExternal } = useMcpBridge();
  return (
    <div className={styles.mcpFooter} style={{ background: tokens.colorNeutralBackground3, borderTop: `1px solid ${t.border}`, color: t.textWeak }}>
      <span>⚡ <strong>MCP</strong> · Salesforce CRM</span>
      <div style={{ display: 'flex', gap: '12px' }}>
        <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => openExternal('https://login.salesforce.com')}>Open in Salesforce ↗</span>
        <span>⚓ GTC</span>
      </div>
    </div>
  );
}

// ── FormSelect ─────────────────────────────────────────────────────────────
function FormSelect({ label, value, options, onChange, theme }: { label: string; value: string; options: string[]; onChange: (v: string) => void; theme: 'light' | 'dark' }) {
  const t = slds(theme);
  return (
    <Field label={label} size="small">
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontSize: '13px', fontFamily: 'inherit', height: '28px' }}>
        <option value="">— Select —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  );
}

// ── ExpandToggle (row-level) ───────────────────────────────────────────────
function ExpandToggle({ expanded, onClick, theme }: { expanded: boolean; onClick: () => void; theme: 'light' | 'dark' }) {
  const t = slds(theme);
  return (
    <button onClick={onClick} title={expanded ? 'Collapse' : 'Expand'}
      style={{ width: '32px', height: '32px', border: `1px solid ${t.border}`, background: tokens.colorNeutralBackground2, cursor: 'pointer', color: t.brand, fontWeight: 600, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}>
      {expanded ? <ChevronDownRegular style={{ fontSize: '16px' }} /> : <ChevronRightRegular style={{ fontSize: '16px' }} />}
    </button>
  );
}

// ── SkeletonTable ──────────────────────────────────────────────────────────
function SkeletonTable() {
  return (
    <div style={{ padding: '16px' }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}.skel{height:14px;border-radius:4px;background:linear-gradient(90deg,#e8e8e8 25%,#f5f5f5 50%,#e8e8e8 75%);background-size:200% 100%;animation:shimmer 1.5s infinite}[data-theme="dark"] .skel{background:linear-gradient(90deg,#333 25%,#444 50%,#333 75%);background-size:200% 100%}`}</style>
      <div style={{ textAlign: 'center', padding: '8px 0 16px', fontSize: '13px', color: tokens.colorNeutralForeground3 }}>
        ⏳ Loading data…
      </div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div className="skel" style={{ width: '200px', height: '24px' }} />
        <div className="skel" style={{ width: '80px', height: '24px' }} />
      </div>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <div className="skel" style={{ width: '120px' }} />
          <div className="skel" style={{ width: '150px' }} />
          <div className="skel" style={{ width: '100px' }} />
          <div className="skel" style={{ width: '90px' }} />
        </div>
      ))}
    </div>
  );
}

// ── DashBar (horizontal bar for analytics) ────────────────────────────────
function DashBar({ label, value, max, color, theme }: { label: string; value: number; max: number; color: string; theme: 'light' | 'dark' }) {
  const t = slds(theme);
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: t.textWeak, marginBottom: '3px' }}>
        <span>{label}</span><span style={{ fontWeight: 600, color: t.text }}>{value.toLocaleString()}</span>
      </div>
      <div style={{ height: '12px', background: t.border, borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '6px', transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

// ── Shared header + table wrapper ──────────────────────────────────────────
function ViewHeader({ icon, title, count, brand, onNew, newLabel, theme, cacheInfo, onRefresh, refreshing }: {
  icon: React.ReactNode; title: string; count: number; brand: string;
  onNew?: () => void; newLabel?: string; theme: 'light' | 'dark';
  cacheInfo?: { hit: boolean; cached_at: string };
  onRefresh?: () => void; refreshing?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: tokens.colorBrandBackground, flexWrap: 'wrap', rowGap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{title}</span>
        <Badge appearance="filled" size="small" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: '10px' }}>
          {count} record{count !== 1 ? 's' : ''}
        </Badge>
        {cacheInfo && (
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {cacheInfo.hit ? `cached ${timeAgo(cacheInfo.cached_at)}` : `live ${timeAgo(cacheInfo.cached_at)}`}
            {onRefresh && (
              <button onClick={onRefresh} disabled={refreshing}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.9)', cursor: refreshing ? 'wait' : 'pointer', padding: '0 4px', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                title="Force refresh from Salesforce">
                {refreshing ? <ArrowSyncRegular style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }} /> : <ArrowSyncRegular style={{ fontSize: '16px' }} />}
              </button>
            )}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {onNew && (
          <Button appearance="primary" size="small" icon={<AddRegular />} onClick={onNew}
            style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)', color: '#fff', borderRadius: '4px', height: '32px', padding: '0 16px' }}>
            {newLabel || '+ New'}
          </Button>
        )}
        <ExpandButton />
      </div>
    </div>
  );
}

// ── Inline form row ────────────────────────────────────────────────────────
// FkHint imported from @gtc/mcp-shared (commit promoting it from per-LOB to
// shared, 2026-05-29). Pass systemName="Salesforce" so the wording reflects
// this LOB. See Project-Theory/lob-mcp-apps/fk-alert-pattern-playbook.md §7a.

function InlineFormRow({ colSpan, title, titleColor, fields, onSave, onCancel, saving, theme }: {
  colSpan: number; title: string; titleColor?: string;
  fields: { label: string; key: string; value: string; onChange: (v: string) => void; type?: 'select'; options?: string[]; inputType?: string; readonly?: boolean }[];
  onSave: () => void; onCancel: () => void; saving: boolean; theme: 'light' | 'dark';
}) {
  const t = slds(theme);
  const formBg = tokens.colorNeutralBackground3;
  const accent = titleColor || t.brand;
  return (
    <TableRow>
      <TableCell colSpan={colSpan} style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderLeft: `3px solid ${accent}`, background: formBg }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: accent, marginBottom: '10px' }}>{title}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px 12px', marginBottom: '12px' }}>
            {fields.map(f =>
              f.readonly ? (
                <Field key={f.key} label={f.label} size="small">
                  <Input size="small" value={f.value || '—'} disabled style={{ color: t.textWeak }} />
                </Field>
              ) : f.type === 'select' ? (
                <FormSelect key={f.key} label={f.label} value={f.value} options={f.options || []} onChange={f.onChange} theme={theme} />
              ) : (
                <Field key={f.key} label={f.label} size="small">
                  <Input size="small" type={f.inputType || 'text'} value={f.value} onChange={(_, d) => f.onChange(d.value)} />
                </Field>
              )
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button appearance="secondary" size="small" onClick={onCancel} disabled={saving}
              style={{ borderRadius: '4px', height: '32px', padding: '0 16px', border: `1px solid ${t.border}` }}>Cancel</Button>
            <Button appearance="primary" size="small" onClick={onSave} disabled={saving}
              style={{ background: accent, borderColor: accent, borderRadius: '4px', height: '32px', padding: '0 16px' }}>
              {saving ? 'Saving…' : title.includes('Edit') ? '✓ Save' : '✓ Create'}
            </Button>
          </div>
          <FkHint fields={fields} systemName="Salesforce" />
        </div>
      </TableCell>
    </TableRow>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ── AccountsView ───────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
function AccountsView({ items: initItems, callTool, toast, theme, cacheInfo: initCacheInfo }: { items: any[]; callTool: (n: string, a?: any) => Promise<any>; toast: (m: string, t?: any) => void; theme: 'light' | 'dark'; cacheInfo?: { hit: boolean; cached_at: string } }) {
  const styles = useStyles();
  const t = slds(theme);
  const [localItems, setLocalItems] = useState(initItems);
  const [cacheInfo, setCacheInfo] = useState(initCacheInfo);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [childContacts, setChildContacts] = useState<Record<string, any[]>>({});
  const [childOpps, setChildOpps] = useState<Record<string, any[]>>({});
  const [childCases, setChildCases] = useState<Record<string, any[]>>({});
  const [loadingChildren, setLoadingChildren] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: '', industry: '', phone: '', website: '', type: '', billing_city: '' });

  useEffect(() => { setLocalItems(initItems); setCacheInfo(initCacheInfo); }, [initItems]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await callTool('sf__get_accounts', { refresh: true });
      setLocalItems(res?.items || []);
      setCacheInfo(res?._cache);
    } catch (e: any) { toast(e.message || 'Refresh failed', 'error'); }
    finally { setRefreshing(false); }
  };

  const openEdit = (a: any) => { setCreating(false); setEditingId(a.id); setForm({ name: a.name || '', industry: a.industry || '', phone: a.phone || '', website: a.website || '', type: a.type || '', billing_city: a.billing_city || '' }); };
  const openCreate = () => { setEditingId(null); setCreating(true); setForm({ name: '', industry: '', phone: '', website: '', type: '', billing_city: '' }); };
  const cancel = () => { setEditingId(null); setCreating(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (creating) { await callTool('sf__create_account', form); toast('✓ Account created'); }
      else { await callTool('sf__update_account', { account_id: editingId, ...form }); toast('✓ Account updated'); setLastSavedId(editingId); }
      cancel();
      const refreshed = await callTool('sf__get_accounts', { refresh: true });
      if (refreshed?.items) { setLocalItems(refreshed.items); setCacheInfo(refreshed._cache); }
    } catch (e: any) { toast(e.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  useEffect(() => { if (lastSavedId) { const x = setTimeout(() => setLastSavedId(null), 4800); return () => clearTimeout(x); } }, [lastSavedId]);

  const toggleExpand = async (id: string) => {
    if (expandedIds.has(id)) { setExpandedIds(p => { const n = new Set(p); n.delete(id); return n; }); return; }
    setExpandedIds(p => new Set([...p, id]));
    if (childContacts[id] !== undefined && childOpps[id] !== undefined && childCases[id] !== undefined) return;
    setLoadingChildren(p => new Set([...p, id]));
    try {
      const [rc, ro, rca] = await Promise.all([
        childContacts[id] !== undefined ? null : callTool('sf__get_contacts', { account_id: id }).catch(() => null),
        childOpps[id]     !== undefined ? null : callTool('sf__get_opportunities', { account_id: id }).catch(() => null),
        childCases[id]    !== undefined ? null : callTool('sf__get_cases', { account_id: id }).catch(() => null),
      ]);
      setChildContacts(p => ({ ...p, [id]: rc?.items  ?? p[id] ?? [] }));
      setChildOpps(p =>     ({ ...p, [id]: ro?.items  ?? p[id] ?? [] }));
      setChildCases(p =>    ({ ...p, [id]: rca?.items ?? p[id] ?? [] }));
    } finally { setLoadingChildren(p => { const n = new Set(p); n.delete(id); return n; }); }
  };

  const fFields = (f: typeof form, set: (k: string, v: string) => void) => [
    { label: 'Account Name *', key: 'name', value: f.name, onChange: (v: string) => set('name', v) },
    { label: 'Industry', key: 'industry', value: f.industry, onChange: (v: string) => set('industry', v), type: 'select' as const, options: ACCT_INDUSTRIES },
    { label: 'Phone', key: 'phone', value: f.phone, onChange: (v: string) => set('phone', v) },
    { label: 'Website', key: 'website', value: f.website, onChange: (v: string) => set('website', v) },
    { label: 'Type', key: 'type', value: f.type, onChange: (v: string) => set('type', v), type: 'select' as const, options: ACCT_TYPES },
    { label: 'City', key: 'billing_city', value: f.billing_city, onChange: (v: string) => set('billing_city', v) },
  ];
  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}` }}>
      <ViewHeader icon={<BuildingRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Accounts" count={localItems.length} brand={tokens.colorPalettePinkForeground2} theme={theme} cacheInfo={cacheInfo} onRefresh={handleRefresh} refreshing={refreshing} />
      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            <TableHeaderCell style={{ ...H_CELL, width: 28, color: t.textWeak }} />
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak }}>Account Name</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak }}>Industry</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak }}>City</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak }}>Phone</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak }}>Type</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, width: 32, color: t.textWeak }} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {creating && <InlineFormRow colSpan={7} title="➕ New Account" titleColor={tokens.colorPalettePinkForeground2} fields={fFields(form, setF)} onSave={handleSave} onCancel={cancel} saving={saving} theme={theme} />}
          {localItems.length === 0 && !creating && <TableRow><TableCell colSpan={7} className={styles.empty}><Text>No accounts found.</Text></TableCell></TableRow>}
          {localItems.map((a, idx) => (
            <React.Fragment key={a.id}>
              <TableRow style={{ borderBottom: `1px solid ${t.border}`, ...(lastSavedId === a.id ? { animation: 'sfRowFlash 4.5s ease-out' } : {}) }} className="slds-row">
                <TableCell style={{ ...D_CELL, width: 28 }}>
                  <ExpandToggle expanded={expandedIds.has(a.id)} onClick={() => toggleExpand(a.id)} theme={theme} />
                </TableCell>
                <TableCell style={D_CELL}><span style={{ fontWeight: 500, color: t.brand }}>{a.name}</span></TableCell>
                <TableCell style={D_CELL}>{a.industry || '—'}</TableCell>
                <TableCell style={D_CELL}>{a.billing_city || '—'}</TableCell>
                <TableCell style={D_CELL}>{a.phone || '—'}</TableCell>
                <TableCell style={D_CELL}>{a.type || '—'}</TableCell>
                <TableCell style={D_CELL}><button title="Edit" onClick={() => openEdit(a)} className="slds-edit-btn" style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.border}`, borderRadius: '4px', background: 'transparent', cursor: 'pointer', color: t.textWeak, fontSize: '14px', padding: 0 }}><EditRegular style={{ fontSize: "16px" }} /></button></TableCell>
              </TableRow>
              {editingId === a.id && <InlineFormRow colSpan={7} title="Edit Account" titleColor={tokens.colorPalettePinkForeground2} fields={fFields(form, setF)} onSave={handleSave} onCancel={cancel} saving={saving} theme={theme} />}
              {expandedIds.has(a.id) && (
                <TableRow>
                  <TableCell colSpan={7} style={{ padding: 0, background: tokens.colorNeutralBackground2 }}>
                    {loadingChildren.has(a.id) ? <div style={{ padding: '12px 28px' }}><Spinner size="tiny" label="Loading…" /></div> : (
                      <div style={{ padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {/* Contacts */}
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textWeak, marginBottom: '6px', paddingBottom: '4px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>👥 Contacts</span>
                            <span style={{ fontWeight: 400, fontSize: '10px' }}>({(childContacts[a.id] || []).length})</span>
                          </div>
                          {(childContacts[a.id] || []).length === 0
                            ? <div style={{ color: t.textWeak, fontSize: '12px', padding: '2px 0' }}>No contacts</div>
                            : <>
                                <div style={{ display: 'grid', gridTemplateColumns: '160px 130px 1fr 110px', gap: '8px', padding: '4px 0', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textWeak, borderBottom: `1px solid ${t.border}` }}>
                                  <span>Name</span>
                                  <span>Title</span>
                                  <span>Email</span>
                                  <span>Phone</span>
                                </div>
                                {(childContacts[a.id] || []).map((c: any) => (
                                  <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '160px 130px 1fr 110px', gap: '8px', padding: '5px 0', borderBottom: `1px solid ${t.border}`, fontSize: '12px', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 500, color: t.text }}>{c.first_name} {c.last_name}</span>
                                    <span style={{ color: t.textWeak }}>{c.title || '—'}</span>
                                    <span style={{ color: t.brand }}>{c.email || '—'}</span>
                                    <span style={{ color: t.textWeak }}>{c.phone || '—'}</span>
                                  </div>
                                ))}
                              </>}
                        </div>
                        {/* Opportunities */}
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textWeak, marginBottom: '6px', paddingBottom: '4px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>💰 Opportunities</span>
                            <span style={{ fontWeight: 400, fontSize: '10px' }}>({(childOpps[a.id] || []).length})</span>
                          </div>
                          {(childOpps[a.id] || []).length === 0
                            ? <div style={{ color: t.textWeak, fontSize: '12px', padding: '2px 0' }}>No opportunities</div>
                            : <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 90px 100px', gap: '8px', padding: '4px 0', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textWeak, borderBottom: `1px solid ${t.border}` }}>
                                  <span>Name</span>
                                  <span>Stage</span>
                                  <span>Amount</span>
                                  <span>Close Date</span>
                                </div>
                                {(childOpps[a.id] || []).map((o: any) => (
                                  <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 90px 100px', gap: '8px', padding: '5px 0', borderBottom: `1px solid ${t.border}`, fontSize: '12px', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 500, color: t.text }}>{o.name}</span>
                                    <StatusPill status={o.stage || '—'} theme={theme} />
                                    <span style={{ fontWeight: 600, color: t.brand }}>{fmt$(o.amount)}</span>
                                    <span style={{ color: t.textWeak }}>{o.close_date || '—'}</span>
                                  </div>
                                ))}
                              </>}
                        </div>
                        {/* Cases */}
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textWeak, marginBottom: '6px', paddingBottom: '4px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>🎫 Cases</span>
                            <span style={{ fontWeight: 400, fontSize: '10px' }}>({(childCases[a.id] || []).length})</span>
                          </div>
                          {(childCases[a.id] || []).length === 0
                            ? <div style={{ color: t.textWeak, fontSize: '12px', padding: '2px 0' }}>No cases</div>
                            : <>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px', gap: '8px', padding: '4px 0', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textWeak, borderBottom: `1px solid ${t.border}` }}>
                                  <span>Subject</span>
                                  <span>Status</span>
                                  <span>Priority</span>
                                  <span>Case #</span>
                                </div>
                                {(childCases[a.id] || []).map((c: any) => (
                                  <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px', gap: '8px', padding: '5px 0', borderBottom: `1px solid ${t.border}`, fontSize: '12px', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 500, color: t.text }}>{c.subject}</span>
                                    <StatusPill status={c.status} theme={theme} />
                                    <StatusPill status={c.priority} theme={theme} />
                                    <span style={{ color: t.textWeak, fontSize: '11px' }}>{c.case_number || c.id?.slice(-6) || '—'}</span>
                                  </div>
                                ))}
                              </>}
                        </div>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
      <SldsFooter theme={theme} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ── LeadsView ──────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
function LeadsView({ items: initItems, callTool, toast, theme, cacheInfo: initCacheInfo }: { items: any[]; callTool: (n: string, a?: any) => Promise<any>; toast: (m: string, t?: any) => void; theme: 'light' | 'dark'; cacheInfo?: { hit: boolean; cached_at: string } }) {
  const styles = useStyles();
  const t = slds(theme);
  const [localItems, setLocalItems] = useState(initItems);
  const [cacheInfo, setCacheInfo] = useState(initCacheInfo);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertedToOpp, setConvertedToOpp] = useState<any | null>(null);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', company: '', email: '', phone: '', status: '', lead_source: '' });

  useEffect(() => { setLocalItems(initItems); setCacheInfo(initCacheInfo); }, [initItems]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await callTool('sf__get_leads', { refresh: true });
      setLocalItems(res?.items || []);
      setCacheInfo(res?._cache);
    } catch (e: any) { toast(e.message || 'Refresh failed', 'error'); }
    finally { setRefreshing(false); }
  };

  const openEdit = (l: any) => { setCreating(false); setEditingId(l.id); setForm({ first_name: l.first_name || '', last_name: l.last_name || '', company: l.company || '', email: l.email || '', phone: l.phone || '', status: l.status || '', lead_source: l.lead_source || '' }); };
  const openCreate = () => { setEditingId(null); setCreating(true); setForm({ first_name: '', last_name: '', company: '', email: '', phone: '', status: '', lead_source: '' }); };
  const cancel = () => { setEditingId(null); setCreating(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (creating) { await callTool('sf__create_lead', form); toast('✓ Lead created'); }
      else { await callTool('sf__update_lead', { lead_id: editingId, ...form }); toast('✓ Lead updated'); setLastSavedId(editingId); }
      cancel();
      const refreshed = await callTool('sf__get_leads', { refresh: true });
      if (refreshed?.items) { setLocalItems(refreshed.items); setCacheInfo(refreshed._cache); }
    } catch (e: any) { toast(e.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleConvert = async (leadId: string) => {
    setConvertingId(leadId);
    try {
      const res = await callTool('sf__convert_lead', { lead_id: leadId });
      if (res?.type === 'opportunities' && Array.isArray(res?.items) && res.items.length > 0) {
        toast('✓ Lead converted — showing new opportunity');
        setConvertedToOpp(res);
      } else {
        // do_not_create_opportunity path or unexpected shape — refresh leads
        toast('✓ Lead converted (no opportunity created)');
        const refreshed = await callTool('sf__get_leads', { refresh: true });
        setLocalItems(refreshed?.items || []);
        setCacheInfo(refreshed?._cache);
      }
    } catch (e: any) {
      toast(e?.message || 'Convert failed', 'error');
    } finally {
      setConvertingId(null);
    }
  };

  useEffect(() => { if (lastSavedId) { const x = setTimeout(() => setLastSavedId(null), 4800); return () => clearTimeout(x); } }, [lastSavedId]);

  const fFields = (f: typeof form, set: (k: string, v: string) => void) => [
    { label: 'First Name', key: 'first_name', value: f.first_name, onChange: (v: string) => set('first_name', v) },
    { label: 'Last Name *', key: 'last_name', value: f.last_name, onChange: (v: string) => set('last_name', v) },
    { label: 'Company *', key: 'company', value: f.company, onChange: (v: string) => set('company', v) },
    { label: 'Email', key: 'email', value: f.email, onChange: (v: string) => set('email', v), inputType: 'email' },
    { label: 'Phone', key: 'phone', value: f.phone, onChange: (v: string) => set('phone', v) },
    { label: 'Status', key: 'status', value: f.status, onChange: (v: string) => set('status', v), type: 'select' as const, options: LEAD_STATUSES },
    { label: 'Lead Source', key: 'lead_source', value: f.lead_source, onChange: (v: string) => set('lead_source', v), type: 'select' as const, options: LEAD_SOURCES },
  ];
  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  // After a successful convert, swap to the new Opportunity widget.
  if (convertedToOpp) {
    return (
      <OpportunitiesView
        items={convertedToOpp.items || []}
        callTool={callTool}
        toast={toast}
        theme={theme}
        cacheInfo={convertedToOpp._cache}
      />
    );
  }

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}` }}>
      <ViewHeader icon={<PeopleRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Leads" count={localItems.length} brand={tokens.colorPaletteLavenderForeground2} theme={theme} cacheInfo={cacheInfo} onRefresh={handleRefresh} refreshing={refreshing} />
      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            {['Name', 'Company', 'Status', 'Source', 'Email', ''].map(h => <TableHeaderCell key={h} style={{ ...H_CELL, color: t.textWeak }}>{h}</TableHeaderCell>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {creating && <InlineFormRow colSpan={6} title="New Lead" titleColor={tokens.colorPaletteLavenderForeground2} fields={fFields(form, setF)} onSave={handleSave} onCancel={cancel} saving={saving} theme={theme} />}
          {localItems.length === 0 && !creating && <TableRow><TableCell colSpan={6} className={styles.empty}><Text>No leads found.</Text></TableCell></TableRow>}
          {localItems.map((l: any) => (
            <React.Fragment key={l.id}>
              <TableRow style={{ borderBottom: `1px solid ${t.border}`, ...(lastSavedId === l.id ? { animation: 'sfRowFlash 4.5s ease-out' } : {}) }} className="slds-row">
                <TableCell style={D_CELL}>{l.first_name} {l.last_name}</TableCell>
                <TableCell style={D_CELL}>{l.company || '—'}</TableCell>
                <TableCell style={{ ...D_CELL, maxWidth: 90 }}><StatusPill status={(l.status || '').split(' - ').pop() || l.status} theme={theme} /></TableCell>
                <TableCell style={D_CELL}>{l.lead_source || '—'}</TableCell>
                <TableCell style={D_CELL}>{l.email || '—'}</TableCell>
                <TableCell style={{ ...D_CELL, width: 110 }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button title="Edit" onClick={() => openEdit(l)} className="slds-edit-btn" style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.border}`, borderRadius: '4px', background: 'transparent', cursor: 'pointer', color: t.textWeak, fontSize: '14px', padding: 0 }}><EditRegular style={{ fontSize: "16px" }} /></button>
                    <button title="Convert Lead (creates Account + Contact + Opportunity)"
                      onClick={() => handleConvert(l.id)}
                      disabled={convertingId === l.id || l.is_converted}
                      style={{ height: '28px', padding: '0 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.border}`, borderRadius: '4px', background: 'transparent', cursor: convertingId === l.id ? 'wait' : (l.is_converted ? 'not-allowed' : 'pointer'), color: l.is_converted ? t.textWeak : t.success, fontSize: '11px', fontWeight: 600, opacity: l.is_converted ? 0.5 : 1 }}>
                      {convertingId === l.id ? '…' : (l.is_converted ? '✓ Converted' : 'Convert')}
                    </button>
                  </div>
                </TableCell>
              </TableRow>
              {editingId === l.id && <InlineFormRow colSpan={6} title="Edit Lead" titleColor={tokens.colorPaletteLavenderForeground2} fields={fFields(form, setF)} onSave={handleSave} onCancel={cancel} saving={saving} theme={theme} />}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
      <SldsFooter theme={theme} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ── ContactsView ───────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
function ContactsView({ items: initItems, callTool, toast, theme, cacheInfo: initCacheInfo }: { items: any[]; callTool: (n: string, a?: any) => Promise<any>; toast: (m: string, t?: any) => void; theme: 'light' | 'dark'; cacheInfo?: { hit: boolean; cached_at: string } }) {
  const styles = useStyles();
  const t = slds(theme);
  const [localItems, setLocalItems] = useState(initItems);
  const [cacheInfo, setCacheInfo] = useState(initCacheInfo);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [childOpps, setChildOpps] = useState<Record<string, any[]>>({});
  const [loadingChild, setLoadingChild] = useState<string | null>(null);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', title: '', account_name: '' });

  useEffect(() => { setLocalItems(initItems); setCacheInfo(initCacheInfo); }, [initItems]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await callTool('sf__get_contacts', { refresh: true });
      setLocalItems(res?.items || []);
      setCacheInfo(res?._cache);
    } catch (e: any) { toast(e.message || 'Refresh failed', 'error'); }
    finally { setRefreshing(false); }
  };

  const openEdit = (c: any) => { setCreating(false); setEditingId(c.id); setForm({ first_name: c.first_name || '', last_name: c.last_name || '', email: c.email || '', phone: c.phone || '', title: c.title || '', account_name: c.account_name || '' }); };
  const openCreate = () => { setEditingId(null); setCreating(true); setForm({ first_name: '', last_name: '', email: '', phone: '', title: '', account_name: '' }); };
  const cancel = () => { setEditingId(null); setCreating(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res: any = creating
        ? await callTool('sf__create_contact', form)
        : await callTool('sf__update_contact', { contact_id: editingId, ...form });

      if (res && res.type === 'alert') {
        toast(res.message || 'Cannot complete — please correct and retry.', 'info', 0);
        return;
      }
      toast(creating ? '✓ Contact created' : '✓ Contact updated');
      if (!creating) setLastSavedId(editingId);
      cancel();
      const refreshed = await callTool('sf__get_contacts', { refresh: true });
      if (refreshed?.items) { setLocalItems(refreshed.items); setCacheInfo(refreshed._cache); }
    } catch (e: any) { toast(e.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  useEffect(() => { if (lastSavedId) { const x = setTimeout(() => setLastSavedId(null), 4800); return () => clearTimeout(x); } }, [lastSavedId]);

  const toggleExpand = async (c: any) => {
    if (expandedId === c.id) { setExpandedId(null); return; }
    setExpandedId(c.id);
    if (childOpps[c.id] || !c.account_id) return;
    setLoadingChild(c.id);
    try { const res = await callTool('sf__get_opportunities', { account_id: c.account_id }); setChildOpps(p => ({ ...p, [c.id]: res?.items || [] })); }
    catch { setChildOpps(p => ({ ...p, [c.id]: [] })); }
    finally { setLoadingChild(null); }
  };

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const fFields = (f: typeof form, isEdit: boolean = false) => [
    { label: 'First Name', key: 'first_name', value: f.first_name, onChange: (v: string) => setF('first_name', v) },
    { label: 'Last Name *', key: 'last_name', value: f.last_name, onChange: (v: string) => setF('last_name', v) },
    { label: 'Email', key: 'email', value: f.email, onChange: (v: string) => setF('email', v), inputType: 'email' },
    { label: 'Phone', key: 'phone', value: f.phone, onChange: (v: string) => setF('phone', v) },
    { label: 'Title', key: 'title', value: f.title, onChange: (v: string) => setF('title', v) },
    { label: 'Account (type full name) 🔗', key: 'account_name', value: f.account_name, onChange: (v: string) => setF('account_name', v), readonly: isEdit },
  ];

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}` }}>
      <ViewHeader icon={<PersonRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Contacts" count={localItems.length} brand={tokens.colorPaletteMagentaForeground2} theme={theme} cacheInfo={cacheInfo} onRefresh={handleRefresh} refreshing={refreshing} />
      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            <TableHeaderCell style={{ ...H_CELL, width: 28, color: t.textWeak }} />
            {['Name', 'Account', 'Title', 'Email', 'Phone', ''].map(h => <TableHeaderCell key={h} style={{ ...H_CELL, color: t.textWeak }}>{h}</TableHeaderCell>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {creating && <InlineFormRow colSpan={7} title="➕ New Contact" titleColor={tokens.colorPaletteMagentaForeground2} fields={fFields(form)} onSave={handleSave} onCancel={cancel} saving={saving} theme={theme} />}
          {localItems.length === 0 && !creating && <TableRow><TableCell colSpan={7} className={styles.empty}><Text>No contacts found.</Text></TableCell></TableRow>}
          {localItems.map((c: any) => (
            <React.Fragment key={c.id}>
              <TableRow style={{ borderBottom: `1px solid ${t.border}`, ...(lastSavedId === c.id ? { animation: 'sfRowFlash 4.5s ease-out' } : {}) }}>
                <TableCell style={{ ...D_CELL, width: 28 }}><ExpandToggle expanded={expandedId === c.id} onClick={() => toggleExpand(c)} theme={theme} /></TableCell>
                <TableCell style={D_CELL}>{c.first_name} {c.last_name}</TableCell>
                <TableCell style={D_CELL}>{c.account_name || '—'}</TableCell>
                <TableCell style={D_CELL}>{c.title || '—'}</TableCell>
                <TableCell style={D_CELL}>{c.email || '—'}</TableCell>
                <TableCell style={D_CELL}>{c.phone || '—'}</TableCell>
                <TableCell style={D_CELL}><button title="Edit" onClick={() => openEdit(c)} className="slds-edit-btn" style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.border}`, borderRadius: '4px', background: 'transparent', cursor: 'pointer', color: t.textWeak, fontSize: '14px', padding: 0 }}><EditRegular style={{ fontSize: "16px" }} /></button></TableCell>
              </TableRow>
              {editingId === c.id && <InlineFormRow colSpan={7} title="Edit Contact" titleColor={tokens.colorPaletteMagentaForeground2} fields={fFields(form, true)} onSave={handleSave} onCancel={cancel} saving={saving} theme={theme} />}
              {expandedId === c.id && (
                <TableRow>
                  <TableCell colSpan={7} style={{ padding: 0, background: tokens.colorNeutralBackground2 }}>
                    <div style={{ padding: '10px 16px 14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textWeak, marginBottom: '6px', paddingBottom: '4px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>💰 Opportunities</span>
                        <span style={{ fontWeight: 400, fontSize: '10px' }}>({(childOpps[c.id] || []).length})</span>
                      </div>
                      {loadingChild === c.id ? <Spinner size="tiny" label="Loading…" />
                        : !c.account_id ? <div style={{ color: t.textWeak, fontSize: '12px', padding: '2px 0' }}>No account linked.</div>
                        : (childOpps[c.id] || []).length === 0
                          ? <div style={{ color: t.textWeak, fontSize: '12px', padding: '2px 0' }}>No opportunities</div>
                          : <>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 90px 100px', gap: '8px', padding: '4px 0', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textWeak, borderBottom: `1px solid ${t.border}` }}>
                                <span>Name</span>
                                <span>Stage</span>
                                <span>Amount</span>
                                <span>Close Date</span>
                              </div>
                              {(childOpps[c.id] || []).map((o: any) => (
                                <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 90px 100px', gap: '8px', padding: '5px 0', borderBottom: `1px solid ${t.border}`, fontSize: '12px', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 500, color: t.text }}>{o.name}</span>
                                  <StatusPill status={o.stage || '—'} theme={theme} />
                                  <span style={{ fontWeight: 600, color: t.brand }}>{fmt$(o.amount)}</span>
                                  <span style={{ color: t.textWeak }}>{fmtDate(o.close_date)}</span>
                                </div>
                              ))}
                            </>}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
      <SldsFooter theme={theme} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ── OpportunitiesView ──────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
function OpportunitiesView({ items: initItems, callTool, toast, theme, cacheInfo: initCacheInfo }: { items: any[]; callTool: (n: string, a?: any) => Promise<any>; toast: (m: string, t?: any) => void; theme: 'light' | 'dark'; cacheInfo?: { hit: boolean; cached_at: string } }) {
  const styles = useStyles();
  const t = slds(theme);
  const [localItems, setLocalItems] = useState(initItems);
  const [cacheInfo, setCacheInfo] = useState(initCacheInfo);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [childProducts, setChildProducts] = useState<Record<string, any[]>>({});
  const [childRoles, setChildRoles] = useState<Record<string, any[]>>({});
  const [loadingChild, setLoadingChild] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', account_name: '', stage: '', amount: '', close_date: '', probability: '' });

  useEffect(() => { setLocalItems(initItems); setCacheInfo(initCacheInfo); }, [initItems]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await callTool('sf__get_opportunities', { refresh: true });
      setLocalItems(res?.items || []);
      setCacheInfo(res?._cache);
    } catch (e: any) { toast(e.message || 'Refresh failed', 'error'); }
    finally { setRefreshing(false); }
  };

  const openEdit = (o: any) => { setCreating(false); setEditingId(o.id); setForm({ name: o.name || '', account_name: o.account_name || '', stage: o.stage || '', amount: o.amount != null ? String(o.amount) : '', close_date: o.close_date || '', probability: o.probability != null ? String(o.probability) : '' }); };
  const openCreate = () => { setEditingId(null); setCreating(true); setForm({ name: '', account_name: '', stage: '', amount: '', close_date: '', probability: '' }); };
  const cancel = () => { setEditingId(null); setCreating(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Strip null for empty numeric fields — server signature has float/int
      // defaults; explicit null fails MCP client schema validation
      // (surfaced to the user as a "method not found"-shaped error).
      const args: Record<string, any> = { ...form };
      if (form.amount)      args.amount = parseFloat(form.amount);
      else                  delete args.amount;
      if (form.probability) args.probability = parseInt(form.probability);
      else                  delete args.probability;

      const res: any = creating
        ? await callTool('sf__create_opportunity', args)
        : await callTool('sf__update_opportunity', { opportunity_id: editingId, ...args });

      // Alert path — server returned a non-fatal FK lookup miss with
      // suggestions. Surface persistently and keep the form open so the
      // user can correct the account name and re-submit.
      if (res && res.type === 'alert') {
        toast(res.message || 'Cannot complete — please correct and retry.', 'info', 0);
        return;
      }
      toast(creating ? '✓ Opportunity created' : '✓ Opportunity updated');
      if (!creating) setLastSavedId(editingId);
      cancel();
      const refreshed = await callTool('sf__get_opportunities', { refresh: true });
      if (refreshed?.items) { setLocalItems(refreshed.items); setCacheInfo(refreshed._cache); }
    } catch (e: any) { toast(e.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  useEffect(() => { if (lastSavedId) { const x = setTimeout(() => setLastSavedId(null), 4800); return () => clearTimeout(x); } }, [lastSavedId]);

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const fFields = (f: typeof form, isEdit: boolean = false) => [
    { label: 'Opportunity Name *', key: 'name', value: f.name, onChange: (v: string) => setF('name', v) },
    { label: 'Account (type full name) 🔗', key: 'account_name', value: f.account_name, onChange: (v: string) => setF('account_name', v), readonly: isEdit },
    { label: 'Stage', key: 'stage', value: f.stage, onChange: (v: string) => setF('stage', v), type: 'select' as const, options: OPP_STAGES },
    { label: 'Amount ($)', key: 'amount', value: f.amount, onChange: (v: string) => setF('amount', v), inputType: 'number' },
    { label: 'Close Date', key: 'close_date', value: f.close_date, onChange: (v: string) => setF('close_date', v), inputType: 'date' },
    { label: 'Probability (%)', key: 'probability', value: f.probability, onChange: (v: string) => setF('probability', v), inputType: 'number' },
  ];

  const toggleExpand = async (o: any) => {
    if (expandedId === o.id) { setExpandedId(null); return; }
    setExpandedId(o.id);
    if (childProducts[o.id] && childRoles[o.id]) return;
    setLoadingChild(o.id);
    try {
      const [pr, cr] = await Promise.all([
        callTool('sf__get_opportunity_products',      { opportunity_id: o.id }).catch(() => null),
        callTool('sf__get_opportunity_contact_roles', { opportunity_id: o.id }).catch(() => null),
      ]);
      setChildProducts(p => ({ ...p, [o.id]: pr?.items || [] }));
      setChildRoles   (p => ({ ...p, [o.id]: cr?.items || [] }));
    } finally { setLoadingChild(null); }
  };

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}` }}>
      <ViewHeader icon={<MoneyRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Opportunities" count={localItems.length} brand={tokens.colorPaletteCornflowerForeground2} theme={theme} cacheInfo={cacheInfo} onRefresh={handleRefresh} refreshing={refreshing} />
      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            <TableHeaderCell style={{ ...H_CELL, width: 28, color: t.textWeak }} />
            {['Name', 'Account', 'Stage', 'Amount', 'Close Date', 'Prob %', ''].map(h => <TableHeaderCell key={h} style={{ ...H_CELL, color: t.textWeak }}>{h}</TableHeaderCell>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {creating && <InlineFormRow colSpan={8} title="➕ New Opportunity" titleColor={tokens.colorPaletteCornflowerForeground2} fields={fFields(form)} onSave={handleSave} onCancel={cancel} saving={saving} theme={theme} />}
          {localItems.length === 0 && !creating && <TableRow><TableCell colSpan={8} className={styles.empty}><Text>No opportunities found.</Text></TableCell></TableRow>}
          {localItems.map((o: any) => (
            <React.Fragment key={o.id}>
              <TableRow style={{ borderBottom: `1px solid ${t.border}`, ...(lastSavedId === o.id ? { animation: 'sfRowFlash 4.5s ease-out' } : {}) }} className="slds-row">
                <TableCell style={{ ...D_CELL, width: 28 }}><ExpandToggle expanded={expandedId === o.id} onClick={() => toggleExpand(o)} theme={theme} /></TableCell>
                <TableCell style={D_CELL}>{o.name}</TableCell>
                <TableCell style={D_CELL}>{o.account_name || '—'}</TableCell>
                <TableCell style={D_CELL}><StatusPill status={o.stage} theme={theme} /></TableCell>
                <TableCell style={{ ...D_CELL, fontWeight: 500 }}>{fmt$(o.amount)}</TableCell>
                <TableCell style={D_CELL}>{fmtDate(o.close_date)}</TableCell>
                <TableCell style={D_CELL}>{o.probability != null ? o.probability + '%' : '—'}</TableCell>
                <TableCell style={D_CELL}><button title="Edit" onClick={() => openEdit(o)} className="slds-edit-btn" style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.border}`, borderRadius: '4px', background: 'transparent', cursor: 'pointer', color: t.textWeak, fontSize: '14px', padding: 0 }}><EditRegular style={{ fontSize: "16px" }} /></button></TableCell>
              </TableRow>
              {editingId === o.id && <InlineFormRow colSpan={8} title="Edit Opportunity" titleColor={tokens.colorPaletteCornflowerForeground2} fields={fFields(form, true)} onSave={handleSave} onCancel={cancel} saving={saving} theme={theme} />}
              {expandedId === o.id && (
                <TableRow>
                  <TableCell colSpan={8} style={{ padding: 0, background: tokens.colorNeutralBackground2 }}>
                    <div style={{ padding: '8px 28px 12px' }}>
                      {loadingChild === o.id ? <Spinner size="tiny" label="Loading…" /> : (
                        <>
                          {/* Products */}
                          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textWeak, marginBottom: '6px' }}>
                            Products ({(childProducts[o.id] || []).length})
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '12px' }}>
                            <tbody>
                              {(childProducts[o.id] || []).length === 0
                                ? <tr><td style={{ color: t.textWeak, padding: '4px 0' }}>No products on this opportunity.</td></tr>
                                : (childProducts[o.id] || []).map((p: any) => (
                                    <tr key={p.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                                      <td style={D_CELL}>{p.name || '—'}</td>
                                      <td style={D_CELL}>{p.code || '—'}</td>
                                      <td style={{ ...D_CELL, textAlign: 'right' }}>{p.quantity != null ? `× ${p.quantity}` : '—'}</td>
                                      <td style={{ ...D_CELL, textAlign: 'right' }}>{fmt$(p.unit_price)}</td>
                                      <td style={{ ...D_CELL, textAlign: 'right', fontWeight: 500 }}>{fmt$(p.total_price)}</td>
                                    </tr>))}
                            </tbody>
                          </table>

                          {/* Contact Roles */}
                          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textWeak, marginBottom: '6px' }}>
                            Contact Roles ({(childRoles[o.id] || []).length})
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <tbody>
                              {(childRoles[o.id] || []).length === 0
                                ? <tr><td style={{ color: t.textWeak, padding: '4px 0' }}>No contact roles on this opportunity.</td></tr>
                                : (childRoles[o.id] || []).map((cr: any) => (
                                    <tr key={cr.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                                      <td style={D_CELL}>{(cr.first_name || '') + ' ' + (cr.last_name || '')}{cr.is_primary ? <Badge appearance="tint" size="small" color="brand" style={{ marginLeft: '6px' }}>primary</Badge> : null}</td>
                                      <td style={D_CELL}>{cr.role || '—'}</td>
                                      <td style={D_CELL}>{cr.title || '—'}</td>
                                      <td style={D_CELL}>{cr.email || '—'}</td>
                                      <td style={D_CELL}>{cr.phone || '—'}</td>
                                    </tr>))}
                            </tbody>
                          </table>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
      <SldsFooter theme={theme} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ── CasesView ──────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
function CasesView({ items: initItems, callTool, toast, theme, cacheInfo: initCacheInfo }: { items: any[]; callTool: (n: string, a?: any) => Promise<any>; toast: (m: string, t?: any) => void; theme: 'light' | 'dark'; cacheInfo?: { hit: boolean; cached_at: string } }) {
  const styles = useStyles();
  const t = slds(theme);
  const [localItems, setLocalItems] = useState(initItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [childComments, setChildComments] = useState<Record<string, any[]>>({});
  const [loadingChild, setLoadingChild] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState(initCacheInfo);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ subject: '', status: '', priority: '', account_name: '', description: '' });

  useEffect(() => { setLocalItems(initItems); setCacheInfo(initCacheInfo); }, [initItems]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await callTool('sf__get_cases', { refresh: true });
      setLocalItems(res?.items || []);
      setCacheInfo(res?._cache);
    } catch (e: any) { toast(e.message || 'Refresh failed', 'error'); }
    finally { setRefreshing(false); }
  };

  const openEdit = (c: any) => { setCreating(false); setEditingId(c.id); setForm({ subject: c.subject || '', status: c.status || '', priority: c.priority || '', account_name: c.account_name || '', description: c.description || '' }); };
  const openCreate = () => { setEditingId(null); setCreating(true); setForm({ subject: '', status: 'New', priority: 'Medium', account_name: '', description: '' }); };
  const cancel = () => { setEditingId(null); setCreating(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result: any = creating
        ? await callTool('sf__create_case', form)
        : await callTool('sf__update_case', { case_id: editingId, ...form });
      // Alert path — server returned a non-fatal warning (e.g. account-not-found
      // with suggestions). Surface the message persistently (user dismisses via
      // ✕) and keep the form open so the user can correct and re-submit.
      if (result && result.type === 'alert') {
        toast(result.message || 'Cannot complete — please correct and retry.', 'info', 0);
        return;
      }
      toast(creating ? '✓ Case created' : '✓ Case updated');
      if (!creating) setLastSavedId(editingId);
      cancel();
      const refreshed = await callTool('sf__get_cases', { refresh: true });
      if (refreshed?.items) { setLocalItems(refreshed.items); setCacheInfo(refreshed._cache); }
    } catch (e: any) { toast(e.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  useEffect(() => { if (lastSavedId) { const x = setTimeout(() => setLastSavedId(null), 4800); return () => clearTimeout(x); } }, [lastSavedId]);

  const toggleExpand = (id: string) => { setExpandedId(p => p === id ? null : id); };
  const loadComments = async (id: string) => {
    if (childComments[id]) return;
    setLoadingChild(id);
    try { const res = await callTool('sf__get_case_activity', { case_id: id }); setChildComments(p => ({ ...p, [id]: res?.comments || [] })); }
    catch { setChildComments(p => ({ ...p, [id]: [] })); }
    finally { setLoadingChild(null); }
  };

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const fFields = (f: typeof form, isEdit: boolean = false) => [
    { label: 'Subject *', key: 'subject', value: f.subject, onChange: (v: string) => setF('subject', v) },
    { label: 'Status', key: 'status', value: f.status, onChange: (v: string) => setF('status', v), type: 'select' as const, options: CASE_STATUSES },
    { label: 'Priority', key: 'priority', value: f.priority, onChange: (v: string) => setF('priority', v), type: 'select' as const, options: CASE_PRIOS },
    { label: 'Account (type full name) 🔗', key: 'account_name', value: f.account_name, onChange: (v: string) => setF('account_name', v), readonly: isEdit },
    { label: 'Description', key: 'description', value: f.description, onChange: (v: string) => setF('description', v) },
  ];

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}` }}>
      <ViewHeader icon={<DocumentRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Cases" count={localItems.length} brand={tokens.colorPaletteDarkOrangeForeground2} theme={theme} cacheInfo={cacheInfo} onRefresh={handleRefresh} refreshing={refreshing} />
      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            <TableHeaderCell style={{ ...H_CELL, width: 28, color: t.textWeak }} />
            {['Case #', 'Subject', 'Status', 'Priority', 'Account', 'Created', ''].map(h => <TableHeaderCell key={h} style={{ ...H_CELL, color: t.textWeak }}>{h}</TableHeaderCell>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {creating && <InlineFormRow colSpan={8} title="➕ New Case" titleColor={tokens.colorPaletteDarkOrangeForeground2} fields={fFields(form)} onSave={handleSave} onCancel={cancel} saving={saving} theme={theme} />}
          {localItems.length === 0 && !creating && <TableRow><TableCell colSpan={8} className={styles.empty}><Text>No cases found.</Text></TableCell></TableRow>}
          {localItems.map((c: any) => (
            <React.Fragment key={c.id}>
              <TableRow style={{ borderBottom: `1px solid ${t.border}`, ...(lastSavedId === c.id ? { animation: 'sfRowFlash 4.5s ease-out' } : {}) }}>
                <TableCell style={{ ...D_CELL, width: 28 }}><ExpandToggle expanded={expandedId === c.id} onClick={() => toggleExpand(c.id)} theme={theme} /></TableCell>
                <TableCell style={D_CELL}>{c.case_number || '—'}</TableCell>
                <TableCell style={D_CELL}>{c.subject}</TableCell>
                <TableCell style={D_CELL}><StatusPill status={c.status} theme={theme} /></TableCell>
                <TableCell style={D_CELL}><StatusPill status={c.priority} theme={theme} /></TableCell>
                <TableCell style={D_CELL}>{c.account_name || '—'}</TableCell>
                <TableCell style={D_CELL}>{fmtDate(c.created_date)}</TableCell>
                <TableCell style={D_CELL}><button title="Edit" onClick={() => openEdit(c)} className="slds-edit-btn" style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.border}`, borderRadius: '4px', background: 'transparent', cursor: 'pointer', color: t.textWeak, fontSize: '14px', padding: 0 }}><EditRegular style={{ fontSize: "16px" }} /></button></TableCell>
              </TableRow>
              {editingId === c.id && <InlineFormRow colSpan={8} title="Edit Case" titleColor={tokens.colorPaletteDarkOrangeForeground2} fields={fFields(form, true)} onSave={handleSave} onCancel={cancel} saving={saving} theme={theme} />}
              {expandedId === c.id && (
                <TableRow>
                  <TableCell colSpan={8} style={{ padding: 0, background: tokens.colorNeutralBackground2 }}>
                    <div style={{ padding: '10px 16px 14px' }}>
                      {c.description && <div style={{ fontSize: '12px', color: t.text, marginBottom: '10px', fontStyle: 'italic' }}>{c.description}</div>}
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textWeak, marginBottom: '6px', paddingBottom: '4px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span><ChatRegular style={{ fontSize: "14px", marginRight: "4px" }} /> Case Comments</span>
                        {childComments[c.id] && <span style={{ fontWeight: 400, fontSize: '10px' }}>({childComments[c.id].length})</span>}
                      </div>
                      {!childComments[c.id] && loadingChild !== c.id && (
                        <button onClick={() => loadComments(c.id)} style={{ padding: '4px 12px', borderRadius: '4px', border: `1px solid ${t.border}`, background: 'transparent', cursor: 'pointer', color: t.brand, fontSize: '12px', fontFamily: 'inherit' }}><ChatRegular style={{ fontSize: "14px", marginRight: "4px" }} /> Load Comments</button>
                      )}
                      {loadingChild === c.id && <Spinner size="tiny" label="Loading comments…" />}
                      {childComments[c.id] && (
                        childComments[c.id].length === 0
                          ? <div style={{ color: t.textWeak, fontSize: '12px', padding: '2px 0' }}>No comments</div>
                          : <>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 110px', gap: '8px', padding: '4px 0', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textWeak, borderBottom: `1px solid ${t.border}` }}>
                                <span>Comment</span>
                                <span>Author</span>
                                <span>Date</span>
                              </div>
                              {childComments[c.id].map((cm: any, i: number) => (
                                <div key={cm.id || i} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 110px', gap: '8px', padding: '5px 0', borderBottom: `1px solid ${t.border}`, fontSize: '12px', alignItems: 'start' }}>
                                  <span style={{ color: t.text, whiteSpace: 'pre-wrap' }}>{cm.body}</span>
                                  <span style={{ color: t.textWeak }}>{cm.created_by_name || 'System'}</span>
                                  <span style={{ color: t.textWeak, fontSize: '11px' }}>{fmtDate(cm.created_date)}</span>
                                </div>
                              ))}
                            </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
      <SldsFooter theme={theme} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ── TasksView ──────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
function TasksView({ items: initItems, callTool, toast, theme, cacheInfo: initCacheInfo }: { items: any[]; callTool: (n: string, a?: any) => Promise<any>; toast: (m: string, t?: any) => void; theme: 'light' | 'dark'; cacheInfo?: { hit: boolean; cached_at: string } }) {
  const styles = useStyles();
  const t = slds(theme);
  const [localItems, setLocalItems] = useState(initItems);
  const [cacheInfo, setCacheInfo] = useState(initCacheInfo);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [form, setForm] = useState({ subject: '', status: '', priority: '', activity_date: '', description: '', who_name: '', what_name: '' });

  useEffect(() => { setLocalItems(initItems); setCacheInfo(initCacheInfo); }, [initItems]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await callTool('sf__get_tasks', { refresh: true });
      setLocalItems(res?.items || []);
      setCacheInfo(res?._cache);
    } catch (e: any) { toast(e.message || 'Refresh failed', 'error'); }
    finally { setRefreshing(false); }
  };

  const openEdit = (t2: any) => { setCreating(false); setEditingId(t2.id); setForm({ subject: t2.subject || '', status: t2.status || '', priority: t2.priority || '', activity_date: t2.activity_date || '', description: t2.description || '', who_name: t2.who_name || '', what_name: t2.what_name || '' }); };
  const openCreate = () => { setEditingId(null); setCreating(true); setForm({ subject: '', status: 'Not Started', priority: 'Normal', activity_date: '', description: '', who_name: '', what_name: '' }); };
  const cancel = () => { setEditingId(null); setCreating(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (creating) { await callTool('sf__create_task', form); toast('✓ Task created'); }
      else { await callTool('sf__update_task', { task_id: editingId, ...form }); toast('✓ Task updated'); setLastSavedId(editingId); }
      cancel();
      const refreshed = await callTool('sf__get_tasks', { refresh: true });
      if (refreshed?.items) { setLocalItems(refreshed.items); setCacheInfo(refreshed._cache); }
    } catch (e: any) { toast(e.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  useEffect(() => { if (lastSavedId) { const x = setTimeout(() => setLastSavedId(null), 4800); return () => clearTimeout(x); } }, [lastSavedId]);

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const fFields = (f: typeof form, isEdit: boolean = false) => [
    { label: 'Subject *', key: 'subject', value: f.subject, onChange: (v: string) => setF('subject', v) },
    { label: 'Status', key: 'status', value: f.status, onChange: (v: string) => setF('status', v), type: 'select' as const, options: TASK_STATUSES },
    { label: 'Priority', key: 'priority', value: f.priority, onChange: (v: string) => setF('priority', v), type: 'select' as const, options: TASK_PRIOS },
    { label: 'Due Date', key: 'activity_date', value: f.activity_date, onChange: (v: string) => setF('activity_date', v), inputType: 'date' },
    { label: 'Name — Contact / Lead (type full name) 🔗', key: 'who_name', value: f.who_name, onChange: (v: string) => setF('who_name', v), readonly: isEdit },
    { label: 'Related To — Account / Opportunity / Campaign (type full name) 🔗', key: 'what_name', value: f.what_name, onChange: (v: string) => setF('what_name', v), readonly: isEdit },
    { label: 'Description', key: 'description', value: f.description, onChange: (v: string) => setF('description', v) },
  ];

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}` }}>
      <ViewHeader icon={<CheckmarkRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Tasks" count={localItems.length} brand={tokens.colorPaletteTealForeground2} theme={theme} cacheInfo={cacheInfo} onRefresh={handleRefresh} refreshing={refreshing} />
      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            {['Subject', 'Status', 'Priority', 'Due Date', 'Related To', ''].map(h => <TableHeaderCell key={h} style={{ ...H_CELL, color: t.textWeak }}>{h}</TableHeaderCell>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {creating && <InlineFormRow colSpan={6} title="➕ New Task" titleColor={tokens.colorPaletteTealForeground2} fields={fFields(form)} onSave={handleSave} onCancel={cancel} saving={saving} theme={theme} />}
          {localItems.length === 0 && !creating && <TableRow><TableCell colSpan={6} className={styles.empty}><Text>No tasks found.</Text></TableCell></TableRow>}
          {localItems.map((t2: any) => (
            <React.Fragment key={t2.id}>
              <TableRow style={{ borderBottom: `1px solid ${t.border}`, ...(lastSavedId === t2.id ? { animation: 'sfRowFlash 4.5s ease-out' } : {}) }}>
                <TableCell style={D_CELL}>{t2.subject}</TableCell>
                <TableCell style={D_CELL}><StatusPill status={t2.status} theme={theme} /></TableCell>
                <TableCell style={D_CELL}><StatusPill status={t2.priority} theme={theme} /></TableCell>
                <TableCell style={D_CELL}>{fmtDate(t2.activity_date)}</TableCell>
                <TableCell style={D_CELL}>{t2.what_name || t2.who_name || '—'}</TableCell>
                <TableCell style={D_CELL}><button title="Edit" onClick={() => openEdit(t2)} className="slds-edit-btn" style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.border}`, borderRadius: '4px', background: 'transparent', cursor: 'pointer', color: t.textWeak, fontSize: '14px', padding: 0 }}><EditRegular style={{ fontSize: "16px" }} /></button></TableCell>
              </TableRow>
              {editingId === t2.id && <InlineFormRow colSpan={6} title="Edit Task" titleColor={tokens.colorPaletteTealForeground2} fields={fFields(form, true)} onSave={handleSave} onCancel={cancel} saving={saving} theme={theme} />}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
      <SldsFooter theme={theme} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ── CampaignsView ──────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
function CampaignsView({ items: initItems, callTool, toast, theme, cacheInfo: initCacheInfo }: { items: any[]; callTool: (n: string, a?: any) => Promise<any>; toast: (m: string, t?: any) => void; theme: 'light' | 'dark'; cacheInfo?: { hit: boolean; cached_at: string } }) {
  const styles = useStyles();
  const t = slds(theme);
  const [items, setItems] = useState(initItems);
  const [cacheInfo, setCacheInfo] = useState(initCacheInfo);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [childLeads, setChildLeads] = useState<Record<string, any[]>>({});
  const [loadingChild, setLoadingChild] = useState<string | null>(null);

  useEffect(() => { setItems(initItems); setCacheInfo(initCacheInfo); }, [initItems]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await callTool('sf__get_campaigns', { refresh: true });
      setItems(res?.items || []);
      setCacheInfo(res?._cache);
    } catch { /* silent */ }
    finally { setRefreshing(false); }
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (childLeads[id]) return;
    setLoadingChild(id);
    try { const res = await callTool('sf__get_leads', { campaign_id: id }); setChildLeads(p => ({ ...p, [id]: res?.items || [] })); }
    catch { setChildLeads(p => ({ ...p, [id]: [] })); }
    finally { setLoadingChild(null); }
  };

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}` }}>
      <ViewHeader icon={<DocumentRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Campaigns" count={items.length} brand={tokens.colorPaletteMarigoldForeground2} theme={theme} cacheInfo={cacheInfo} onRefresh={handleRefresh} refreshing={refreshing} />
      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            <TableHeaderCell style={{ ...H_CELL, width: 28, color: t.textWeak }} />
            {['Name', 'Status', 'Type', 'Start', 'End', '# Leads', ''].map(h => <TableHeaderCell key={h} style={{ ...H_CELL, color: t.textWeak }}>{h}</TableHeaderCell>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && <TableRow><TableCell colSpan={7} className={styles.empty}><Text>No campaigns found.</Text></TableCell></TableRow>}
          {items.map((c: any) => (
            <React.Fragment key={c.id}>
              <TableRow style={{ borderBottom: `1px solid ${t.border}` }}>
                <TableCell style={{ ...D_CELL, width: 28 }}><ExpandToggle expanded={expandedId === c.id} onClick={() => toggleExpand(c.id)} theme={theme} /></TableCell>
                <TableCell style={D_CELL}><span style={{ fontWeight: 500 }}>{c.name}</span></TableCell>
                <TableCell style={D_CELL}><StatusPill status={c.status} theme={theme} /></TableCell>
                <TableCell style={D_CELL}>{c.type || '—'}</TableCell>
                <TableCell style={D_CELL}>{fmtDate(c.start_date)}</TableCell>
                <TableCell style={D_CELL}>{fmtDate(c.end_date)}</TableCell>
                <TableCell style={D_CELL}>{c.number_of_leads ?? '—'}</TableCell>
                <TableCell style={{ ...D_CELL, width: 36 }}>
                  <button title="Edit" onClick={() => callTool('sf__get_campaigns', { campaign_id: c.id }).catch((e: any) => toast(e.message || 'Error', 'error'))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textWeak, fontSize: '14px', padding: '2px 4px' }}><EditRegular style={{ fontSize: "16px" }} /></button>
                </TableCell>
              </TableRow>
              {expandedId === c.id && (
                <TableRow>
                  <TableCell colSpan={8} style={{ padding: 0, background: tokens.colorNeutralBackground2 }}>
                    <div style={{ padding: '8px 28px 12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textWeak, marginBottom: '6px' }}>Campaign Leads</div>
                      {loadingChild === c.id ? <Spinner size="tiny" label="Loading leads…" /> : (
                        (childLeads[c.id] || []).length === 0 ? <div style={{ color: t.textWeak, fontSize: '12px', padding: '8px 0' }}>No leads in this campaign.</div> :
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead><tr>{['Name', 'Company', 'Status', 'Email'].map(h => <th key={h} style={{ ...H_CELL, color: t.textWeak, textAlign: 'left' }}>{h}</th>)}</tr></thead>
                            <tbody>{(childLeads[c.id] || []).map((l: any) => (
                              <tr key={l.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                                <td style={D_CELL}>{l.first_name} {l.last_name}</td>
                                <td style={D_CELL}>{l.company || '—'}</td>
                                <td style={D_CELL}><StatusPill status={l.status} theme={theme} /></td>
                                <td style={D_CELL}>{l.email || '—'}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
      <SldsFooter theme={theme} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ── ApprovalsView ──────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
function CaseActivityView({ caseId, comments, tasks, theme }: { caseId: string; comments: any[]; tasks: any[]; theme: 'light' | 'dark' }) {
  const styles = useStyles();
  const t = slds(theme);
  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}` }}>
      <ViewHeader icon={<DocumentRegular style={{ fontSize: '18px', color: '#fff' }} />} title={`Activity on case ${caseId}`} count={comments.length + tasks.length} brand={tokens.colorPaletteDarkOrangeForeground2} theme={theme} />

      {/* Section 1 — Comments */}
      <div style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, color: t.textWeak, borderBottom: `1px solid ${t.border}` }}>
        Comments ({comments.length})
      </div>
      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            {['Comment', 'Author', 'Created'].map(h => <TableHeaderCell key={h} style={{ ...H_CELL, color: t.textWeak }}>{h}</TableHeaderCell>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {comments.length === 0 && <TableRow><TableCell colSpan={3} className={styles.empty}><Text>No comments yet.</Text></TableCell></TableRow>}
          {comments.map((c: any) => (
            <TableRow key={c.id} style={{ borderBottom: `1px solid ${t.border}` }}>
              <TableCell style={CELL}><Text size={200} style={{ whiteSpace: 'pre-wrap' }}>{c.body}</Text></TableCell>
              <TableCell style={CELL}><Text size={200}>{c.author}</Text></TableCell>
              <TableCell style={CELL}><Text size={200}>{c.created_date}</Text></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Section 2 — Tasks */}
      <div style={{ padding: '12px 12px 8px', fontSize: 13, fontWeight: 600, color: t.textWeak, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}` }}>
        Tasks ({tasks.length})
      </div>
      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            {['Subject', 'Status', 'Priority', 'Due', 'Owner'].map(h => <TableHeaderCell key={h} style={{ ...H_CELL, color: t.textWeak }}>{h}</TableHeaderCell>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.length === 0 && <TableRow><TableCell colSpan={5} className={styles.empty}><Text>No tasks logged.</Text></TableCell></TableRow>}
          {tasks.map((tk: any) => (
            <TableRow key={tk.id} style={{ borderBottom: `1px solid ${t.border}` }}>
              <TableCell style={CELL}><Text size={200}>{tk.subject}</Text></TableCell>
              <TableCell style={CELL}><Text size={200}>{tk.status}</Text></TableCell>
              <TableCell style={CELL}><Text size={200}>{tk.priority}</Text></TableCell>
              <TableCell style={CELL}><Text size={200}>{tk.activity_date}</Text></TableCell>
              <TableCell style={CELL}><Text size={200}>{tk.owner}</Text></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}


function ApprovalsView({ items: initItems, callTool, toast, theme }: { items: any[]; callTool: (n: string, a?: any) => Promise<any>; toast: (m: string, t?: any) => void; theme: 'light' | 'dark' }) {
  const styles = useStyles();
  const t = slds(theme);
  const [localItems, setLocalItems] = useState(initItems);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => { setLocalItems(initItems); }, [initItems]);

  const act = async (approvalId: string, action: 'approve' | 'reject') => {
    setActingId(approvalId);
    try {
      const tool = action === 'approve' ? 'sf__approve_record' : 'sf__reject_record';
      const res = await callTool(tool, { approval_id: approvalId });
      if (res?.items !== undefined) setLocalItems(res.items);
      toast(`✓ ${action === 'approve' ? 'Approved' : 'Rejected'}`);
    } catch (e: any) {
      toast(e?.message || `Failed to ${action}`, 'error');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}` }}>
      <ViewHeader icon={<CheckmarkRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Pending Approvals" count={localItems.length} brand={tokens.colorPalettePlumForeground2} theme={theme} />
      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            {['Record', 'Type', 'Submitted By', 'Status', 'Created', ''].map(h => <TableHeaderCell key={h} style={{ ...H_CELL, color: t.textWeak }}>{h}</TableHeaderCell>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {localItems.length === 0 && <TableRow><TableCell colSpan={6} className={styles.empty}><Text>No pending approvals.</Text></TableCell></TableRow>}
          {localItems.map((a: any) => (
            <TableRow key={a.id} style={{ borderBottom: `1px solid ${t.border}` }}>
              <TableCell style={{ ...D_CELL, fontWeight: 500 }}>{a.target_name || a.id}</TableCell>
              <TableCell style={D_CELL}>{a.target_type || '—'}</TableCell>
              <TableCell style={D_CELL}>{a.submitted_by || '—'}</TableCell>
              <TableCell style={D_CELL}><StatusPill status={a.status || 'Pending'} theme={theme} /></TableCell>
              <TableCell style={D_CELL}>{fmtDate(a.created_date)}</TableCell>
              <TableCell style={D_CELL}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    title="Approve"
                    onClick={() => act(a.id, 'approve')}
                    disabled={actingId === a.id}
                    style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${tokens.colorPaletteGreenForeground1}`, borderRadius: '4px', background: 'transparent', cursor: actingId === a.id ? 'wait' : 'pointer', color: tokens.colorPaletteGreenForeground1, fontSize: '14px', padding: 0 }}
                  >✓</button>
                  <button
                    title="Reject"
                    onClick={() => act(a.id, 'reject')}
                    disabled={actingId === a.id}
                    style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${tokens.colorPaletteRedForeground1}`, borderRadius: '4px', background: 'transparent', cursor: actingId === a.id ? 'wait' : 'pointer', color: tokens.colorPaletteRedForeground1, fontSize: '14px', padding: 0 }}
                  >✗</button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <SldsFooter theme={theme} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ── SalesDashboardView ─────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
function SalesDashboardView({ data, theme }: { data: SalesDashboardData; theme: 'light' | 'dark' }) {
  const styles = useStyles();
  const t = slds(theme);
  const maxAmt = Math.max(...(data.pipeline_by_stage || []).map((s: any) => s.amount || 0), 1);
  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}` }}>
      <ViewHeader icon={<DocumentRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Sales Dashboard" count={0} brand={t.brand} theme={theme} />
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          {[
            { label: 'Closed Won', value: fmt$(data.closed_won_this_month), color: tokens.colorPaletteGreenForeground1 },
            { label: 'Closed Lost', value: fmt$(data.closed_lost_this_month), color: tokens.colorPaletteRedForeground1 },
            { label: 'Pipeline Stages', value: String(data.pipeline_by_stage?.length || 0), color: t.brand },
          ].map(k => (
            <div key={k.label} style={{ borderRadius: '6px', padding: '12px', background: tokens.colorNeutralBackground3, textAlign: 'center', border: `1px solid ${t.border}` }}>
              <div style={{ fontSize: '11px', color: t.textWeak, marginBottom: '4px' }}>{k.label}</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: t.textWeak, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Pipeline by Stage (Amount)</div>
            {(data.pipeline_by_stage || []).map((s: any) => (
              <DashBar key={s.stage} label={s.stage} value={s.amount || 0} max={maxAmt} color={t.brand} theme={theme} />
            ))}
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: t.textWeak, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Top Accounts</div>
            {(data.top_accounts || []).map((a: any, i: number) => (
              <div key={a.id || i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${t.border}`, fontSize: '12px' }}>
                <span style={{ color: t.text }}>{a.name}</span>
                <span style={{ color: t.brand, fontWeight: 600 }}>{fmt$(a.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SldsFooter theme={theme} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ── FormView (standalone – from show_create_form tool) ─────────────────────
// ────────────────────────────────────────────────────────────────────────────
const FORM_DEFS: Record<string, { label: string; key: string; required?: boolean; type?: 'select'; options?: string[]; inputType?: string }[]> = {
  lead: [
    { label: 'First Name', key: 'first_name' }, { label: 'Last Name *', key: 'last_name', required: true },
    { label: 'Company *', key: 'company', required: true }, { label: 'Email', key: 'email', inputType: 'email' },
    { label: 'Phone', key: 'phone' }, { label: 'Status', key: 'status', type: 'select', options: LEAD_STATUSES },
    { label: 'Lead Source', key: 'lead_source', type: 'select', options: LEAD_SOURCES },
  ],
  account: [
    { label: 'Account Name *', key: 'name', required: true }, { label: 'Industry', key: 'industry', type: 'select', options: ACCT_INDUSTRIES },
    { label: 'Phone', key: 'phone' }, { label: 'Website', key: 'website' },
    { label: 'Type', key: 'type', type: 'select', options: ACCT_TYPES }, { label: 'City', key: 'billing_city' },
  ],
  contact: [
    { label: 'First Name', key: 'first_name' }, { label: 'Last Name *', key: 'last_name', required: true },
    { label: 'Email', key: 'email', inputType: 'email' }, { label: 'Phone', key: 'phone' },
    { label: 'Title', key: 'title' }, { label: 'Account (type full name) 🔗', key: 'account_name' },
  ],
  opportunity: [
    { label: 'Name *', key: 'name', required: true }, { label: 'Account (type full name) 🔗', key: 'account_name' },
    { label: 'Stage', key: 'stage', type: 'select', options: OPP_STAGES }, { label: 'Amount ($)', key: 'amount', inputType: 'number' },
    { label: 'Close Date', key: 'close_date', inputType: 'date' }, { label: 'Probability (%)', key: 'probability', inputType: 'number' },
  ],
  case: [
    { label: 'Subject *', key: 'subject', required: true }, { label: 'Status', key: 'status', type: 'select', options: CASE_STATUSES },
    { label: 'Priority', key: 'priority', type: 'select', options: CASE_PRIOS }, { label: 'Account (type full name) 🔗', key: 'account_name' },
    { label: 'Contact (type full name) 🔗', key: 'contact_name' },
    { label: 'Description', key: 'description' },
  ],
  task: [
    { label: 'Subject *', key: 'subject', required: true }, { label: 'Status', key: 'status', type: 'select', options: TASK_STATUSES },
    { label: 'Priority', key: 'priority', type: 'select', options: TASK_PRIOS }, { label: 'Due Date', key: 'activity_date', inputType: 'date' },
    { label: 'Name — Contact / Lead (type full name) 🔗', key: 'who_name' },
    { label: 'Related To — Account / Opportunity / Campaign (type full name) 🔗', key: 'what_name' },
    { label: 'Description', key: 'description' },
  ],
  campaign: [
    { label: 'Name *', key: 'name', required: true },
    { label: 'Status', key: 'status', type: 'select', options: CAMPAIGN_STATUSES },
    { label: 'Type', key: 'type', type: 'select', options: CAMPAIGN_TYPES },
    { label: 'Start Date', key: 'start_date', inputType: 'date' },
    { label: 'End Date', key: 'end_date', inputType: 'date' },
  ],
};

const FORM_CREATE_TOOL: Record<string, string> = { lead: 'sf__create_lead', account: 'sf__create_account', contact: 'sf__create_contact', opportunity: 'sf__create_opportunity', case: 'sf__create_case', task: 'sf__create_task', campaign: 'sf__create_campaign' };
const FORM_UPDATE_TOOL: Record<string, string> = { lead: 'sf__update_lead', account: 'sf__update_account', contact: 'sf__update_contact', opportunity: 'sf__update_opportunity', case: 'sf__update_case', task: 'sf__update_task', campaign: 'sf__update_campaign' };
const FORM_LIST_TOOL: Record<string, string>   = { lead: 'sf__get_leads', account: 'sf__get_accounts', contact: 'sf__get_contacts', opportunity: 'sf__get_opportunities', case: 'sf__get_cases', task: 'sf__get_tasks', campaign: 'sf__get_campaigns' };
const FORM_ID_PARAM: Record<string, string>    = { lead: 'lead_id', account: 'account_id', contact: 'contact_id', opportunity: 'opportunity_id', case: 'case_id', task: 'task_id', campaign: 'campaign_id' };
const FORM_ICONS: Record<string, string> = { lead: '👤', account: '🏢', contact: '👥', opportunity: '💰', case: '🎫', task: '✅', campaign: '📣' };
const FORM_BRAND: Record<string, string> = {
  lead:        tokens.colorPaletteLavenderForeground2,
  account:     tokens.colorPalettePinkForeground2,
  contact:     tokens.colorPaletteMagentaForeground2,
  opportunity: tokens.colorPaletteCornflowerForeground2,
  case:        tokens.colorPaletteDarkOrangeForeground2,
  task:        tokens.colorPaletteTealForeground2,
  campaign:    tokens.colorPaletteMarigoldForeground2,
};

// SuccessPivot: handles the `type: 'success'` response shape returned by
// every update/create tool. When Copilot calls an update tool directly
// (without going through the inline form), the response lands at the
// top-level dispatcher with no matching view -- the result was a grey
// empty container. This component fetches the entity's list and renders
// it so the user sees their data instead of blank space.
function SuccessPivot({ entity, callTool, toast, theme }: {
  entity: string;
  callTool: (n: string, a?: any) => Promise<any>;
  toast: (m: string, t?: any) => void;
  theme: 'light' | 'dark';
}) {
  const [listData, setListData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const listTool = FORM_LIST_TOOL[entity];
    if (!listTool) { setLoading(false); return; }
    callTool(listTool, { refresh: true })
      .then(res => setListData(res))
      .catch(() => { /* leave listData null -> render nothing */ })
      .finally(() => setLoading(false));
  }, [entity, callTool]);

  if (loading) return <SkeletonTable />;
  if (!listData) return null;
  const node = renderListView(entity, listData, callTool, toast, theme);
  return <>{node}</>;
}

function renderListView(entity: string, data: any, callTool: (n: string, a?: any) => Promise<any>, toast: (m: string, t?: any) => void, theme: 'light' | 'dark'): React.ReactNode {
  const items = data?.items || [];
  const cacheInfo = data?._cache;
  switch (entity) {
    case 'lead':        return <LeadsView         items={items} callTool={callTool} toast={toast} theme={theme} cacheInfo={cacheInfo} />;
    case 'account':     return <AccountsView      items={items} callTool={callTool} toast={toast} theme={theme} cacheInfo={cacheInfo} />;
    case 'contact':     return <ContactsView      items={items} callTool={callTool} toast={toast} theme={theme} cacheInfo={cacheInfo} />;
    case 'opportunity': return <OpportunitiesView items={items} callTool={callTool} toast={toast} theme={theme} cacheInfo={cacheInfo} />;
    case 'case':        return <CasesView         items={items} callTool={callTool} toast={toast} theme={theme} cacheInfo={cacheInfo} />;
    case 'task':        return <TasksView         items={items} callTool={callTool} toast={toast} theme={theme} cacheInfo={cacheInfo} />;
    case 'campaign':    return <CampaignsView     items={items} callTool={callTool} toast={toast} theme={theme} cacheInfo={cacheInfo} />;
    default: return null;
  }
}

function FormView({ entity, prefill, fkSelections, mode = 'create', recordId, callTool, toast, theme }: {
  entity: string;
  prefill?: Record<string, string>;
  fkSelections?: Record<string, { label: string; options: { id: string; name: string }[] }>;
  mode?: 'create' | 'edit';
  recordId?: string;
  callTool: (n: string, a?: any) => Promise<any>;
  toast: (m: string, t?: any) => void;
  theme: 'light' | 'dark';
}) {
  const styles = useStyles();
  const t = slds(theme);
  const fields = FORM_DEFS[entity] || [];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    fields.forEach(f => { init[f.key] = prefill?.[f.key] || ''; });
    return init;
  });
  const [fkChoices, setFkChoices] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [listAfterAction, setListAfterAction] = useState<any | null>(null);
  const set = (k: string, v: string) => setValues(p => ({ ...p, [k]: v }));
  const setFk = (k: string, v: string) => setFkChoices(p => ({ ...p, [k]: v }));

  const entityLabel = entity.charAt(0).toUpperCase() + entity.slice(1);
  const isEdit = mode === 'edit';

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const args: Record<string, any> = {};
      fields.forEach(f => { if (values[f.key]) args[f.key] = values[f.key]; });
      Object.entries(fkChoices).forEach(([k, v]) => { if (v) args[k] = v; });
      let result: any;
      if (isEdit) {
        const idParam = FORM_ID_PARAM[entity] || `${entity}_id`;
        result = await callTool(FORM_UPDATE_TOOL[entity] || `update_${entity}`, { [idParam]: recordId, ...args });
      } else {
        result = await callTool(FORM_CREATE_TOOL[entity] || `create_${entity}`, args);
      }
      // Alert path — server returned a non-fatal warning (e.g. account-not-found
      // with suggestions). Surface the message persistently (user dismisses via
      // ✕) and keep the form open so the user can correct and re-submit.
      // Do NOT pivot to the list.
      if (result && result.type === 'alert') {
        toast(result.message || 'Cannot complete — please correct and retry.', 'info', 0);
        return;
      }
      toast(`${entityLabel} ${isEdit ? 'updated' : 'created'}!`, 'success');
      // Pivot to the list view so the user immediately sees the new/updated row
      const listTool = FORM_LIST_TOOL[entity];
      if (listTool) {
        try {
          const listRes = await callTool(listTool, { refresh: true });
          if (listRes) setListAfterAction(listRes);
        } catch { /* fall through — leave form open */ }
      }
    } catch (e: any) { toast(e?.message || `Failed to ${isEdit ? 'update' : 'create'}.`, 'error'); }
    finally { setSubmitting(false); }
  };

  const handleReset = () => {
    const init: Record<string, string> = {};
    fields.forEach(f => { init[f.key] = prefill?.[f.key] || ''; });
    setValues(init);
    setFkChoices({});
  };

  // After successful create/update, pivot to the matching list view.
  if (listAfterAction) {
    const node = renderListView(entity, listAfterAction, callTool, toast, theme);
    if (node) return <>{node}</>;
  }

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}`, background: t.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: FORM_BRAND[entity] || t.brand }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{FORM_ICONS[entity] || '✨'} {isEdit ? 'Edit' : 'New'} {entityLabel}</span>
        <ExpandButton />
      </div>
      {(
        <div style={{ padding: '16px 20px 20px' }}>
          {fkSelections && Object.keys(fkSelections).length > 0 && (
            <div style={{ marginBottom: '18px', padding: '12px 14px', background: t.surfaceAlt || t.surface, border: `1px solid ${t.border}`, borderRadius: '6px' }}>
              {Object.entries(fkSelections).map(([fkKey, fkDef]) => (
                <div key={fkKey} style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textWeak, marginBottom: '6px' }}>
                    {fkDef.label}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {fkDef.options.map(opt => (
                      <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: t.text }}>
                        <input
                          type="radio"
                          name={fkKey}
                          value={opt.id}
                          checked={fkChoices[fkKey] === opt.id}
                          onChange={() => setFk(fkKey, opt.id)}
                          style={{ accentColor: t.brand }}
                        />
                        {opt.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 20px', marginBottom: '20px' }}>
            {fields.map(f =>
              f.type === 'select' ? (
                <FormSelect key={f.key} label={f.label} value={values[f.key]} options={f.options || []} onChange={v => set(f.key, v)} theme={theme} />
              ) : (
                <Field key={f.key} label={f.label} size="small">
                  <Input size="small" type={f.inputType || 'text'} value={values[f.key]} onChange={(_, d) => set(f.key, d.value)} style={{ background: t.surface, color: t.text }} />
                </Field>
              )
            )}
          </div>
          <div className={styles.formActions}>
            <Button size="small" appearance="subtle" onClick={handleReset} style={{ color: t.textWeak }}>Cancel</Button>
            <Button size="small" appearance="primary" onClick={handleSubmit} disabled={submitting}
              style={{ background: t.brand, borderColor: t.brand, color: '#fff', minWidth: '90px' }}>
              {submitting ? <Spinner size="tiny" /> : 'Submit'}
            </Button>
          </div>
          <FkHint fields={fields} systemName="Salesforce" />
        </div>
      )}
      <SldsFooter theme={theme} />
    </div>
  );
}

// ── Global CSS ─────────────────────────────────────────────────────────────
const _styleId = 'slds-global-style';
if (typeof document !== 'undefined' && !document.getElementById(_styleId)) {
  const s = document.createElement('style');
  s.id = _styleId;
  s.textContent = `
    @keyframes sfRowFlash { 0%{background:var(--colorPaletteGreenBackground2)}100%{background:transparent} }
    .slds-row:hover { background: var(--colorNeutralBackground2Hover); }
    .slds-edit-btn:hover { color: var(--colorBrandBackground) !important; border-color: var(--colorBrandBackground) !important; }
    .fui-Input:focus-within { box-shadow: 0 0 3px var(--colorBrandBackground); border-color: var(--colorBrandBackground); }
    select:focus { outline: none; box-shadow: 0 0 3px var(--colorBrandBackground); border-color: var(--colorBrandBackground) !important; }
  `;
  document.head.appendChild(s);
}

// ────────────────────────────────────────────────────────────────────────────
// ── Main App ───────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
export function SalesforceApp() {
  const styles = useStyles();
  const data = useToolData<SfData>();
  const { callTool } = useMcpBridge();
  const toast = useToast();
  const theme = useTheme();
  const t = slds(theme);
  const shellStyle: React.CSSProperties = { padding: '12px', fontSize: '12px' };

  if (!data) return <div className={styles.shell} style={shellStyle}><SkeletonTable /></div>;

  // ── Form (standalone create form from tool) ──
  if ((data as any).type === 'form') {
    const fd = data as any;
    return <div className={styles.shell} style={shellStyle}><FormView entity={fd.entity} mode={fd.mode || 'create'} recordId={fd.recordId} prefill={fd.prefill} fkSelections={fd.fkSelections} callTool={callTool} toast={toast} theme={theme} /></div>;
  }

  // ── Success (post-update / post-create direct call from Copilot) ──
  // The update/create tools return { type: 'success', entity, record_id, message }.
  // Without an explicit handler, this falls through to the list block and renders
  // empty (the grey-shell bug). SuccessPivot fetches the entity's list so the
  // user sees their data after a direct "Update X to Y" command.
  if ((data as any).type === 'success') {
    const sd = data as any;
    return <div className={styles.shell} style={shellStyle}><SuccessPivot entity={sd.entity} callTool={callTool} toast={toast} theme={theme} /></div>;
  }

  // ── Dashboards ──
  if ((data as any).type === 'sales_dashboard') {
    return <div className={styles.shell} style={shellStyle}><SalesDashboardView data={data as SalesDashboardData} theme={theme} /></div>;
  }

  // ── Error ──
  if ((data as any).error) {
    const ed = data as any;
    return (
      <div className={styles.shell} style={shellStyle}>
        <div className={styles.card} style={{ border: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', background: t.brand }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>⚠️ Error</span>
          </div>
          <div style={{ padding: '12px 16px', background: tokens.colorPaletteRedBackground1, color: t.danger, borderLeft: `3px solid ${t.danger}`, fontSize: '13px', fontWeight: 500 }}>
            {ed.message || 'An unknown error occurred.'}
          </div>
          <SldsFooter theme={theme} />
        </div>
      </div>
    );
  }

  // ── List views ──
  const ld = data as SfListData;
  const items = ld.items || [];
  const cache = (ld as any)._cache as { hit: boolean; cached_at: string } | undefined;

  return (
    <div className={styles.shell} style={shellStyle}>
      {ld.type === 'accounts'      && <AccountsView      items={items} callTool={callTool} toast={toast} theme={theme} cacheInfo={cache} />}
      {ld.type === 'leads'         && <LeadsView         items={items} callTool={callTool} toast={toast} theme={theme} cacheInfo={cache} />}
      {ld.type === 'contacts'      && <ContactsView      items={items} callTool={callTool} toast={toast} theme={theme} cacheInfo={cache} />}
      {ld.type === 'opportunities' && <OpportunitiesView items={items} callTool={callTool} toast={toast} theme={theme} cacheInfo={cache} />}
      {ld.type === 'cases'         && <CasesView         items={items} callTool={callTool} toast={toast} theme={theme} cacheInfo={cache} />}
      {ld.type === 'tasks'         && <TasksView         items={items} callTool={callTool} toast={toast} theme={theme} cacheInfo={cache} />}
      {ld.type === 'campaigns'     && <CampaignsView     items={items} callTool={callTool} toast={toast} theme={theme} cacheInfo={cache} />}
      {ld.type === 'approvals'     && <ApprovalsView     items={items} callTool={callTool} toast={toast} theme={theme} />}
      {ld.type === 'case_activity' && <CaseActivityView  caseId={(data as any).case_id || ''} comments={(data as any).comments || []} tasks={(data as any).tasks || []} theme={theme} />}
    </div>
  );
}
