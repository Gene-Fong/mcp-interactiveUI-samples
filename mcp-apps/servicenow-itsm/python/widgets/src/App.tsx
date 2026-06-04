import React, { useState, useEffect } from 'react';
import {
  Badge,
  Button,
  Field,
  Input,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { AddRegular, EditRegular, AlertRegular, BugRegular, BookRegular, ChatRegular, DocumentRegular, DocumentBulletListRegular, PersonRegular, CheckmarkRegular, ChevronRightRegular, ChevronDownRegular, ArrowSyncRegular, ArrowSwapRegular, ShoppingBagRegular } from '@fluentui/react-icons';
import { useToolData, useMcpBridge, useTheme, ExpandButton, useToast, FkHint } from '@gtc/mcp-shared';
import type {
  SnowData, Incident, ServiceRequest, RequestItem,
  ChangeRequest, ChangeTask, Problem, KnowledgeArticle, CatalogItem, SnowApproval,
} from './types';

// ── Global row hover styles ─────────────────────────────────────────────────
const GLOBAL_STYLES = `
.snow-row:hover { background: var(--colorBrandBackgroundHover); }
[data-theme="dark"] .snow-row:hover { background: var(--colorBrandBackgroundHover); }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
if (typeof document !== 'undefined' && !document.getElementById('sn-row-hover-styles')) {
  const style = document.createElement('style');
  style.id = 'sn-row-hover-styles';
  style.textContent = GLOBAL_STYLES;
  document.head.appendChild(style);
}

// ── Fluent v9 token shim ────────────────────────────────────────────────────
// FluentProvider drives light/dark via the host's theme context. `now(theme)`
// is kept as a thin alias mapping into Fluent tokens so existing call sites
// keep working with zero edits. Tokens auto-swap on theme change.
function now(_theme: 'light' | 'dark') {
  return {
    shell:      tokens.colorBrandBackground,
    brand:      tokens.colorBrandBackground,
    bg:         tokens.colorNeutralBackground2,
    surface:    tokens.colorNeutralBackground1,
    text:       tokens.colorNeutralForeground1,
    textWeak:   tokens.colorNeutralForeground3,
    border:     tokens.colorNeutralStroke2,
    p1:         tokens.colorPaletteRedForeground1,
    p2:         tokens.colorPaletteDarkOrangeForeground1,
    p3:         tokens.colorPaletteYellowForeground1,
    p4:         tokens.colorPaletteGreenForeground1,
    success:    tokens.colorPaletteGreenForeground1,
    error:      tokens.colorPaletteRedForeground1,
    headerBg:   tokens.colorNeutralBackground3,
  };
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 5)  return 'just now';
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

// ── Dropdown options ────────────────────────────────────────────────────────
const PRIORITIES = ['1', '2', '3', '4'];
const PRIORITY_LABELS: Record<string, string> = {
  '1': '1 – Critical', '2': '2 – High', '3': '3 – Moderate', '4': '4 – Low',
};
const INCIDENT_STATES = ['New', 'In Progress', 'On Hold', 'Resolved', 'Closed'];
const CHANGE_STATES   = ['New', 'Assess', 'Authorize', 'Scheduled', 'Implement', 'Review', 'Closed', 'Canceled'];
const PROBLEM_STATES  = ['New', 'Assess', 'Root Cause Analysis', 'Fix in Progress', 'Resolved', 'Closed'];
const HR_STATES       = ['Draft', 'Ready', 'Awaiting Approval', 'Work in Progress', 'Awaiting Acceptance', 'Closed Complete', 'Closed Incomplete', 'Cancelled', 'Suspended'];
const REQUEST_STATES  = ['Pending Approval', 'Approved', 'Closed Complete', 'Closed Incomplete', 'Closed Cancelled', 'Closed Rejected', 'Closed Skipped'];
const FORM_LIST_TOOL: Record<string, string> = {
  incident: 'sn__get_incidents', request: 'sn__get_requests',
  change_request: 'sn__get_change_requests', problem: 'sn__get_problems',
  hr_case: 'sn__get_hr_cases',
};
const CATEGORIES = ['inquiry', 'software', 'hardware', 'network', 'database', 'password_reset'];
const APPROVAL_OPTIONS = ['not requested', 'requested', 'approved', 'rejected'];
const CHANGE_CATEGORIES = ['Hardware', 'Software', 'Service', 'System Software', 'Applications Software', 'Network', 'Telecom', 'Documentation', 'Other'];
const CHANGE_TYPES = ['normal', 'standard', 'emergency'];
const CHANGE_TYPE_LABELS: Record<string, string> = { normal: 'Normal', standard: 'Standard', emergency: 'Emergency' };
const RISK_OPTIONS = ['2', '3', '4'];
const RISK_LABELS: Record<string, string> = { '2': 'High', '3': 'Moderate', '4': 'Low' };

// ── Priority pill styles ────────────────────────────────────────────────────
type PillStyle = { background: string; color: string; border: string };

const PRIORITY_STYLES: Record<string, PillStyle> = {
  '1': { background: tokens.colorPaletteRedBackground1,          color: tokens.colorPaletteRedForeground2,          border: tokens.colorPaletteRedBorder1 },
  '2': { background: tokens.colorPaletteDarkOrangeBackground1,    color: tokens.colorPaletteDarkOrangeForeground2,    border: tokens.colorPaletteDarkOrangeBorder1 },
  '3': { background: '#E3D7F8', color: '#4E30C8', border: '#A893F2' },
  '4': { background: '#F0E8F8', color: '#6E50E8', border: '#D5C9F0' },
};

const STATE_STYLES: Record<string, PillStyle> = {
  'new':         { background: tokens.colorPaletteCornflowerBackground2,  color: tokens.colorPaletteCornflowerForeground2,  border: tokens.colorPaletteCornflowerBorderActive },
  'in progress': { background: tokens.colorPaletteDarkOrangeBackground1,  color: tokens.colorPaletteDarkOrangeForeground2,  border: tokens.colorPaletteDarkOrangeBorder1 },
  'on hold':     { background: tokens.colorNeutralBackground2,    color: tokens.colorNeutralForeground2,    border: tokens.colorNeutralStroke2 },
  'resolved':    { background: tokens.colorPaletteGreenBackground1,      color: tokens.colorPaletteGreenForeground2,      border: tokens.colorPaletteGreenBorder1 },
  'closed':      { background: tokens.colorNeutralBackground2,    color: tokens.colorNeutralForeground2,    border: tokens.colorNeutralStroke2 },
  'published':   { background: tokens.colorPaletteGreenBackground1,      color: tokens.colorPaletteGreenForeground2,      border: tokens.colorPaletteGreenBorder1 },
  'requested':   { background: tokens.colorPaletteDarkOrangeBackground1,  color: tokens.colorPaletteDarkOrangeForeground2,  border: tokens.colorPaletteDarkOrangeBorder1 },
};

const APPROVAL_STYLES: Record<string, PillStyle> = {
  'approved':      { background: tokens.colorPaletteGreenBackground1,      color: tokens.colorPaletteGreenForeground2,      border: tokens.colorPaletteGreenBorder1 },
  'requested':     { background: tokens.colorPaletteDarkOrangeBackground1,  color: tokens.colorPaletteDarkOrangeForeground2,  border: tokens.colorPaletteDarkOrangeBorder1 },
  'not requested': { background: tokens.colorNeutralBackground2,    color: tokens.colorNeutralForeground2,    border: tokens.colorNeutralStroke2 },
  'rejected':      { background: tokens.colorPaletteRedBackground1,        color: tokens.colorPaletteRedForeground2,        border: tokens.colorPaletteRedBorder1 },
};

const RISK_STYLES: Record<string, PillStyle> = {
  'low':    { background: tokens.colorPaletteGreenBackground1,      color: tokens.colorPaletteGreenForeground2,      border: tokens.colorPaletteGreenBorder1 },
  'medium': { background: tokens.colorPaletteDarkOrangeBackground1,  color: tokens.colorPaletteDarkOrangeForeground2,  border: tokens.colorPaletteDarkOrangeBorder1 },
  'high':   { background: tokens.colorPaletteRedBackground1,        color: tokens.colorPaletteRedForeground2,        border: tokens.colorPaletteRedBorder1 },
  '4':      { background: tokens.colorPaletteGreenBackground1,      color: tokens.colorPaletteGreenForeground2,      border: tokens.colorPaletteGreenBorder1 },
  '3':      { background: tokens.colorPaletteDarkOrangeBackground1,  color: tokens.colorPaletteDarkOrangeForeground2,  border: tokens.colorPaletteDarkOrangeBorder1 },
  '2':      { background: tokens.colorPaletteRedBackground1,        color: tokens.colorPaletteRedForeground2,        border: tokens.colorPaletteRedBorder1 },
};

function PriorityPill({ priority, theme }: { priority: string; theme: 'light' | 'dark' }) {
  const key = String(priority).charAt(0);
  const style = PRIORITY_STYLES[key] || PRIORITY_STYLES['3'];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '15px',
      fontSize: '11px', fontWeight: 600, letterSpacing: '0.2px',
      background: style.background, color: style.color, border: `1px solid ${style.border}`,
    }}>
      {PRIORITY_LABELS[key] || priority || '—'}
    </span>
  );
}

function StatePill({ state, theme }: { state: string; theme: 'light' | 'dark' }) {
  const key = (state || '').toLowerCase();
  const style = STATE_STYLES[key] || { background: '#EAEAEA', color: '#555', border: tokens.colorNeutralStroke2 };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '15px',
      fontSize: '11px', fontWeight: 500,
      background: style.background, color: style.color, border: `1px solid ${style.border}`,
    }}>
      {state || '—'}
    </span>
  );
}

function ApprovalPill({ approval, theme }: { approval: string; theme: 'light' | 'dark' }) {
  const key = (approval || '').toLowerCase();
  const style = APPROVAL_STYLES[key] || APPROVAL_STYLES['not requested'];
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '15px',
      fontSize: '11px', fontWeight: 500,
      background: style.background, color: style.color, border: `1px solid ${style.border}`,
    }}>
      {approval || '—'}
    </span>
  );
}

function RiskPill({ risk, theme }: { risk: string; theme: 'light' | 'dark' }) {
  const key = (risk || '').toLowerCase();
  const style = RISK_STYLES[key] || RISK_STYLES['medium'];
  const label = RISK_LABELS[risk] || risk;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '15px',
      fontSize: '11px', fontWeight: 500,
      background: style.background, color: style.color, border: `1px solid ${style.border}`,
    }}>
      {label || '—'}
    </span>
  );
}

// ── Shared ViewHeader (Fluent 2 — per-entity accent + cache pill + refresh) ──
function ViewHeader({ icon, title, count, brand, onNew, newLabel, cacheInfo, onRefresh, refreshing }: {
  icon: React.ReactNode;
  title: string;
  count: number;
  brand: string;
  onNew?: () => void;
  newLabel?: string;
  cacheInfo?: { hit: boolean; cached_at: string } | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: brand }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>{title}</span>
        <Badge appearance="filled" size="small" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: '4px', fontWeight: 600 }}>
          {count} record{count !== 1 ? 's' : ''}
        </Badge>
        {cacheInfo && (
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {cacheInfo.hit ? `cached ${timeAgo(cacheInfo.cached_at)}` : `live ${timeAgo(cacheInfo.cached_at)}`}
            {onRefresh && (
              <button onClick={onRefresh} disabled={refreshing}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.9)', cursor: refreshing ? 'wait' : 'pointer', padding: '0 4px', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                title="Force refresh from ServiceNow">
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

function SlaPill({ slaDue, madeSla, theme }: { slaDue?: string; madeSla?: boolean; theme: 'light' | 'dark' }) {
  if (!slaDue) return <span style={{ color: theme === 'dark' ? '#8B949E' : '#aaa', fontSize: '11px' }}>—</span>;
  const breached = madeSla === false;
  const met = madeSla === true;
  const bg = breached ? (theme === 'dark' ? '#3D1111' : '#FDE7E7') : met ? (theme === 'dark' ? '#1A3320' : '#E3F2E8') : (theme === 'dark' ? '#333' : '#EAEAEA');
  const color = breached ? (theme === 'dark' ? '#F87171' : '#A80000') : met ? (theme === 'dark' ? '#6EE7B7' : '#2E844A') : (theme === 'dark' ? '#aaa' : '#555');
  const label = breached ? '⚠ Breached' : met ? '✓ Met' : slaDue;
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '15px', fontSize: '11px', fontWeight: 500, background: bg, color }}>
      {label}
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const useStyles = makeStyles({
  shell: {
    margin: '0 auto',
    padding: '16px',
    fontFamily: tokens.fontFamilyBase,
    fontSize: '13px',
    color: tokens.colorNeutralForeground1,
  },
  card: {
    borderRadius: '6px',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    overflowX: 'auto' as const,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    color: '#fff',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerCell: {
    fontWeight: 700 as any,
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    padding: '8px 12px',
    color: tokens.colorNeutralForeground3,
  },
  cell: {
    padding: '8px 12px',
    verticalAlign: 'middle',
    fontSize: '13px',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    maxWidth: '180px',
    color: tokens.colorNeutralForeground1,
  },
  formPanel: {
    padding: '16px',
    borderLeft: `4px solid ${tokens.colorBrandBackground}`,
  },
  formTitle: {
    fontSize: '15px',
    fontWeight: 700 as any,
    marginBottom: '12px',
    color: tokens.colorNeutralForeground1,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px 12px',
    marginBottom: '12px',
  },
  formActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  empty: {
    padding: '16px',
    textAlign: 'center' as const,
    fontSize: '13px',
  },
  mcpFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 16px',
    fontSize: '11px',
  },
  subTableWrap: {
    padding: '12px 16px',
  },
});

// ── Inline select ─────────────────────────────────────────────────────────
function FormSelect({ label, value, options, labels, onChange, theme, disabled }: {
  label: string;
  value: string;
  options: string[];
  labels?: Record<string, string>;
  onChange: (v: string) => void;
  theme: 'light' | 'dark';
  disabled?: boolean;
}) {
  const t = now(theme);
  return (
    <Field label={label} size="small">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%', padding: '5px 8px', borderRadius: '4px',
          border: `1px solid ${t.border}`, background: disabled ? t.surface : t.surface,
          color: t.text, fontSize: '13px', fontFamily: 'inherit', height: '32px',
          opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : undefined,
        }}
      >
        <option value="">— Select —</option>
        {options.map((o) => <option key={o} value={o}>{labels?.[o] || o}</option>)}
      </select>
    </Field>
  );
}


// ── Now Footer ──────────────────────────────────────────────────────────────
function NowFooter({ theme }: { theme: 'light' | 'dark' }) {
  const styles = useStyles();
  const t = now(theme);
  const { openExternal } = useMcpBridge();
  return (
    <div className={styles.mcpFooter} style={{
      background: theme === 'dark' ? '#1C2229' : '#F4F5F7',
      borderTop: `1px solid ${t.border}`, color: t.textWeak,
    }}>
      <span>⚡ <strong>MCP Widget</strong> · ServiceNow ITSM</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => openExternal('https://developer.servicenow.com')}>
          Open in ServiceNow ↗
        </span>
        <span>⚓ GTC</span>
      </div>
    </div>
  );
}

// ── Request Items sub-table ─────────────────────────────────────────────────
function RequestItemsTable({ items, callTool, toast, theme }: {
  items: RequestItem[];
  callTool: (name: string, args?: Record<string, any>) => Promise<any>;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  theme: 'light' | 'dark';
}) {
  const t = now(theme);
  const [editingQty, setEditingQty] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const saveQty = async (item: RequestItem) => {
    const qty = editingQty[item.sys_id] ?? String(item.quantity);
    setSavingId(item.sys_id);
    try {
      await callTool('sn__update_request_item', { sys_id: item.sys_id, quantity: qty });
      toast('✓ Quantity updated');
    } catch (e: any) {
      toast(e.message || 'Failed to update quantity', 'error');
    } finally {
      setSavingId(null);
    }
  };

  const subHeaderStyle: React.CSSProperties = {
    fontWeight: 700, fontSize: '9px', textTransform: 'uppercase',
    letterSpacing: '0.5px', padding: '4px 8px', color: t.textWeak,
    background: 'transparent',
  };
  const subCellStyle: React.CSSProperties = {
    padding: '4px 8px', fontSize: '12px', verticalAlign: 'middle',
    borderBottom: `1px solid ${t.border}`,
  };

  if (items.length === 0) {
    return <div style={{ padding: '8px', color: t.textWeak, fontSize: '12px', fontStyle: 'italic' }}>No request items.</div>;
  }

  return (
    <div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: t.text, marginBottom: '4px' }}>
        📦 Request Items ({items.length})
      </div>
      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow>
            <TableHeaderCell style={subHeaderStyle}>Item</TableHeaderCell>
            <TableHeaderCell style={subHeaderStyle}>Category</TableHeaderCell>
            <TableHeaderCell style={subHeaderStyle}>Qty</TableHeaderCell>
            <TableHeaderCell style={subHeaderStyle}>Stage</TableHeaderCell>
            <TableHeaderCell style={subHeaderStyle}>Price</TableHeaderCell>
            <TableHeaderCell style={{ ...subHeaderStyle, width: 60 }} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.sys_id}>
              <TableCell style={subCellStyle}>{item.short_description || '—'}</TableCell>
              <TableCell style={subCellStyle}>{item.cat_item || '—'}</TableCell>
              <TableCell style={subCellStyle}>
                <input
                  type="number"
                  min="1"
                  value={editingQty[item.sys_id] ?? String(item.quantity || 1)}
                  onChange={(e) => setEditingQty(prev => ({ ...prev, [item.sys_id]: e.target.value }))}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: '56px', padding: '3px 6px', borderRadius: '4px',
                    border: `1px solid ${t.border}`, background: t.surface,
                    color: t.text, fontSize: '12px', textAlign: 'center',
                    fontFamily: 'inherit',
                  }}
                />
              </TableCell>
              <TableCell style={subCellStyle}>{item.stage || '—'}</TableCell>
              <TableCell style={subCellStyle}>{item.price || '—'}</TableCell>
              <TableCell style={subCellStyle}>
                <button
                  onClick={(e) => { e.stopPropagation(); saveQty(item); }}
                  disabled={savingId === item.sys_id}
                  style={{
                    padding: '3px 8px', borderRadius: '3px', border: 'none',
                    background: '#293E40', color: '#fff', fontSize: '10px',
                    fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                    opacity: savingId === item.sys_id ? 0.6 : 1,
                  }}
                >
                  {savingId === item.sys_id ? '…' : 'Save'}
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Incidents View ──────────────────────────────────────────────────────────
function IncidentsView({ items: initItems, callTool, toast, theme, cacheInfo: initCacheInfo }: {
  items: Incident[];
  callTool: (name: string, args?: Record<string, any>) => Promise<any>;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  theme: 'light' | 'dark';
  cacheInfo?: { hit: boolean; cached_at: string } | null;
}) {
  const styles = useStyles();
  const t = now(theme);
  // localItems lets widget-initiated tool calls update the visible list. Pure
  // props-driven would discard widget callTool results (widgetCallDepth > 0
  // suppresses host-bridge toolData updates by design).
  const [localItems, setLocalItems] = useState<Incident[]>(initItems);
  const [cacheInfo, setCacheInfo] = useState(initCacheInfo);
  useEffect(() => { setLocalItems(initItems); setCacheInfo(initCacheInfo); }, [initItems]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<Incident | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await callTool('sn__get_incidents', { refresh: true });
      setLocalItems(res?.incidents || []);
      setCacheInfo(res?._cache);
    } catch (e: any) { toast(e.message || 'Refresh failed', 'error'); }
    finally { setRefreshing(false); }
  };
  // Form shape mirrors the tool args exactly. FK display names live on
  // `editingRecord`, not on `form`, so spreading `form` into create/update
  // never sends a display name through an FK slot.
  const [form, setForm] = useState({
    short_description: '', description: '', priority: '3', impact: '2', state: 'New', category: 'inquiry',
    assigned_to_name: '', caller_name: '', work_note: '',
  });

  const openEdit = (inc: any) => {
    setCreating(false);
    setEditingId(inc.sys_id);
    setEditingRecord(inc);
    setForm({
      short_description: inc.short_description || '',
      description: inc.description || '',
      priority: String(inc.priority).charAt(0) || '3',
      impact: String((inc as any).impact || '').charAt(0) || '2',
      state: inc.state || 'New',
      category: (inc.category || 'inquiry').toLowerCase(),
      assigned_to_name: '', caller_name: '',
      work_note: '',
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setEditingRecord(null);
    setCreating(true);
    setForm({ short_description: '', description: '', priority: '3', impact: '2', state: 'New', category: 'inquiry', assigned_to_name: '', caller_name: '', work_note: '' });
  };

  const cancel = () => { setEditingId(null); setEditingRecord(null); setCreating(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result: any = creating
        ? await callTool('sn__create_incident', form)
        : await callTool('sn__update_incident', { sys_id: editingId, ...form });
      // Alert path — server returned a non-fatal FK lookup miss with
      // suggestions. Surface the message persistently and keep the form
      // open so the user can correct the assignee/caller and re-submit.
      if (result && result.type === 'alert') {
        toast(result.message || 'Cannot complete — please correct and retry.', 'info', 0);
        return;
      }
      toast(creating ? '✓ Incident created' : '✓ Incident updated');
      if (!creating) setLastSavedId(editingId);
      cancel();
      const refreshed = await callTool('sn__get_incidents', { refresh: true });
      if (refreshed?.incidents) { setLocalItems(refreshed.incidents); setCacheInfo(refreshed._cache); }
    } catch (e: any) { toast(e.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    if (lastSavedId) {
      const t2 = setTimeout(() => setLastSavedId(null), 4800);
      return () => clearTimeout(t2);
    }
  }, [lastSavedId]);

  const formBg = theme === 'dark' ? '#1A2E25' : '#F4F5F7';
  const colSpan = 9;

  const cellStyle: React.CSSProperties = {
    padding: '8px 10px', fontSize: '12px', whiteSpace: 'normal',
    maxWidth: '180px', verticalAlign: 'top', lineHeight: 1.4,
  };
  const headerCellStyle: React.CSSProperties = {
    fontWeight: 700, fontSize: '10px', textTransform: 'uppercase',
    letterSpacing: '0.5px', padding: '6px 10px', color: t.textWeak,
  };

  const renderForm = (title: string) => (
    <TableRow>
      <TableCell colSpan={colSpan} style={{ padding: 0 }}>
        <div className={styles.formPanel} style={{ background: formBg, borderColor: t.brand }}>
          <div className={styles.formTitle} style={{ color: '#6E50E8' }}>{title}</div>
          <div className={styles.formGrid}>
            <Field label="Short Description" size="small" style={{ gridColumn: '1 / -1' }}>
              <Input size="small" value={form.short_description} onChange={(_, d) => setForm(f => ({ ...f, short_description: d.value }))} />
            </Field>
            <Field label="Description" size="small" style={{ gridColumn: '1 / -1' }}>
              <Input size="small" value={form.description} onChange={(_, d) => setForm(f => ({ ...f, description: d.value }))} />
            </Field>
            <FormSelect label="Priority" value={form.priority} options={PRIORITIES} labels={PRIORITY_LABELS} onChange={v => setForm(f => ({ ...f, priority: v }))} theme={theme} disabled />
            <FormSelect label="Impact" value={form.impact} options={FORM_IMPACTS} labels={FORM_IMPACT_LABELS} onChange={v => setForm(f => ({ ...f, impact: v }))} theme={theme} />
            <FormSelect label="State" value={form.state} options={INCIDENT_STATES} onChange={v => setForm(f => ({ ...f, state: v }))} theme={theme} />
            <FormSelect label="Category" value={form.category} options={CATEGORIES} onChange={v => setForm(f => ({ ...f, category: v }))} theme={theme} />
            {creating ? (
              <>
                <Field label="Assigned To (type full name) 🔗" size="small">
                  <Input size="small" value={form.assigned_to_name} onChange={(_, d) => setForm(f => ({ ...f, assigned_to_name: d.value }))} placeholder="e.g. Alice Chen" />
                </Field>
                <Field label="Caller (type full name) 🔗" size="small">
                  <Input size="small" value={form.caller_name} onChange={(_, d) => setForm(f => ({ ...f, caller_name: d.value }))} placeholder="e.g. Joe Smith" />
                </Field>
              </>
            ) : (
              <>
                <Field label="Assigned To" size="small">
                  <Text style={{ fontSize: '12px', color: t.text, padding: '4px 8px', display: 'block' }}>{editingRecord?.assigned_to || '—'}</Text>
                </Field>
                <Field label="Caller" size="small">
                  <Text style={{ fontSize: '12px', color: t.text, padding: '4px 8px', display: 'block' }}>{editingRecord?.caller_id || '—'}</Text>
                </Field>
              </>
            )}
            {!creating && (
              <Field label="Work Note (appended to journal)" size="small" style={{ gridColumn: '1 / -1' }}>
                <Input size="small" value={form.work_note} onChange={(_, d) => setForm(f => ({ ...f, work_note: d.value }))} placeholder="Optional internal note…" />
              </Field>
            )}
          </div>
          <div className={styles.formActions}>
            <Button appearance="secondary" size="small" onClick={cancel} disabled={saving}
              style={{ borderRadius: '4px', height: '32px', padding: '0 16px', border: `1px solid ${t.border}` }}>
              Cancel
            </Button>
            <Button appearance="primary" size="small" onClick={handleSave} disabled={saving}
              style={{ background: '#6E50E8', borderColor: '#6E50E8', borderRadius: '4px', height: '32px', padding: '0 16px' }}>
              {saving ? 'Saving…' : creating ? '✓ Create' : '✓ Save'}
            </Button>
          </div>
          {creating && (
            <FkHint
              fields={[
                { label: 'Assigned To (type full name) 🔗' },
                { label: 'Caller (type full name) 🔗' },
              ]}
              systemName="ServiceNow"
            />
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}`, background: t.surface }}>
      <ViewHeader icon={<AlertRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Incidents" count={localItems.length}
        brand="#6E50E8"
        cacheInfo={cacheInfo} onRefresh={handleRefresh} refreshing={refreshing} />

      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            <TableHeaderCell style={headerCellStyle}>Number</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Short Description</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Priority</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>State</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Category</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Assigned To</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Caller</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>SLA</TableHeaderCell>
            <TableHeaderCell style={{ ...headerCellStyle, width: 50 }} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {creating && renderForm('➕ New Incident')}
          {localItems.length === 0 && !creating && (
            <TableRow>
              <TableCell colSpan={colSpan} className={styles.empty}>
                <Text>No incidents found.</Text>
              </TableCell>
            </TableRow>
          )}
          {localItems.map((inc, idx) => (
            <React.Fragment key={inc.sys_id}>
              <TableRow
                className="snow-row"
                style={{
                  borderBottom: idx === localItems.length - 1 ? 'none' : `1px solid ${t.border}`,
                  ...(lastSavedId === inc.sys_id ? { animation: 'snowRowFlash 4.5s ease-out' } : {}),
                }}
              >
                <TableCell style={cellStyle}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#6E50E8' }}>
                    {inc.number}
                  </span>
                </TableCell>
                <TableCell style={{ ...cellStyle, maxWidth: '220px' }}>{inc.short_description || '—'}</TableCell>
                <TableCell style={cellStyle}><PriorityPill priority={inc.priority} theme={theme} /></TableCell>
                <TableCell style={cellStyle}><StatePill state={inc.state} theme={theme} /></TableCell>
                <TableCell style={cellStyle}>{(inc as any).category || '—'}</TableCell>
                <TableCell style={cellStyle}>{inc.assigned_to || '—'}</TableCell>
                <TableCell style={cellStyle}>{(inc as any).caller_id || '—'}</TableCell>
                <TableCell style={cellStyle}><SlaPill slaDue={inc.sla_due} madeSla={inc.made_sla} theme={theme} /></TableCell>
                <TableCell style={cellStyle}>
                  <button title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(inc); }} className="snow-edit-btn"
                    style={{
                      width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${t.border}`, borderRadius: '4px', background: 'transparent', cursor: 'pointer',
                      color: t.textWeak, fontSize: '14px', padding: 0,
                    }}><EditRegular style={{ fontSize: "16px" }} /></button>
                </TableCell>
              </TableRow>
              {editingId === inc.sys_id && renderForm('Edit Incident ' + inc.number)}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>

      <NowFooter theme={theme} />
    </div>
  );
}

// ── Requests View ───────────────────────────────────────────────────────────
function RequestsView({ items: initItems, callTool, toast, theme, cacheInfo: initCacheInfo }: {
  items: ServiceRequest[];
  callTool: (name: string, args?: Record<string, any>) => Promise<any>;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  theme: 'light' | 'dark';
  cacheInfo?: { hit: boolean; cached_at: string } | null;
}) {
  const styles = useStyles();
  const t = now(theme);
  const [localItems, setLocalItems] = useState<ServiceRequest[]>(initItems);
  const [cacheInfo, setCacheInfo] = useState(initCacheInfo);
  useEffect(() => { setLocalItems(initItems); setCacheInfo(initCacheInfo); }, [initItems]);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await callTool('sn__get_requests', { refresh: true });
      setLocalItems(res?.requests || []);
      setCacheInfo(res?._cache);
    } catch (e: any) { toast(e.message || 'Refresh failed', 'error'); }
    finally { setRefreshing(false); }
  };
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reqItems, setReqItems] = useState<Record<string, RequestItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<ServiceRequest | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  // Form mirrors tool args. FK display name lives on editingRecord, not form.
  const [form, setForm] = useState({
    short_description: '', description: '', priority: '3', approval: 'not requested',
    request_state: '', requested_for_name: '', due_date: '', work_note: '',
  });

  const toggleExpand = async (req: ServiceRequest) => {
    if (expandedId === req.sys_id) { setExpandedId(null); return; }
    setExpandedId(req.sys_id);
    if (!reqItems[req.sys_id]) {
      setLoadingItems(req.sys_id);
      try {
        const result = await callTool('sn__get_request_items', { request_sys_id: req.sys_id });
        setReqItems(prev => ({ ...prev, [req.sys_id]: result?.items || [] }));
      } catch {
        setReqItems(prev => ({ ...prev, [req.sys_id]: [] }));
      } finally {
        setLoadingItems(null);
      }
    }
  };

  const openEdit = (req: any) => {
    setCreating(false);
    setEditingId(req.sys_id);
    setEditingRecord(req);
    setForm({
      short_description: req.short_description || '',
      description: req.description || '',
      priority: String(req.priority).charAt(0) || '3',
      approval: (req.approval || 'not requested').toLowerCase(),
      request_state: req.request_state || '',
      requested_for_name: '',
      due_date: req.due_date || '',
      work_note: '',
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setEditingRecord(null);
    setCreating(true);
    setForm({ short_description: '', description: '', priority: '3', approval: 'not requested', request_state: '', requested_for_name: '', due_date: '', work_note: '' });
  };

  const cancel = () => { setEditingId(null); setEditingRecord(null); setCreating(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      let result: any;
      if (creating) {
        result = await callTool('sn__create_request', form);
        if (result && result.type === 'alert') {
          toast(result.message || 'Cannot complete — please correct and retry.', 'info', 0);
          return;
        }
        toast('✓ Request created');
      } else {
        await callTool('sn__update_request', { sys_id: editingId, ...form });
        toast('✓ Request updated');
        setLastSavedId(editingId);
      }
      cancel();
      const refreshed = await callTool('sn__get_requests', { refresh: true });
      if (refreshed?.requests) { setLocalItems(refreshed.requests); setCacheInfo(refreshed._cache); }
    } catch (e: any) { toast(e.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    if (lastSavedId) {
      const t2 = setTimeout(() => setLastSavedId(null), 4800);
      return () => clearTimeout(t2);
    }
  }, [lastSavedId]);

  const formBg = theme === 'dark' ? '#1A2E25' : '#F4F5F7';
  const colSpan = 9;

  const cellStyle: React.CSSProperties = {
    padding: '8px 10px', fontSize: '12px', whiteSpace: 'normal',
    maxWidth: '180px', verticalAlign: 'top', lineHeight: 1.4,
  };
  const headerCellStyle: React.CSSProperties = {
    fontWeight: 700, fontSize: '10px', textTransform: 'uppercase',
    letterSpacing: '0.5px', padding: '6px 10px', color: t.textWeak,
  };

  const renderForm = (title: string) => (
    <TableRow>
      <TableCell colSpan={colSpan} style={{ padding: 0 }}>
        <div className={styles.formPanel} style={{ background: formBg, borderColor: t.brand }}>
          <div className={styles.formTitle} style={{ color: '#293E40' }}>{title}</div>
          <div className={styles.formGrid}>
            <Field label="Short Description" size="small" style={{ gridColumn: '1 / -1' }}>
              <Input size="small" value={form.short_description} onChange={(_, d) => setForm(f => ({ ...f, short_description: d.value }))} />
            </Field>
            <Field label="Description" size="small" style={{ gridColumn: '1 / -1' }}>
              <Input size="small" value={form.description} onChange={(_, d) => setForm(f => ({ ...f, description: d.value }))} />
            </Field>
            <FormSelect label="Priority" value={form.priority} options={PRIORITIES} labels={PRIORITY_LABELS} onChange={v => setForm(f => ({ ...f, priority: v }))} theme={theme} disabled />
            {!creating && (
              <>
                <FormSelect label="Approval" value={form.approval} options={APPROVAL_OPTIONS} onChange={v => setForm(f => ({ ...f, approval: v }))} theme={theme} />
                <Field label="Request State" size="small">
                  <Input size="small" value={form.request_state} onChange={(_, d) => setForm(f => ({ ...f, request_state: d.value }))} />
                </Field>
              </>
            )}
            {creating ? (
              <Field label="Requested for (type full name) 🔗" size="small">
                <Input size="small" value={form.requested_for_name} onChange={(_, d) => setForm(f => ({ ...f, requested_for_name: d.value }))} placeholder="e.g. Joe Smith" />
              </Field>
            ) : (
              <Field label="Requested For" size="small">
                <Text style={{ fontSize: '12px', color: t.text, padding: '4px 8px', display: 'block' }}>{editingRecord?.requested_for || '—'}</Text>
              </Field>
            )}
            <Field label="Due Date (YYYY-MM-DD)" size="small">
              <Input size="small" value={form.due_date} onChange={(_, d) => setForm(f => ({ ...f, due_date: d.value }))} />
            </Field>
            {!creating && (
              <Field label="Work Note (appended to journal)" size="small" style={{ gridColumn: '1 / -1' }}>
                <Input size="small" value={form.work_note} onChange={(_, d) => setForm(f => ({ ...f, work_note: d.value }))} placeholder="Optional internal note…" />
              </Field>
            )}
          </div>
          <div className={styles.formActions}>
            <Button appearance="secondary" size="small" onClick={cancel} disabled={saving}
              style={{ borderRadius: '4px', height: '32px', padding: '0 16px', border: `1px solid ${t.border}` }}>
              Cancel
            </Button>
            <Button appearance="primary" size="small" onClick={handleSave} disabled={saving}
              style={{ background: '#293E40', borderColor: '#293E40', borderRadius: '4px', height: '32px', padding: '0 16px' }}>
              {saving ? 'Saving…' : creating ? '✓ Create' : '✓ Save'}
            </Button>
          </div>
          {creating && (
            <FkHint
              fields={[{ label: 'Requested for (type full name) 🔗' }]}
              systemName="ServiceNow"
            />
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}`, background: t.surface }}>
      <ViewHeader icon={<DocumentBulletListRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Service Requests" count={localItems.length}
        brand={tokens.colorPaletteCornflowerForeground2}
        cacheInfo={cacheInfo} onRefresh={handleRefresh} refreshing={refreshing} />

      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            <TableHeaderCell style={headerCellStyle}>Number</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Short Description</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>State</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Priority</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Approval</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Requested For</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Due Date</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>SLA</TableHeaderCell>
            <TableHeaderCell style={{ ...headerCellStyle, width: 50 }} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {creating && renderForm('➕ New Request')}
          {localItems.length === 0 && !creating && (
            <TableRow>
              <TableCell colSpan={colSpan} className={styles.empty}>
                <Text>No requests found.</Text>
              </TableCell>
            </TableRow>
          )}
          {localItems.map((req, idx) => (
            <React.Fragment key={req.sys_id}>
              <TableRow
                className="snow-row"
                onClick={() => toggleExpand(req)}
                style={{
                  cursor: 'pointer',
                  borderBottom: idx === localItems.length - 1 && expandedId !== req.sys_id ? 'none' : `1px solid ${t.border}`,
                  background: expandedId === req.sys_id ? (theme === 'dark' ? '#1A2E25' : '#EEF6F1') : 'transparent',
                  ...(lastSavedId === req.sys_id ? { animation: 'snowRowFlash 4.5s ease-out' } : {}),
                }}
              >
                <TableCell style={cellStyle}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#293E40' }}>
                    {expandedId === req.sys_id ? '▼' : '▶'} {req.number}
                  </span>
                </TableCell>
                <TableCell style={{ ...cellStyle, maxWidth: '220px' }}>{req.short_description || '—'}</TableCell>
                <TableCell style={cellStyle}><StatePill state={req.request_state} theme={theme} /></TableCell>
                <TableCell style={cellStyle}><PriorityPill priority={req.priority} theme={theme} /></TableCell>
                <TableCell style={cellStyle}><ApprovalPill approval={req.approval} theme={theme} /></TableCell>
                <TableCell style={cellStyle}>{(req as any).requested_for || '—'}</TableCell>
                <TableCell style={cellStyle}>{(req as any).due_date || '—'}</TableCell>
                <TableCell style={cellStyle}><SlaPill slaDue={req.sla_due} madeSla={req.made_sla} theme={theme} /></TableCell>
                <TableCell style={cellStyle}>
                  <button title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(req); }} className="snow-edit-btn"
                    style={{
                      width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${t.border}`, borderRadius: '4px', background: 'transparent', cursor: 'pointer',
                      color: t.textWeak, fontSize: '14px', padding: 0,
                    }}><EditRegular style={{ fontSize: "16px" }} /></button>
                </TableCell>
              </TableRow>
              {editingId === req.sys_id && renderForm('Edit Request ' + req.number)}
              {expandedId === req.sys_id && (
                <TableRow>
                  <TableCell colSpan={colSpan} style={{ padding: 0 }}>
                    <div className={styles.subTableWrap} style={{
                      background: theme === 'dark' ? '#1A2E25' : '#EEF6F1',
                      borderBottom: `1px solid ${t.border}`,
                    }}>
                      {loadingItems === req.sys_id ? (
                        <div style={{ padding: '8px', color: t.textWeak, fontSize: '12px', fontStyle: 'italic' }}>
                          Fetching request items…
                        </div>
                      ) : (
                        <RequestItemsTable items={reqItems[req.sys_id] || []} callTool={callTool} toast={toast} theme={theme} />
                      )}
                      <button onClick={() => setExpandedId(null)} style={{
                        marginTop: '8px', padding: '4px 12px', borderRadius: '4px',
                        border: `1px solid ${t.border}`, background: 'transparent',
                        color: t.textWeak, fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
                      }}>▲ Collapse</button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>

      <NowFooter theme={theme} />
    </div>
  );
}

// ── Change Tasks sub-table ──────────────────────────────────────────────────
function ChangeTasksTable({ items, theme }: { items: ChangeTask[]; theme: 'light' | 'dark' }) {
  const t = now(theme);
  const subHeaderStyle: React.CSSProperties = {
    fontWeight: 700, fontSize: '9px', textTransform: 'uppercase',
    letterSpacing: '0.5px', padding: '4px 8px', color: t.textWeak, background: 'transparent',
  };
  const subCellStyle: React.CSSProperties = {
    padding: '4px 8px', fontSize: '12px', verticalAlign: 'middle', borderBottom: `1px solid ${t.border}`,
  };
  if (items.length === 0) {
    return <div style={{ padding: '8px', color: t.textWeak, fontSize: '12px', fontStyle: 'italic' }}>No change tasks.</div>;
  }
  return (
    <div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: t.text, marginBottom: '4px' }}>🔧 Change Tasks ({items.length})</div>
      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow>
            <TableHeaderCell style={subHeaderStyle}>Number</TableHeaderCell>
            <TableHeaderCell style={subHeaderStyle}>Short Description</TableHeaderCell>
            <TableHeaderCell style={subHeaderStyle}>State</TableHeaderCell>
            <TableHeaderCell style={subHeaderStyle}>Assigned To</TableHeaderCell>
            <TableHeaderCell style={subHeaderStyle}>Planned Start</TableHeaderCell>
            <TableHeaderCell style={subHeaderStyle}>Planned End</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(task => (
            <TableRow key={task.sys_id}>
              <TableCell style={subCellStyle}><span style={{ fontFamily: 'monospace', color: '#293E40', fontWeight: 500 }}>{task.number}</span></TableCell>
              <TableCell style={subCellStyle}>{task.short_description || '—'}</TableCell>
              <TableCell style={subCellStyle}><StatePill state={task.state} theme={theme} /></TableCell>
              <TableCell style={subCellStyle}>{task.assigned_to || '—'}</TableCell>
              <TableCell style={subCellStyle}>{task.planned_start || '—'}</TableCell>
              <TableCell style={subCellStyle}>{task.planned_end || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Changes View ────────────────────────────────────────────────────────────
function ChangesView({ items: initItems, callTool, toast, theme, cacheInfo: initCacheInfo }: {
  items: ChangeRequest[];
  callTool: (name: string, args?: Record<string, any>) => Promise<any>;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  theme: 'light' | 'dark';
  cacheInfo?: { hit: boolean; cached_at: string } | null;
}) {
  const styles = useStyles();
  const t = now(theme);
  const [localItems, setLocalItems] = useState<ChangeRequest[]>(initItems);
  const [cacheInfo, setCacheInfo] = useState(initCacheInfo);
  useEffect(() => { setLocalItems(initItems); setCacheInfo(initCacheInfo); }, [initItems]);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await callTool('sn__get_change_requests', { refresh: true });
      setLocalItems(res?.items || []);
      setCacheInfo(res?._cache);
    } catch (e: any) { toast(e.message || 'Refresh failed', 'error'); }
    finally { setRefreshing(false); }
  };
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [changeTasks, setChangeTasks] = useState<Record<string, ChangeTask[]>>({});
  const [loadingTasks, setLoadingTasks] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<ChangeRequest | null>(null);
  // Form mirrors tool args. FK display name lives on editingRecord, not form.
  const [form, setForm] = useState({ short_description: '', description: '', category: 'Other', type: 'normal', risk: '4', priority: '3', state: '', assigned_to_name: '', planned_start_date: '', planned_end_date: '', work_note: '' });

  const openCreate = () => { setEditingId(null); setEditingRecord(null); setCreating(true); setForm({ short_description: '', description: '', category: 'Other', type: 'normal', risk: '4', priority: '3', state: '', assigned_to_name: '', planned_start_date: '', planned_end_date: '', work_note: '' }); };
  const openEdit = (cr: any) => { setCreating(false); setEditingId(cr.sys_id); setEditingRecord(cr); setForm({ short_description: cr.short_description || '', description: cr.description || '', category: cr.category || 'Other', type: cr.type || 'normal', risk: cr.risk || '4', priority: String(cr.priority).charAt(0) || '3', state: cr.state || '', assigned_to_name: '', planned_start_date: cr.planned_start || '', planned_end_date: cr.planned_end || '', work_note: '' }); };
  const cancel = () => { setCreating(false); setEditingId(null); setEditingRecord(null); };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!changeTasks[id]) {
      setLoadingTasks(id);
      try {
        const result = await callTool('sn__get_change_tasks', { change_sys_id: id });
        setChangeTasks(prev => ({ ...prev, [id]: result?.items || [] }));
      } catch {
        setChangeTasks(prev => ({ ...prev, [id]: [] }));
      } finally {
        setLoadingTasks(null);
      }
    }
  };

  useEffect(() => {
    if (lastSavedId) { const x = setTimeout(() => setLastSavedId(null), 4800); return () => clearTimeout(x); }
  }, [lastSavedId]);

  const handleSave = async () => {
    if (!form.short_description.trim() && !editingId) { toast('Short Description is required', 'error'); return; }
    setSaving(true);
    try {
      let result: any;
      if (creating) {
        result = await callTool('sn__create_change_request', form);
        if (result && result.type === 'alert') {
          toast(result.message || 'Cannot complete — please correct and retry.', 'info', 0);
          return;
        }
        toast('✓ Change Request created');
      } else {
        result = await callTool('sn__update_change_request', { sys_id: editingId, ...form });
        toast('✓ Change Request updated');
        setLastSavedId(editingId);
      }
      cancel();
      // Use items from create/update response first; fall back to explicit refresh
      let refreshed = result;
      if (!refreshed?.items) { refreshed = await callTool('sn__get_change_requests', { refresh: true }); }
      if (refreshed?.items) { setLocalItems(refreshed.items); setCacheInfo(refreshed._cache); }
    } catch (e: any) {
      toast(e.message || 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cellStyle: React.CSSProperties = {
    padding: '8px 10px', fontSize: '12px', whiteSpace: 'normal',
    maxWidth: '180px', verticalAlign: 'top', lineHeight: 1.4,
  };
  const headerCellStyle: React.CSSProperties = {
    fontWeight: 700, fontSize: '10px', textTransform: 'uppercase',
    letterSpacing: '0.5px', padding: '6px 10px', color: t.textWeak,
  };

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}`, background: t.surface }}>
      <ViewHeader icon={<ArrowSwapRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Change Requests" count={localItems.length}
        brand={tokens.colorPaletteMarigoldForeground2}
        cacheInfo={cacheInfo} onRefresh={handleRefresh} refreshing={refreshing} />

      {creating && (
        <div style={{ padding: '14px 16px', borderLeft: '3px solid #81B5A1', background: theme === 'dark' ? '#1A2E25' : '#F4F5F7', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: '#293E40' }}>➕ New Change Request</div>
          <div className={styles.formGrid}>
            <Field label="Short Description" size="small" style={{ gridColumn: '1 / -1' }}>
              <Input size="small" value={form.short_description} onChange={(_, d) => setForm(f => ({ ...f, short_description: d.value }))} />
            </Field>
            <Field label="Description" size="small" style={{ gridColumn: '1 / -1' }}>
              <Input size="small" value={form.description} onChange={(_, d) => setForm(f => ({ ...f, description: d.value }))} />
            </Field>
            <FormSelect label="Category" value={form.category} options={CHANGE_CATEGORIES} onChange={v => setForm(f => ({ ...f, category: v }))} theme={theme} />
            <FormSelect label="Type" value={form.type} options={CHANGE_TYPES} labels={CHANGE_TYPE_LABELS} onChange={v => setForm(f => ({ ...f, type: v }))} theme={theme} />
            <FormSelect label="Risk" value={form.risk} options={RISK_OPTIONS} labels={RISK_LABELS} onChange={v => setForm(f => ({ ...f, risk: v }))} theme={theme} />
            <FormSelect label="Priority" value={form.priority} options={PRIORITIES} labels={PRIORITY_LABELS} onChange={v => setForm(f => ({ ...f, priority: v }))} theme={theme} disabled />
            <FormSelect label="State" value={form.state} options={CHANGE_STATES} onChange={v => setForm(f => ({ ...f, state: v }))} theme={theme} />
            <Field label="Assigned to (type full name) 🔗" size="small">
              <Input size="small" value={form.assigned_to_name} onChange={(_, d) => setForm(f => ({ ...f, assigned_to_name: d.value }))} placeholder="e.g. Alice Chen" />
            </Field>
            <Field label="Planned Start (YYYY-MM-DD)" size="small">
              <Input size="small" value={form.planned_start_date} onChange={(_, d) => setForm(f => ({ ...f, planned_start_date: d.value }))} />
            </Field>
            <Field label="Planned End (YYYY-MM-DD)" size="small">
              <Input size="small" value={form.planned_end_date} onChange={(_, d) => setForm(f => ({ ...f, planned_end_date: d.value }))} />
            </Field>
          </div>
          <div className={styles.formActions}>
            <Button appearance="secondary" size="small" onClick={cancel} disabled={saving}
              style={{ borderRadius: '4px', height: '32px', padding: '0 16px', border: `1px solid ${t.border}` }}>Cancel</Button>
            <Button appearance="primary" size="small" onClick={handleSave} disabled={saving}
              style={{ background: '#293E40', borderColor: '#293E40', borderRadius: '4px', height: '32px', padding: '0 16px' }}>
              {saving ? 'Saving…' : '✓ Create'}
            </Button>
          </div>
          <FkHint
            fields={[{ label: 'Assigned to (type full name) 🔗' }]}
            systemName="ServiceNow"
          />
        </div>
      )}

      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            <TableHeaderCell style={{ ...headerCellStyle, width: 28 }} />
            <TableHeaderCell style={headerCellStyle}>Number</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Short Description</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>State</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Priority</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Risk</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Category</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Assigned To</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Planned Start</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Planned End</TableHeaderCell>
            <TableHeaderCell style={{ ...headerCellStyle, width: 32 }} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {localItems.length === 0 && (
            <TableRow><TableCell colSpan={11} className={styles.empty}><Text>No change requests found.</Text></TableCell></TableRow>
          )}
          {localItems.map((cr, idx) => (
            <React.Fragment key={cr.sys_id}>
              <TableRow className="snow-row"
                onClick={() => toggleExpand(cr.sys_id)}
                style={{
                  cursor: 'pointer',
                  borderBottom: idx === localItems.length - 1 && expandedId !== cr.sys_id ? 'none' : `1px solid ${t.border}`,
                  background: expandedId === cr.sys_id ? (theme === 'dark' ? '#1A2E25' : '#EEF6F1') : 'transparent',
                  ...(lastSavedId === cr.sys_id ? { animation: 'snowRowFlash 4.5s ease-out' } : {}),
                }}>
                <TableCell style={{ ...cellStyle, width: 28 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: t.textWeak }}>{expandedId === cr.sys_id ? '▼' : '▶'}</span>
                </TableCell>
                <TableCell style={cellStyle}><span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#293E40' }}>{cr.number}</span></TableCell>
                <TableCell style={{ ...cellStyle, maxWidth: '220px' }}>{cr.short_description || '—'}</TableCell>
                <TableCell style={cellStyle}><StatePill state={cr.state} theme={theme} /></TableCell>
                <TableCell style={cellStyle}><PriorityPill priority={cr.priority} theme={theme} /></TableCell>
                <TableCell style={cellStyle}><RiskPill risk={cr.risk} theme={theme} /></TableCell>
                <TableCell style={cellStyle}>{cr.category || '—'}</TableCell>
                <TableCell style={cellStyle}>{(cr as any).assigned_to || '—'}</TableCell>
                <TableCell style={cellStyle}>{(cr as any).planned_start || '—'}</TableCell>
                <TableCell style={cellStyle}>{(cr as any).planned_end || '—'}</TableCell>
                <TableCell style={cellStyle}>
                  <button title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(cr); }} className="snow-edit-btn"
                    style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.border}`, borderRadius: '4px', background: 'transparent', cursor: 'pointer', color: t.textWeak, fontSize: '14px', padding: 0 }}><EditRegular style={{ fontSize: "16px" }} /></button>
                </TableCell>
              </TableRow>
              {editingId === cr.sys_id && (
                <TableRow>
                  <TableCell colSpan={11} style={{ padding: 0 }}>
                    <div style={{ padding: '14px 16px', borderLeft: '3px solid #81B5A1', background: theme === 'dark' ? '#1A2E25' : '#F4F5F7', borderBottom: `1px solid ${t.border}` }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: '#293E40' }}><EditRegular style={{ fontSize: "16px" }} /> Edit Change Request {cr.number}</div>
                      <div className={styles.formGrid}>
                        <Field label="Short Description" size="small" style={{ gridColumn: '1 / -1' }}>
                          <Input size="small" value={form.short_description} onChange={(_, d) => setForm(f => ({ ...f, short_description: d.value }))} />
                        </Field>
                        <Field label="Description" size="small" style={{ gridColumn: '1 / -1' }}>
                          <Input size="small" value={form.description} onChange={(_, d) => setForm(f => ({ ...f, description: d.value }))} />
                        </Field>
                        <FormSelect label="Category" value={form.category} options={CHANGE_CATEGORIES} onChange={v => setForm(f => ({ ...f, category: v }))} theme={theme} />
                        <FormSelect label="Type" value={form.type} options={CHANGE_TYPES} labels={CHANGE_TYPE_LABELS} onChange={v => setForm(f => ({ ...f, type: v }))} theme={theme} />
                        <FormSelect label="Risk" value={form.risk} options={RISK_OPTIONS} labels={RISK_LABELS} onChange={v => setForm(f => ({ ...f, risk: v }))} theme={theme} />
                        <FormSelect label="Priority" value={form.priority} options={PRIORITIES} labels={PRIORITY_LABELS} onChange={v => setForm(f => ({ ...f, priority: v }))} theme={theme} disabled />
                        <FormSelect label="State" value={form.state} options={CHANGE_STATES} onChange={v => setForm(f => ({ ...f, state: v }))} theme={theme} />
                        <Field label="Assigned To" size="small">
                          <Text style={{ fontSize: '12px', color: t.text, padding: '4px 8px', display: 'block' }}>{editingRecord?.assigned_to || '—'}</Text>
                        </Field>
                        <Field label="Planned Start (YYYY-MM-DD)" size="small">
                          <Input size="small" value={form.planned_start_date} onChange={(_, d) => setForm(f => ({ ...f, planned_start_date: d.value }))} />
                        </Field>
                        <Field label="Planned End (YYYY-MM-DD)" size="small">
                          <Input size="small" value={form.planned_end_date} onChange={(_, d) => setForm(f => ({ ...f, planned_end_date: d.value }))} />
                        </Field>
                        <Field label="Work Note (appended to journal)" size="small" style={{ gridColumn: '1 / -1' }}>
                          <Input size="small" value={form.work_note} onChange={(_, d) => setForm(f => ({ ...f, work_note: d.value }))} placeholder="Optional internal note…" />
                        </Field>
                      </div>
                      <div className={styles.formActions}>
                        <Button appearance="secondary" size="small" onClick={cancel} disabled={saving} style={{ borderRadius: '4px', height: '32px', padding: '0 16px', border: `1px solid ${t.border}` }}>Cancel</Button>
                        <Button appearance="primary" size="small" onClick={handleSave} disabled={saving} style={{ background: '#293E40', borderColor: '#293E40', borderRadius: '4px', height: '32px', padding: '0 16px' }}>
                          {saving ? 'Saving…' : '✓ Save'}
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {expandedId === cr.sys_id && (
                <TableRow>
                  <TableCell colSpan={11} style={{ padding: 0 }}>
                    <div className={styles.subTableWrap} style={{ background: theme === 'dark' ? '#1A2E25' : '#EEF6F1', borderBottom: `1px solid ${t.border}` }}>
                      {loadingTasks === cr.sys_id ? (
                        <div style={{ padding: '8px', color: t.textWeak, fontSize: '12px', fontStyle: 'italic' }}>Fetching change tasks…</div>
                      ) : (
                        <ChangeTasksTable items={changeTasks[cr.sys_id] || []} theme={theme} />
                      )}
                      <button onClick={() => setExpandedId(null)} style={{ marginTop: '8px', padding: '4px 12px', borderRadius: '4px', border: `1px solid ${t.border}`, background: 'transparent', color: t.textWeak, fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>▲ Collapse</button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>

      <NowFooter theme={theme} />
    </div>
  );
}

// ── Problems View ───────────────────────────────────────────────────────────
function ProblemsView({ items: initItems, callTool, toast, theme, cacheInfo: initCacheInfo }: {
  items: Problem[];
  callTool: (n: string, a?: any) => Promise<any>;
  toast: (m: string, t?: any) => void;
  theme: 'light' | 'dark';
  cacheInfo?: { hit: boolean; cached_at: string } | null;
}) {
  const styles = useStyles();
  const t = now(theme);
  const [localItems, setLocalItems] = useState<Problem[]>(initItems);
  const [cacheInfo, setCacheInfo] = useState(initCacheInfo);
  useEffect(() => { setLocalItems(initItems); setCacheInfo(initCacheInfo); }, [initItems]);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await callTool('sn__get_problems', { refresh: true });
      setLocalItems(res?.items || []);
      setCacheInfo(res?._cache);
    } catch (e: any) { toast(e.message || 'Refresh failed', 'error'); }
    finally { setRefreshing(false); }
  };
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<Problem | null>(null);
  const [form, setForm] = useState({ short_description: '', description: '', priority: '3', state: '', assigned_to_name: '', workaround: '', work_note: '' });

  const openCreate = () => { setEditingId(null); setEditingRecord(null); setCreating(true); setForm({ short_description: '', description: '', priority: '3', state: '', assigned_to_name: '', workaround: '', work_note: '' }); };
  const openEdit = (p: any) => { setCreating(false); setEditingId(p.sys_id); setEditingRecord(p); setForm({ short_description: p.short_description || '', description: p.description || '', priority: String(p.priority).charAt(0) || '3', state: p.state || '', assigned_to_name: '', workaround: p.workaround || '', work_note: '' }); };
  const cancel = () => { setEditingId(null); setEditingRecord(null); setCreating(false); };

  useEffect(() => {
    if (lastSavedId) { const x = setTimeout(() => setLastSavedId(null), 4800); return () => clearTimeout(x); }
  }, [lastSavedId]);

  const handleSave = async () => {
    if (!form.short_description.trim() && creating) { toast('Short Description is required', 'error'); return; }
    setSaving(true);
    try {
      let result: any;
      if (creating) {
        result = await callTool('sn__create_problem', form);
        if (result && result.type === 'alert') {
          toast(result.message || 'Cannot complete — please correct and retry.', 'info', 0);
          return;
        }
        toast('✓ Problem created');
      } else {
        const { priority: _p, ...updateFields } = form;
        result = await callTool('sn__update_problem', { sys_id: editingId, ...updateFields });
        toast('✓ Problem updated');
        setLastSavedId(editingId);
      }
      cancel();
      let refreshed = result;
      if (!refreshed?.items) { refreshed = await callTool('sn__get_problems', { refresh: true }); }
      if (refreshed?.items) { setLocalItems(refreshed.items); setCacheInfo(refreshed._cache); }
    } catch (e: any) { toast(e.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const cellStyle: React.CSSProperties = {
    padding: '8px 10px', fontSize: '12px', whiteSpace: 'normal',
    maxWidth: '200px', verticalAlign: 'top', lineHeight: 1.4,
  };
  const headerCellStyle: React.CSSProperties = {
    fontWeight: 700, fontSize: '10px', textTransform: 'uppercase',
    letterSpacing: '0.5px', padding: '6px 10px', color: t.textWeak,
  };

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}`, background: t.surface }}>
      <ViewHeader icon={<BugRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Problems" count={localItems.length}
        brand={tokens.colorPaletteMagentaForeground2}
        cacheInfo={cacheInfo} onRefresh={handleRefresh} refreshing={refreshing} />

      {creating && (
        <div style={{ padding: '14px 16px', borderLeft: '3px solid #81B5A1', background: theme === 'dark' ? '#1A2E25' : '#F4F5F7', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: '#293E40' }}>➕ New Problem</div>
          <div className={styles.formGrid}>
            <Field label="Short Description" size="small" style={{ gridColumn: '1 / -1' }}>
              <Input size="small" value={form.short_description} onChange={(_, d) => setForm(f => ({ ...f, short_description: d.value }))} />
            </Field>
            <Field label="Description" size="small" style={{ gridColumn: '1 / -1' }}>
              <Input size="small" value={form.description} onChange={(_, d) => setForm(f => ({ ...f, description: d.value }))} />
            </Field>
            <FormSelect label="Priority" value={form.priority} options={PRIORITIES} labels={PRIORITY_LABELS} onChange={v => setForm(f => ({ ...f, priority: v }))} theme={theme} disabled />
            <Field label="Assigned to (type full name) 🔗" size="small">
              <Input size="small" value={form.assigned_to_name} onChange={(_, d) => setForm(f => ({ ...f, assigned_to_name: d.value }))} placeholder="e.g. Alice Chen" />
            </Field>
            <Field label="Workaround" size="small" style={{ gridColumn: '1 / -1' }}>
              <Input size="small" value={form.workaround} onChange={(_, d) => setForm(f => ({ ...f, workaround: d.value }))} />
            </Field>
          </div>
          <div className={styles.formActions}>
            <Button appearance="secondary" size="small" onClick={cancel} disabled={saving}
              style={{ borderRadius: '4px', height: '32px', padding: '0 16px', border: `1px solid ${t.border}` }}>Cancel</Button>
            <Button appearance="primary" size="small" onClick={handleSave} disabled={saving}
              style={{ background: '#293E40', borderColor: '#293E40', borderRadius: '4px', height: '32px', padding: '0 16px' }}>
              {saving ? 'Saving…' : '✓ Create'}
            </Button>
          </div>
          <FkHint
            fields={[{ label: 'Assigned to (type full name) 🔗' }]}
            systemName="ServiceNow"
          />
        </div>
      )}

      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            <TableHeaderCell style={headerCellStyle}>Number</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Short Description</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Priority</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>State</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Assigned To</TableHeaderCell>
            <TableHeaderCell style={{ ...headerCellStyle, width: 32 }} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {localItems.length === 0 && (
            <TableRow><TableCell colSpan={6} className={styles.empty}><Text>No problems found.</Text></TableCell></TableRow>
          )}
          {localItems.map((p, idx) => (
            <React.Fragment key={p.sys_id}>
              <TableRow className="snow-row"
                style={{
                  borderBottom: idx === localItems.length - 1 && editingId !== p.sys_id ? 'none' : `1px solid ${t.border}`,
                  ...(lastSavedId === p.sys_id ? { animation: 'snowRowFlash 4.5s ease-out' } : {}),
                }}>
                <TableCell style={cellStyle}><span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#293E40' }}>{p.number}</span></TableCell>
                <TableCell style={{ ...cellStyle, maxWidth: '240px' }}>{p.short_description || '—'}</TableCell>
                <TableCell style={cellStyle}><PriorityPill priority={p.priority} theme={theme} /></TableCell>
                <TableCell style={cellStyle}><StatePill state={p.state} theme={theme} /></TableCell>
                <TableCell style={cellStyle}>{p.assigned_to || '—'}</TableCell>
                <TableCell style={cellStyle}>
                  <button title="Edit" onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="snow-edit-btn"
                    style={{ width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.border}`, borderRadius: '4px', background: 'transparent', cursor: 'pointer', color: t.textWeak, fontSize: '14px', padding: 0 }}>✏️</button>
                </TableCell>
              </TableRow>
              {editingId === p.sys_id && (
                <TableRow>
                  <TableCell colSpan={6} style={{ padding: 0 }}>
                    <div style={{ padding: '14px 16px', borderLeft: '3px solid #81B5A1', background: theme === 'dark' ? '#1A2E25' : '#F4F5F7', borderBottom: `1px solid ${t.border}` }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: '#293E40' }}>✏️ Edit Problem {p.number}</div>
                      <div className={styles.formGrid}>
                        <Field label="Short Description" size="small" style={{ gridColumn: '1 / -1' }}>
                          <Input size="small" value={form.short_description} onChange={(_, d) => setForm(f => ({ ...f, short_description: d.value }))} />
                        </Field>
                        <Field label="Description" size="small" style={{ gridColumn: '1 / -1' }}>
                          <Input size="small" value={form.description} onChange={(_, d) => setForm(f => ({ ...f, description: d.value }))} />
                        </Field>
                        <FormSelect label="Priority" value={form.priority} options={PRIORITIES} labels={PRIORITY_LABELS} onChange={v => setForm(f => ({ ...f, priority: v }))} theme={theme} disabled />
                        <FormSelect label="State" value={form.state} options={PROBLEM_STATES} onChange={v => setForm(f => ({ ...f, state: v }))} theme={theme} />
                        <Field label="Assigned To" size="small">
                          <Text style={{ fontSize: '12px', color: t.text, padding: '4px 8px', display: 'block' }}>{editingRecord?.assigned_to || '—'}</Text>
                        </Field>
                        <Field label="Workaround" size="small" style={{ gridColumn: '1 / -1' }}>
                          <Input size="small" value={form.workaround} onChange={(_, d) => setForm(f => ({ ...f, workaround: d.value }))} placeholder="Optional workaround…" />
                        </Field>
                        <Field label="Work Note (appended to journal)" size="small" style={{ gridColumn: '1 / -1' }}>
                          <Input size="small" value={form.work_note} onChange={(_, d) => setForm(f => ({ ...f, work_note: d.value }))} placeholder="Optional internal note…" />
                        </Field>
                      </div>
                      <div className={styles.formActions}>
                        <Button appearance="secondary" size="small" onClick={cancel} disabled={saving} style={{ borderRadius: '4px', height: '32px', padding: '0 16px', border: `1px solid ${t.border}` }}>Cancel</Button>
                        <Button appearance="primary" size="small" onClick={handleSave} disabled={saving} style={{ background: '#293E40', borderColor: '#293E40', borderRadius: '4px', height: '32px', padding: '0 16px' }}>
                          {saving ? 'Saving…' : '✓ Save'}
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>

      <NowFooter theme={theme} />
    </div>
  );
}

// ── Knowledge View ──────────────────────────────────────────────────────────
function KnowledgeView({ items, theme, cacheInfo }: { items: KnowledgeArticle[]; theme: 'light' | 'dark'; cacheInfo?: { hit: boolean; cached_at: string } | null }) {
  const styles = useStyles();
  const t = now(theme);
  const cellStyle: React.CSSProperties = {
    padding: '8px 10px', fontSize: '12px', whiteSpace: 'normal',
    maxWidth: '200px', verticalAlign: 'top', lineHeight: 1.4,
  };
  const headerCellStyle: React.CSSProperties = {
    fontWeight: 700, fontSize: '10px', textTransform: 'uppercase',
    letterSpacing: '0.5px', padding: '6px 10px', color: t.textWeak,
  };

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}`, background: t.surface }}>
      <ViewHeader icon={<BookRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Knowledge Articles" count={items.length}
        brand={tokens.colorPaletteTealForeground2}
        cacheInfo={cacheInfo} />

      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            <TableHeaderCell style={headerCellStyle}>Number</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Title</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Category</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Author</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Updated On</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Views</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>State</TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow><TableCell colSpan={7} className={styles.empty}><Text>No knowledge articles found.</Text></TableCell></TableRow>
          )}
          {items.map((a, idx) => (
            <TableRow key={a.sys_id} className="snow-row"
              style={{ borderBottom: idx === items.length - 1 ? 'none' : `1px solid ${t.border}` }}>
              <TableCell style={cellStyle}><span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#293E40' }}>{a.number}</span></TableCell>
              <TableCell style={{ ...cellStyle, maxWidth: '260px' }}>{a.short_description || '—'}</TableCell>
              <TableCell style={cellStyle}>{a.category || '—'}</TableCell>
              <TableCell style={cellStyle}>{a.author || '—'}</TableCell>
              <TableCell style={cellStyle}>{(a as any).updated_on?.slice(0, 10) || '—'}</TableCell>
              <TableCell style={cellStyle}>{(a as any).view_count || '—'}</TableCell>
              <TableCell style={cellStyle}><StatePill state={a.state} theme={theme} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <NowFooter theme={theme} />
    </div>
  );
}

// ── Catalog View ────────────────────────────────────────────────────────────
function CatalogView({ items, theme, cacheInfo }: { items: CatalogItem[]; theme: 'light' | 'dark'; cacheInfo?: { hit: boolean; cached_at: string } | null }) {
  const styles = useStyles();
  const t = now(theme);

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}`, background: t.surface }}>
      <ViewHeader icon={<ShoppingBagRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Service Catalog" count={items.length}
        brand={tokens.colorPalettePinkForeground2}
        cacheInfo={cacheInfo} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', padding: '12px' }}>
        {items.length === 0 && (
          <div className={styles.empty} style={{ gridColumn: '1 / -1', color: t.textWeak }}>
            No catalog items found.
          </div>
        )}
        {items.map(item => (
          <div key={item.sys_id} style={{
            border: `1px solid ${t.border}`, borderRadius: '6px', padding: '12px',
            background: t.surface, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: t.text, marginBottom: '4px' }}>{item.name}</div>
            <div style={{ fontSize: '11px', color: t.textWeak, marginBottom: '6px', lineHeight: 1.4 }}>{item.short_description || '—'}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: t.textWeak }}>{item.category || '—'}</span>
              <span style={{
                fontSize: '12px', fontWeight: 600,
                color: item.price ? '#2E844A' : t.textWeak,
              }}>{item.price || 'Free'}</span>
            </div>
            {(item as any).delivery_time && (
              <div style={{ fontSize: '10px', color: t.textWeak, marginTop: '4px', fontStyle: 'italic' }}>
                ⏱ {(item as any).delivery_time}
              </div>
            )}
          </div>
        ))}
      </div>

      <NowFooter theme={theme} />
    </div>
  );
}

// ── Approvals View ──────────────────────────────────────────────────────────
function ApprovalsView({ items, callTool, toast, theme, cacheInfo: _cacheInfo }: {
  items: SnowApproval[];
  callTool: (name: string, args?: Record<string, any>) => Promise<any>;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  theme: 'light' | 'dark';
  cacheInfo?: { hit: boolean; cached_at: string } | null;
}) {
  const styles = useStyles();
  const t = now(theme);
  const [localItems, setLocalItems] = useState(items);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => { setLocalItems(items); }, [items]);

  const act = async (sys_id: string, action: 'approve' | 'reject') => {
    setActingId(sys_id);
    try {
      const res = await callTool(action === 'approve' ? 'sn__approve_record' : 'sn__reject_record', { sys_id });
      if (res?.items !== undefined) setLocalItems(res.items);
      toast(action === 'approve' ? '✓ Approved' : '✓ Rejected', 'success');
    } catch (e: any) {
      toast(e.message || `Failed to ${action}`, 'error');
    } finally {
      setActingId(null);
    }
  };

  const cellStyle: React.CSSProperties = {
    padding: '8px 10px', fontSize: '12px', whiteSpace: 'normal',
    maxWidth: '180px', verticalAlign: 'top', lineHeight: 1.4,
  };
  const headerCellStyle: React.CSSProperties = {
    fontWeight: 700, fontSize: '10px', textTransform: 'uppercase',
    letterSpacing: '0.5px', padding: '6px 10px', color: t.textWeak,
  };

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}`, background: t.surface }}>
      <ViewHeader icon={<CheckmarkRegular style={{ fontSize: '18px', color: '#fff' }} />} title="Pending Approvals" count={localItems.length}
        brand={tokens.colorPalettePlumForeground2} />

      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            <TableHeaderCell style={headerCellStyle}>Approver</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Type</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Document</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Description</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>State</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Due Date</TableHeaderCell>
            <TableHeaderCell style={headerCellStyle}>Created On</TableHeaderCell>
            <TableHeaderCell style={{ ...headerCellStyle, width: 140 }} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {localItems.length === 0 && (
            <TableRow><TableCell colSpan={8} className={styles.empty}><Text>No pending approvals.</Text></TableCell></TableRow>
          )}
          {localItems.map((a, idx) => (
            <TableRow key={a.sys_id} className="snow-row"
              style={{ borderBottom: idx === items.length - 1 ? 'none' : `1px solid ${t.border}` }}>
              <TableCell style={cellStyle}>{a.approver || '—'}</TableCell>
              <TableCell style={cellStyle}>{(a as any).document_type || '—'}</TableCell>
              <TableCell style={cellStyle}><span style={{ fontFamily: 'monospace', color: '#293E40' }}>{(a as any).document_number || a.document || '—'}</span></TableCell>
              <TableCell style={cellStyle}>{(a as any).short_description || '—'}</TableCell>
              <TableCell style={cellStyle}><ApprovalPill approval={a.state} theme={theme} /></TableCell>
              <TableCell style={cellStyle}>{a.due_date || '—'}</TableCell>
              <TableCell style={cellStyle}>{a.created_on || '—'}</TableCell>
              <TableCell style={{ ...cellStyle, maxWidth: 'none' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => act(a.sys_id, 'approve')}
                    disabled={actingId === a.sys_id}
                    style={{ padding: '3px 10px', borderRadius: '3px', border: 'none', background: '#2E844A', color: '#fff', fontSize: '11px', fontWeight: 500, cursor: actingId === a.sys_id ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: actingId === a.sys_id ? 0.6 : 1 }}>
                    ✓
                  </button>
                  <button
                    onClick={() => act(a.sys_id, 'reject')}
                    disabled={actingId === a.sys_id}
                    style={{ padding: '3px 10px', borderRadius: '3px', border: 'none', background: '#D63B20', color: '#fff', fontSize: '11px', fontWeight: 500, cursor: actingId === a.sys_id ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: actingId === a.sys_id ? 0.6 : 1 }}>
                    ✗
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <NowFooter theme={theme} />
    </div>
  );
}

// ── Global CSS for Now Design System ────────────────────────────────────────
const nowStyleId = 'now-global-style';
if (typeof document !== 'undefined' && !document.getElementById(nowStyleId)) {
  const style = document.createElement('style');
  style.id = nowStyleId;
  style.textContent = `
    @keyframes snowRowFlash {
      0%   { background: #E3F2E8; }
      100% { background: transparent; }
    }
    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .snow-edit-btn:hover {
      color: #293E40 !important;
      border-color: #293E40 !important;
    }
    .fui-Input:focus-within {
      box-shadow: 0 0 3px #81B5A1;
      border-color: #81B5A1;
    }
    select:focus {
      outline: none;
      box-shadow: 0 0 3px #81B5A1;
      border-color: #81B5A1 !important;
    }
    .skel {
      height: 14px;
      border-radius: 4px;
      background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    [data-theme="dark"] .skel {
      background: linear-gradient(90deg, #2a2a2a 25%, #3a3a3a 50%, #2a2a2a 75%);
      background-size: 200% 100%;
    }
  `;
  document.head.appendChild(style);
}

// ── HR Cases View ────────────────────────────────────────────────────────────
const HR_PRIORITY_LABELS: Record<string, string> = {
  '1': '1 – Critical', '2': '2 – High', '3': '3 – Moderate', '4': '4 – Low',
};
const HR_PRIORITY_COLORS: Record<string, { bg: string; fg: string }> = {
  '1': { bg: '#FDE7E7', fg: '#A80000' }, '2': { bg: '#FFF1E0', fg: '#8A4B00' },
  '3': { bg: '#FFF8E0', fg: '#7A6800' }, '4': { bg: '#E3F2E8', fg: '#2E844A' },
};
const HR_STATE_COLORS: Record<string, { bg: string; fg: string }> = {
  'open':        { bg: '#EEF4FF', fg: '#0066CC' },
  'in progress': { bg: '#FFF1E0', fg: '#8A4B00' },
  'resolved':    { bg: '#E3F2E8', fg: '#2E844A' },
  'closed':      { bg: '#2E3D49', fg: '#FFFFFF' },
};

function HrCasesView({ items: initItems, callTool, toast, theme, cacheInfo: initCacheInfo }: {
  items: any[]; callTool: (n: string, a?: any) => Promise<any>;
  toast: (m: string, t?: any) => void; theme: 'light' | 'dark';
  cacheInfo?: { hit: boolean; cached_at: string } | null;
}) {
  const styles = useStyles(); const t = now(theme);
  const [localItems, setLocalItems] = useState<any[]>(initItems);
  const [cacheInfo, setCacheInfo] = useState(initCacheInfo);
  useEffect(() => { setLocalItems(initItems); setCacheInfo(initCacheInfo); }, [initItems]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await callTool('sn__get_hr_cases', { refresh: true });
      setLocalItems(res?.items || []);
      setCacheInfo(res?._cache);
    } catch (e: any) { toast(e.message || 'Refresh failed', 'error'); }
    finally { setRefreshing(false); }
  };
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [form, setForm] = useState({ subject: '', description: '', priority: '3', state: 'Draft', work_note: '', opened_for_name: '', assigned_to_name: '', hr_service_name: '' });

  const openEdit = (c: any) => { setCreating(false); setEditingId(c.sys_id); setEditingRecord(c); setForm({ subject: c.subject || '', description: c.description || '', priority: String(c.priority).charAt(0) || '3', state: c.state || 'Draft', work_note: '', opened_for_name: '', assigned_to_name: '', hr_service_name: '' }); };
  const openCreate = () => { setEditingId(null); setEditingRecord(null); setCreating(true); setForm({ subject: '', description: '', priority: '3', state: 'Draft', work_note: '', opened_for_name: '', assigned_to_name: '', hr_service_name: '' }); };
  const cancel = () => { setEditingId(null); setEditingRecord(null); setCreating(false); };

  const handleSave = async () => {
    setSaving(true);
    try {
      let result: any;
      if (creating) {
        result = await callTool('sn__create_hr_case', form);
        if (result && result.type === 'alert') {
          toast(result.message || 'Cannot complete — please correct and retry.', 'info', 0);
          return;
        }
        toast('✓ HR Case created');
      } else {
        await callTool('sn__update_hr_case', { sys_id: editingId, ...form });
        toast('✓ HR Case updated');
      }
      cancel();
      const refreshed = await callTool('sn__get_hr_cases', { refresh: true });
      if (refreshed?.items) { setLocalItems(refreshed.items); setCacheInfo(refreshed._cache); }
    } catch (e: any) { toast(e.message || 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const cellS: React.CSSProperties = { padding: '8px 10px', fontSize: '12px', whiteSpace: 'normal', maxWidth: 200, verticalAlign: 'top', lineHeight: 1.4 };
  const hdS: React.CSSProperties = { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 10px', color: t.textWeak };

  const renderForm = (title: string) => (
    <TableRow>
      <TableCell colSpan={6} style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderLeft: '3px solid #1B7A6E', background: theme === 'dark' ? '#1A2E25' : '#F4F5F7', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: '#293E40' }}>{title}</div>
          <div className={styles.formGrid}>
            <Field label="Subject" size="small" style={{ gridColumn: '1 / -1' }}>
              <Input size="small" value={form.subject} onChange={(_, d) => setForm(f => ({ ...f, subject: d.value }))} />
            </Field>
            <Field label="Description" size="small" style={{ gridColumn: '1 / -1' }}>
              <Input size="small" value={form.description} onChange={(_, d) => setForm(f => ({ ...f, description: d.value }))} />
            </Field>
            <FormSelect label="Priority" value={form.priority} options={['1','2','3','4']} labels={HR_PRIORITY_LABELS} onChange={v => setForm(f => ({ ...f, priority: v }))} theme={theme} disabled />
            {!creating && (
              <FormSelect label="State" value={form.state} options={HR_STATES} onChange={v => setForm(f => ({ ...f, state: v }))} theme={theme} />
            )}
            {creating ? (
              <>
                <Field label="Opened for (type full name) 🔗" size="small">
                  <Input size="small" value={form.opened_for_name} onChange={(_, d) => setForm(f => ({ ...f, opened_for_name: d.value }))} placeholder="e.g. Joe Smith" />
                </Field>
                <Field label="Assigned to (type full name) 🔗" size="small">
                  <Input size="small" value={form.assigned_to_name} onChange={(_, d) => setForm(f => ({ ...f, assigned_to_name: d.value }))} placeholder="e.g. Alice Chen" />
                </Field>
                <Field label="HR Service (type full name) 🔗" size="small">
                  <Input size="small" value={form.hr_service_name} onChange={(_, d) => setForm(f => ({ ...f, hr_service_name: d.value }))} placeholder="e.g. VPN Access" />
                </Field>
              </>
            ) : (
              <>
                <Field label="Opened for" size="small">
                  <Text style={{ fontSize: '12px', color: t.text, padding: '4px 8px', display: 'block' }}>{editingRecord?.opened_for || '—'}</Text>
                </Field>
                <Field label="Assigned to" size="small">
                  <Text style={{ fontSize: '12px', color: t.text, padding: '4px 8px', display: 'block' }}>{editingRecord?.assigned_to || '—'}</Text>
                </Field>
                <Field label="HR Service" size="small">
                  <Text style={{ fontSize: '12px', color: t.text, padding: '4px 8px', display: 'block' }}>{editingRecord?.hr_service || '—'}</Text>
                </Field>
              </>
            )}
            {!creating && (
              <Field label="Work Note (appended to journal)" size="small" style={{ gridColumn: '1 / -1' }}>
                <Input size="small" value={form.work_note} onChange={(_, d) => setForm(f => ({ ...f, work_note: d.value }))} placeholder="Optional internal note…" />
              </Field>
            )}
          </div>
          <div className={styles.formActions}>
            <Button appearance="secondary" size="small" onClick={cancel} disabled={saving}
              style={{ borderRadius: '4px', height: '32px', padding: '0 16px', border: `1px solid ${t.border}` }}>
              Cancel
            </Button>
            <Button appearance="primary" size="small" onClick={handleSave} disabled={saving}
              style={{ background: '#1B7A6E', borderColor: '#1B7A6E', borderRadius: '4px', height: '32px', padding: '0 16px' }}>
              {saving ? 'Saving…' : creating ? '✓ Create' : '✓ Save'}
            </Button>
          </div>
          {creating && (
            <FkHint
              fields={[
                { label: 'Opened for (type full name) 🔗' },
                { label: 'Assigned to (type full name) 🔗' },
                { label: 'HR Service (type full name) 🔗' },
              ]}
              systemName="ServiceNow"
            />
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}`, background: t.surface }}>
      <ViewHeader icon={<PersonRegular style={{ fontSize: '18px', color: '#fff' }} />} title="HR Cases" count={localItems.length}
        brand={tokens.colorPaletteLavenderForeground2}
        cacheInfo={cacheInfo} onRefresh={handleRefresh} refreshing={refreshing} />
      <Table size="small" style={{ borderCollapse: 'collapse' }}>
        <TableHeader>
          <TableRow style={{ background: t.bg }}>
            {['Number', 'Subject', 'Opened For', 'Priority', 'State', ''].map((h, i) => (
              <TableHeaderCell key={i} style={{ ...hdS, ...(i === 5 ? { width: 40 } : {}) }}>{h}</TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {creating && renderForm('➕ New HR Case')}
          {localItems.length === 0 && !creating && <TableRow><TableCell colSpan={6} style={{ padding: 24, textAlign: 'center', color: t.textWeak, fontSize: '13px' }}>No HR cases found.</TableCell></TableRow>}
          {localItems.map((c: any) => {
            const pk = String(c.priority).charAt(0);
            const sk = (c.state || '').toLowerCase();
            const pc = HR_PRIORITY_COLORS[pk] || { bg: '#eee', fg: '#555' };
            const sc = HR_STATE_COLORS[sk] || { bg: '#eee', fg: '#555' };
            return (
              <React.Fragment key={c.sys_id}>
                <TableRow style={{ background: t.bg, borderBottom: `1px solid ${t.border}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.headerBg)}
                  onMouseLeave={e => (e.currentTarget.style.background = t.bg)}>
                  <TableCell style={{ ...cellS, fontFamily: 'monospace', color: '#1B7A6E', fontWeight: 600 }}>{c.number}</TableCell>
                  <TableCell style={{ ...cellS, maxWidth: 300 }}>{c.subject || '—'}</TableCell>
                  <TableCell style={cellS}>{c.opened_for || '—'}</TableCell>
                  <TableCell style={cellS}><span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: pc.bg, color: pc.fg }}>{HR_PRIORITY_LABELS[pk] || c.priority || '—'}</span></TableCell>
                  <TableCell style={cellS}><span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 500, background: sc.bg, color: sc.fg }}>{c.state || '—'}</span></TableCell>
                  <TableCell style={cellS}><button onClick={() => openEdit(c)} title="Edit" style={{ width: 26, height: 26, border: `1px solid ${t.border}`, borderRadius: '4px', background: 'transparent', cursor: 'pointer', fontSize: '13px', padding: 0 }}><EditRegular style={{ fontSize: "16px" }} /></button></TableCell>
                </TableRow>
                {editingId === c.sys_id && renderForm('Edit HR Case ' + c.number)}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
      <NowFooter theme={theme} />
    </div>
  );
}

// ── Post-submit list pivot helper ──────────────────────────────────────────
// After an in-widget form submit, widget `data` doesn't auto-update — local
// state has to render the list inline so the user sees the just-saved row.
function renderListAfterAction(
  data: any,
  callTool: (n: string, a?: any) => Promise<any>,
  toast: (m: string, t?: any) => void,
  theme: 'light' | 'dark'
): React.ReactNode {
  if (!data) return null;
  const cacheInfo = data._cache;
  switch (data.type) {
    case 'incidents':       return <IncidentsView items={(data.incidents || []) as Incident[]} callTool={callTool} toast={toast} theme={theme} cacheInfo={cacheInfo} />;
    case 'requests':        return <RequestsView items={(data.requests || []) as ServiceRequest[]} callTool={callTool} toast={toast} theme={theme} cacheInfo={cacheInfo} />;
    case 'change_requests': return <ChangesView items={(data.items || []) as ChangeRequest[]} callTool={callTool} toast={toast} theme={theme} cacheInfo={cacheInfo} />;
    case 'problems':        return <ProblemsView items={(data.items || []) as Problem[]} callTool={callTool} toast={toast} theme={theme} cacheInfo={cacheInfo} />;
    case 'hr_cases':        return <HrCasesView items={(data.items || []) as any[]} callTool={callTool} toast={toast} theme={theme} cacheInfo={cacheInfo} />;
    default: return null;
  }
}

// ── Resolve Incident View ────────────────────────────────────────────────────
const CLOSE_CODES = [
  'Duplicate',
  'Known error',
  'No resolution provided',
  'Resolved by caller',
  'Resolved by change',
  'Resolved by problem',
  'Resolved by request',
  'Solution provided',
  'Workaround provided',
  'User error',
];

function ResolveIncidentView({ sys_id, number, short_description, description, priority, state, assigned_to, category, callTool, toast, theme }: {
  sys_id: string;
  number: string;
  short_description?: string;
  description?: string;
  priority?: string;
  state?: string;
  assigned_to?: string;
  category?: string;
  callTool: (name: string, args?: Record<string, any>) => Promise<any>;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  theme: 'light' | 'dark';
}) {
  const styles = useStyles();
  const t = now(theme);
  const [closeCode, setCloseCode] = useState('Solved (Permanently)');
  const [closeNotes, setCloseNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [listAfterAction, setListAfterAction] = useState<any | null>(null);

  const handleResolve = async () => {
    setSubmitting(true);
    try {
      const result = await callTool('sn__resolve_incident', {
        sys_id,
        close_code: closeCode,
        close_notes: closeNotes.trim() || 'Resolved',
      });
      toast('✓ Incident resolved');
      if (result) setListAfterAction(result);
    } catch (e: any) {
      toast(e.message || 'Failed to resolve incident', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (listAfterAction) {
    const node = renderListAfterAction(listAfterAction, callTool, toast, theme);
    if (node) return <>{node}</>;
  }

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px', borderRadius: '4px',
    border: `1px solid ${t.border}`, background: t.surface,
    color: t.text, fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
  };

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}`, background: t.surface }}>
      <div className={styles.headerBar} style={{ background: 'linear-gradient(135deg, #6E50E8 0%, #8B73F5 100%)', borderBottom: '2px solid #A893F2' }}>
        <div className={styles.headerLeft}>
          <span style={{ fontSize: '18px' }}>🔒</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Resolve Incident — {number}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <ExpandButton />
        </div>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ── Incident detail panel ── */}
          {(short_description || priority || state) && (
            <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: '6px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {short_description && (
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textWeak, letterSpacing: '0.4px' }}>Summary</span>
                  <div style={{ fontSize: '13px', color: t.text, marginTop: '3px', fontWeight: 600 }}>{short_description}</div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {priority && (
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textWeak }}>Priority</span>
                    <div style={{ fontSize: '13px', color: t.text, marginTop: '2px' }}>{PRIORITY_LABELS[priority] || priority}</div>
                  </div>
                )}
                {state && (
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textWeak }}>State</span>
                    <div style={{ fontSize: '13px', color: t.text, marginTop: '2px' }}>{state}</div>
                  </div>
                )}
                {assigned_to && (
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textWeak }}>Assigned To</span>
                    <div style={{ fontSize: '13px', color: t.text, marginTop: '2px' }}>{assigned_to}</div>
                  </div>
                )}
                {category && (
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textWeak }}>Category</span>
                    <div style={{ fontSize: '13px', color: t.text, marginTop: '2px', textTransform: 'capitalize' }}>{category}</div>
                  </div>
                )}
              </div>
              {description && (
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: t.textWeak }}>Description</span>
                  <div style={{ fontSize: '12px', color: t.textWeak, marginTop: '3px', lineHeight: '1.5', maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{description}</div>
                </div>
              )}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: t.text, marginBottom: '6px' }}>
              Resolution Code <span style={{ color: t.error }}>*</span>
            </label>
            <select value={closeCode} onChange={e => setCloseCode(e.target.value)} style={selectStyle}>
              {CLOSE_CODES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: t.text, marginBottom: '6px' }}>
              Resolution Notes
            </label>
            <textarea
              value={closeNotes}
              onChange={e => setCloseNotes(e.target.value)}
              placeholder="Describe how the incident was resolved…"
              rows={3}
              style={{
                width: '100%', padding: '8px', borderRadius: '4px',
                border: `1px solid ${t.border}`, background: t.surface,
                color: t.text, fontSize: '13px', fontFamily: 'inherit',
                resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              appearance="primary"
              size="small"
              onClick={handleResolve}
              disabled={submitting}
              style={{ background: '#293E40', borderColor: '#293E40', borderRadius: '4px', height: '34px', padding: '0 20px' }}
            >
              {submitting ? '…' : '🔒 Resolve Incident'}
            </Button>
          </div>
        </div>
      <NowFooter theme={theme} />
    </div>
  );
}

// ── Form View (standalone create form) ──────────────────────────────────────
const FORM_URGENCIES = ['1', '2', '3', '4'];
const FORM_URGENCY_LABELS: Record<string, string> = { '1': '1 – Critical', '2': '2 – High', '3': '3 – Moderate', '4': '4 – Low' };
const FORM_IMPACTS = ['1', '2', '3'];
const FORM_IMPACT_LABELS: Record<string, string> = { '1': '1 – High', '2': '2 – Medium', '3': '3 – Low' };
const FORM_CATEGORIES_LIST = ['inquiry', 'software', 'hardware', 'network', 'database', 'password_reset'];
const FORM_CATEGORY_LABELS: Record<string, string> = {
  inquiry: 'Inquiry', software: 'Software', hardware: 'Hardware', network: 'Network', database: 'Database', password_reset: 'Password Reset',
};

function FormView({ entity, prefill, mode = 'create', recordId, callTool, toast, theme }: {
  entity: 'incident' | 'request' | 'change_request' | 'problem' | 'hr_case';
  prefill?: Record<string, string>;
  mode?: 'create' | 'edit';
  recordId?: string;
  callTool: (name: string, args?: Record<string, any>) => Promise<any>;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  theme: 'light' | 'dark';
}) {
  const styles = useStyles();
  const t = now(theme);
  // hr_case calls its title field `subject` at the tool surface; other entities call it `short_description`.
  // Use a single state value, branch the label and submit-arg name on entity.
  const [shortDesc, setShortDesc] = useState(prefill?.short_description || prefill?.subject || '');
  const [description, setDescription] = useState(prefill?.description || '');
  // Variable is named `urgency` for historical reasons; the value flows to
  // the tool as the `priority` arg and the tool's prefill key is `priority`.
  // Reading `prefill?.priority` (was `urgency`) so edit-mode actually picks
  // up the current SN value instead of defaulting to '2' (Medium).
  // SN returns choice fields as display strings (e.g. "1 - Critical", "Inquiry")
  // because the list-fetch sets sysparm_display_value=true. Strip to the choice
  // value the dropdown options use so (a) the dropdown shows the right selection
  // and (b) what we send back on save matches what SN expects.
  const [urgency, setUrgency] = useState(prefill?.priority ? String(prefill.priority).charAt(0) : '2');
  const [impact, setImpact] = useState(prefill?.impact ? String(prefill.impact).charAt(0) : '2');
  const [category, setCategory] = useState(prefill?.category ? String(prefill.category).toLowerCase() : '');
  const [changeCategory, setChangeCategory] = useState(prefill?.category || 'Other');
  const [changeType, setChangeType] = useState(prefill?.type || 'normal');
  const [risk, setRisk] = useState(prefill?.risk || '4');
  const [workNote, setWorkNote] = useState('');
  const [callerName, setCallerName] = useState(prefill?.caller_name || '');
  const [assignedToName, setAssignedToName] = useState(prefill?.assigned_to_name || prefill?.assigned_to || '');
  const [requestedForName, setRequestedForName] = useState(prefill?.requested_for_name || prefill?.requested_for || '');
  const [openedForName, setOpenedForName] = useState(prefill?.opened_for_name || prefill?.opened_for || '');
  const [hrServiceName, setHrServiceName] = useState(prefill?.hr_service_name || prefill?.hr_service || '');
  // Consolidated state picker (per-entity options selected below). hr_case had a
  // dedicated hrState hook; folding into one keeps the form layout uniform.
  const [stateValue, setStateValue] = useState(prefill?.state || '');
  const [approval, setApproval] = useState(prefill?.approval || '');
  const [requestState, setRequestState] = useState(prefill?.request_state || '');
  const [dueDate, setDueDate] = useState(prefill?.due_date || '');
  const [plannedStart, setPlannedStart] = useState(prefill?.planned_start_date || prefill?.planned_start || '');
  const [plannedEnd, setPlannedEnd] = useState(prefill?.planned_end_date || prefill?.planned_end || '');
  const [workaround, setWorkaround] = useState(prefill?.workaround || '');
  const [submitting, setSubmitting] = useState(false);
  const [listAfterAction, setListAfterAction] = useState<any | null>(null);

  const isIncident = entity === 'incident';
  const isChange = entity === 'change_request';
  const isProblem = entity === 'problem';
  const isHrCase = entity === 'hr_case';
  const isEdit = mode === 'edit';
  const entityLabel = isIncident ? 'Incident' : isChange ? 'Change Request' : isProblem ? 'Problem' : isHrCase ? 'HR Case' : 'Request';
  const titleFieldLabel = isHrCase ? 'Subject' : 'Short Description';
  const title = `${isEdit ? '✏️ Edit' : '✨ New'} ${entityLabel}`;

  const handleSubmit = async () => {
    if (!shortDesc.trim()) { toast('Short Description is required', 'error'); return; }
    setSubmitting(true);
    try {
      let result: any;
      if (isEdit) {
        const toolName = isIncident ? 'sn__update_incident' : isChange ? 'sn__update_change_request' : isProblem ? 'sn__update_problem' : isHrCase ? 'sn__update_hr_case' : 'sn__update_request';
        const args: Record<string, any> = { sys_id: recordId };
        if (isHrCase) args.subject = shortDesc.trim();
        else          args.short_description = shortDesc.trim();
        args.description = description.trim();
        args.priority = urgency;
        if (workNote.trim()) args.work_note = workNote.trim();
        if (stateValue) args.state = stateValue;
        if (isIncident) {
          args.impact = impact;
          args.category = category;
          if (callerName.trim()) args.caller_name = callerName.trim();
          if (assignedToName.trim()) args.assigned_to_name = assignedToName.trim();
        }
        if (isChange)   { args.category = changeCategory; args.type = changeType; args.risk = risk; if (plannedStart) args.planned_start_date = plannedStart; if (plannedEnd) args.planned_end_date = plannedEnd; if (assignedToName.trim()) args.assigned_to_name = assignedToName.trim(); }
        if (isProblem) { if (workaround.trim()) args.workaround = workaround.trim(); if (assignedToName.trim()) args.assigned_to_name = assignedToName.trim(); }
        if (isHrCase) {
          if (openedForName.trim()) args.opened_for_name = openedForName.trim();
          if (assignedToName.trim()) args.assigned_to_name = assignedToName.trim();
          if (hrServiceName.trim()) args.hr_service_name = hrServiceName.trim();
        }
        if (entity === 'request') {
          if (approval)     args.approval = approval;
          if (requestState) { args.request_state = requestState; delete args.state; }
          if (dueDate)      args.due_date = dueDate;
          if (requestedForName.trim()) args.requested_for_name = requestedForName.trim();
        }
        result = await callTool(toolName, args);
      } else if (isIncident) {
        result = await callTool('sn__create_incident', { short_description: shortDesc.trim(), description: description.trim(), priority: urgency, impact, category, ...(stateValue ? { state: stateValue } : {}), ...(callerName.trim() ? { caller_name: callerName.trim() } : {}), ...(assignedToName.trim() ? { assigned_to_name: assignedToName.trim() } : {}) });
      } else if (isChange) {
        result = await callTool('sn__create_change_request', { short_description: shortDesc.trim(), description: description.trim(), category: changeCategory, type: changeType, risk, priority: urgency, ...(stateValue ? { state: stateValue } : {}), ...(plannedStart ? { planned_start_date: plannedStart } : {}), ...(plannedEnd ? { planned_end_date: plannedEnd } : {}), ...(assignedToName.trim() ? { assigned_to_name: assignedToName.trim() } : {}) });
      } else if (isProblem) {
        result = await callTool('sn__create_problem', { short_description: shortDesc.trim(), description: description.trim(), priority: urgency, ...(stateValue ? { state: stateValue } : {}), ...(workaround.trim() ? { workaround: workaround.trim() } : {}), ...(assignedToName.trim() ? { assigned_to_name: assignedToName.trim() } : {}) });
      } else if (isHrCase) {
        result = await callTool('sn__create_hr_case', { subject: shortDesc.trim(), description: description.trim(), priority: urgency, ...(stateValue ? { state: stateValue } : {}), ...(openedForName.trim() ? { opened_for_name: openedForName.trim() } : {}), ...(assignedToName.trim() ? { assigned_to_name: assignedToName.trim() } : {}), ...(hrServiceName.trim() ? { hr_service_name: hrServiceName.trim() } : {}) });
      } else {
        result = await callTool('sn__create_request', { short_description: shortDesc.trim(), description: description.trim(), priority: urgency, ...(dueDate ? { due_date: dueDate } : {}), ...(requestedForName.trim() ? { requested_for_name: requestedForName.trim() } : {}) });
      }
      // Alert path — server returned a non-fatal FK lookup miss with
      // suggestions. Surface persistently and keep the form open so the
      // user can correct the assignee/caller and re-submit.
      // All FK-resolving create/update tools across Incident, Service Request,
      // Change Request, Problem, and HR Case return this shape.
      if (result && result.type === 'alert') {
        toast(result.message || 'Cannot complete — please correct and retry.', 'info', 0);
        return;
      }
      toast(`✓ ${entityLabel} ${isEdit ? 'updated' : 'created'} successfully`, 'success');
      // Explicit list refresh after save — matches SF pattern. The update tool's
      // own embedded refresh has occasionally returned empty; an explicit list
      // call is more robust and gives the user immediate confirmation.
      const listTool = FORM_LIST_TOOL[entity];
      if (listTool) {
        try {
          const listRes = await callTool(listTool, { refresh: true });
          if (listRes) setListAfterAction(listRes);
          else if (result) setListAfterAction(result);
        } catch {
          if (result) setListAfterAction(result);
        }
      } else if (result) {
        setListAfterAction(result);
      }
    } catch (e: any) {
      toast(e.message || `Failed to ${isEdit ? 'update' : 'create'} ${entity}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel pivots to the entity's list (no save). The form was opened by an
  // LLM tool call; the natural "back" destination is the list of records.
  const handleCancel = async () => {
    const listTool = FORM_LIST_TOOL[entity];
    if (!listTool) return;
    try {
      const listRes = await callTool(listTool, { refresh: true });
      if (listRes) setListAfterAction(listRes);
    } catch (e: any) {
      toast(e?.message || 'Failed to load list', 'error');
    }
  };

  const formGrid3: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px 20px', marginBottom: '20px',
  };

  if (listAfterAction) {
    const node = renderListAfterAction(listAfterAction, callTool, toast, theme);
    if (node) return <>{node}</>;
  }

  return (
    <div className={styles.card} style={{ border: `1px solid ${t.border}`, background: t.surface }}>
      <div className={styles.headerBar} style={{
        background: isIncident
          ? 'linear-gradient(135deg, #6E50E8 0%, #8B73F5 100%)'
          : 'linear-gradient(135deg, #293E40 0%, #3A5A5C 100%)',
        borderBottom: isIncident ? '2px solid #A893F2' : '2px solid #81B5A1',
      }}>
        <div className={styles.headerLeft}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <ExpandButton />
        </div>
      </div>

      <div style={{ padding: '16px' }}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>{titleFieldLabel} *</label>
            <Input size="small" value={shortDesc} onChange={(_, d) => setShortDesc(d.value)}
              placeholder={`Brief summary of the ${entity.replace('_', ' ')}`}
              style={{ width: '100%', marginTop: '4px' }} />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>Description</label>
            <Textarea size="small" value={description} onChange={(_, d) => setDescription(d.value)}
              placeholder="Detailed description (optional)" rows={3} resize="vertical"
              style={{ width: '100%', marginTop: '4px' }} />
          </div>
          {isEdit && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>Work Note <span style={{ color: t.textWeak, fontWeight: 400 }}>(internal — appended to journal)</span></label>
              <Textarea size="small" value={workNote} onChange={(_, d) => setWorkNote(d.value)}
                placeholder="Optional internal note…" rows={2} resize="vertical"
                style={{ width: '100%', marginTop: '4px' }} />
            </div>
          )}
          {isEdit && isIncident && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>Caller (type full name) 🔗</label>
                <Input size="small" value={callerName} onChange={(_, d) => setCallerName(d.value)} placeholder={prefill?.caller_id || 'e.g. Joe Smith'} style={{ width: '100%', marginTop: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>Assigned To (type full name) 🔗</label>
                <Input size="small" value={assignedToName} onChange={(_, d) => setAssignedToName(d.value)} placeholder={prefill?.assigned_to || 'e.g. Alice Chen'} style={{ width: '100%', marginTop: '4px' }} />
              </div>
            </>
          )}
          {isEdit && (isChange || isProblem) && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>Assigned to (type full name) 🔗</label>
              <Input size="small" value={assignedToName} onChange={(_, d) => setAssignedToName(d.value)} placeholder={prefill?.assigned_to || 'e.g. Alice Chen'} style={{ width: '100%', marginTop: '4px' }} />
            </div>
          )}
          {isEdit && entity === 'request' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>Requested for (type full name) 🔗</label>
              <Input size="small" value={requestedForName} onChange={(_, d) => setRequestedForName(d.value)} placeholder="e.g. Joe Smith" style={{ width: '100%', marginTop: '4px' }} />
            </div>
          )}
          {isEdit && isHrCase && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>Opened for (type full name) 🔗</label>
                <Input size="small" value={openedForName} onChange={(_, d) => setOpenedForName(d.value)} placeholder="e.g. Joe Smith" style={{ width: '100%', marginTop: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>Assigned to (type full name) 🔗</label>
                <Input size="small" value={assignedToName} onChange={(_, d) => setAssignedToName(d.value)} placeholder="e.g. Alice Chen" style={{ width: '100%', marginTop: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>HR Service (type full name) 🔗</label>
                <Input size="small" value={hrServiceName} onChange={(_, d) => setHrServiceName(d.value)} placeholder="e.g. VPN Access" style={{ width: '100%', marginTop: '4px' }} />
              </div>
            </>
          )}
          {!isEdit && isIncident && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>Caller (type full name) 🔗</label>
                <Input size="small" value={callerName} onChange={(_, d) => setCallerName(d.value)} placeholder="e.g. Joe Smith" style={{ width: '100%', marginTop: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>Assigned To (type full name) 🔗</label>
                <Input size="small" value={assignedToName} onChange={(_, d) => setAssignedToName(d.value)} placeholder="e.g. Alice Chen" style={{ width: '100%', marginTop: '4px' }} />
              </div>
            </>
          )}
          {!isEdit && (isChange || isProblem) && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>Assigned to (type full name) 🔗</label>
              <Input size="small" value={assignedToName} onChange={(_, d) => setAssignedToName(d.value)} placeholder="e.g. Alice Chen" style={{ width: '100%', marginTop: '4px' }} />
            </div>
          )}
          {!isEdit && entity === 'request' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>Requested for (type full name) 🔗</label>
              <Input size="small" value={requestedForName} onChange={(_, d) => setRequestedForName(d.value)} placeholder="e.g. Joe Smith" style={{ width: '100%', marginTop: '4px' }} />
            </div>
          )}
          {!isEdit && isHrCase && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>Opened for (type full name) 🔗</label>
                <Input size="small" value={openedForName} onChange={(_, d) => setOpenedForName(d.value)} placeholder="e.g. Joe Smith" style={{ width: '100%', marginTop: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>Assigned to (type full name) 🔗</label>
                <Input size="small" value={assignedToName} onChange={(_, d) => setAssignedToName(d.value)} placeholder="e.g. Alice Chen" style={{ width: '100%', marginTop: '4px' }} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: t.text, fontSize: '12px', fontWeight: 600 }}>HR Service (type full name) 🔗</label>
                <Input size="small" value={hrServiceName} onChange={(_, d) => setHrServiceName(d.value)} placeholder="e.g. VPN Access" style={{ width: '100%', marginTop: '4px' }} />
              </div>
            </>
          )}
          <div style={formGrid3}>
            <FormSelect label="Priority" value={urgency} options={FORM_URGENCIES} labels={FORM_URGENCY_LABELS} onChange={setUrgency} theme={theme} disabled />
            {isIncident && <FormSelect label="Impact" value={impact} options={FORM_IMPACTS} labels={FORM_IMPACT_LABELS} onChange={setImpact} theme={theme} />}
            {isIncident && <FormSelect label="Category" value={category} options={FORM_CATEGORIES_LIST} labels={FORM_CATEGORY_LABELS} onChange={setCategory} theme={theme} />}
            {isChange && <FormSelect label="Category" value={changeCategory} options={CHANGE_CATEGORIES} onChange={setChangeCategory} theme={theme} />}
            {isChange && <FormSelect label="Type" value={changeType} options={CHANGE_TYPES} labels={CHANGE_TYPE_LABELS} onChange={setChangeType} theme={theme} />}
            {isChange && <FormSelect label="Risk" value={risk} options={RISK_OPTIONS} labels={RISK_LABELS} onChange={setRisk} theme={theme} />}
            {isEdit && isIncident && <FormSelect label="State" value={stateValue} options={INCIDENT_STATES} onChange={setStateValue} theme={theme} />}
            {!isEdit && isIncident && <FormSelect label="State" value={stateValue} options={INCIDENT_STATES} onChange={setStateValue} theme={theme} />}
            {isEdit && isChange   && <FormSelect label="State" value={stateValue} options={CHANGE_STATES}   onChange={setStateValue} theme={theme} />}
            {!isEdit && isChange  && <FormSelect label="State" value={stateValue} options={CHANGE_STATES}   onChange={setStateValue} theme={theme} />}
            {isEdit && isProblem  && <FormSelect label="State" value={stateValue} options={PROBLEM_STATES}  onChange={setStateValue} theme={theme} />}
            {!isEdit && isProblem && <FormSelect label="State" value={stateValue} options={PROBLEM_STATES}  onChange={setStateValue} theme={theme} />}
            {isEdit && isHrCase   && <FormSelect label="State" value={stateValue || prefill?.state || ''} options={HR_STATES} onChange={setStateValue} theme={theme} />}
            {!isEdit && isHrCase  && <FormSelect label="State" value={stateValue || prefill?.state || ''} options={HR_STATES} onChange={setStateValue} theme={theme} />}
            {isEdit && entity === 'request' && <FormSelect label="Approval" value={approval} options={APPROVAL_OPTIONS} onChange={setApproval} theme={theme} />}
            {isEdit && entity === 'request' && <FormSelect label="Request State" value={requestState} options={REQUEST_STATES} onChange={setRequestState} theme={theme} />}
            {isEdit && entity === 'request' && (
              <Field label="Due Date" size="small">
                <Input size="small" type="date" value={dueDate} onChange={(_, d) => setDueDate(d.value)} />
              </Field>
            )}
            {!isEdit && entity === 'request' && (
              <Field label="Due Date" size="small">
                <Input size="small" type="date" value={dueDate} onChange={(_, d) => setDueDate(d.value)} />
              </Field>
            )}
            {isEdit && isChange && (
              <Field label="Planned Start" size="small">
                <Input size="small" type="date" value={plannedStart} onChange={(_, d) => setPlannedStart(d.value)} />
              </Field>
            )}
            {!isEdit && isChange && (
              <Field label="Planned Start" size="small">
                <Input size="small" type="date" value={plannedStart} onChange={(_, d) => setPlannedStart(d.value)} />
              </Field>
            )}
            {isEdit && isChange && (
              <Field label="Planned End" size="small">
                <Input size="small" type="date" value={plannedEnd} onChange={(_, d) => setPlannedEnd(d.value)} />
              </Field>
            )}
            {!isEdit && isChange && (
              <Field label="Planned End" size="small">
                <Input size="small" type="date" value={plannedEnd} onChange={(_, d) => setPlannedEnd(d.value)} />
              </Field>
            )}
            {isProblem && (
              <Field label="Workaround" size="small" style={{ gridColumn: '1 / -1' }}>
                <Textarea size="small" value={workaround} onChange={(_, d) => setWorkaround(d.value)} placeholder="Optional workaround…" rows={2} resize="vertical" />
              </Field>
            )}
          </div>
          <div className={styles.formActions}>
            <Button size="small" appearance="primary" onClick={handleSubmit}
              disabled={submitting || !shortDesc.trim()}
              style={{ background: '#81B5A1', borderColor: '#81B5A1', minWidth: '90px' }}>
              {submitting ? <Spinner size="tiny" /> : 'Save'}
            </Button>
            <Button size="small" appearance="subtle" onClick={handleCancel} disabled={submitting} style={{ color: t.textWeak }}>Cancel</Button>
          </div>
          {isIncident && (
            <FkHint
              fields={[
                { label: 'Caller (type full name) 🔗' },
                { label: 'Assigned To (type full name) 🔗' },
              ]}
              systemName="ServiceNow"
            />
          )}
          {(isChange || isProblem) && (
            <FkHint
              fields={[{ label: 'Assigned to (type full name) 🔗' }]}
              systemName="ServiceNow"
            />
          )}
          {entity === 'request' && (
            <FkHint
              fields={[{ label: 'Requested for (type full name) 🔗' }]}
              systemName="ServiceNow"
            />
          )}
          {isHrCase && (
            <FkHint
              fields={[
                { label: 'Opened for (type full name) 🔗' },
                { label: 'Assigned to (type full name) 🔗' },
                { label: 'HR Service (type full name) 🔗' },
              ]}
              systemName="ServiceNow"
            />
          )}
        </div>

      <NowFooter theme={theme} />
    </div>
  );
}

// ── Skeleton Loading Shimmer ────────────────────────────────────────────────
function SkeletonTable() {
  return (
    <div style={{ padding: '16px' }}>
      <div style={{ textAlign: 'center', padding: '8px 0 16px', fontSize: '13px', color: '#888' }}>
        ⏳ Loading data…
      </div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div className="skel" style={{ width: '220px', height: '24px' }} />
        <div className="skel" style={{ width: '80px', height: '24px' }} />
      </div>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <div className="skel" style={{ width: `${80 + (i * 10)}px` }} />
          <div className="skel" style={{ width: `${160 - (i * 8)}px` }} />
          <div className="skel" style={{ width: `${70 + (i * 5)}px` }} />
          <div className="skel" style={{ width: `${100 + (i * 12)}px` }} />
          <div className="skel" style={{ width: `${90 - (i * 6)}px` }} />
        </div>
      ))}
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────
export function ServiceNowApp() {
  const styles = useStyles();
  const data = useToolData<SnowData>();
  const { callTool } = useMcpBridge();
  const toast = useToast();
  const theme = useTheme();
  const t = now(theme);

  const shellStyle: React.CSSProperties = { padding: '12px', fontSize: '12px' };

  if (!data) {
    return (
      <div className={styles.shell} style={shellStyle}>
        <SkeletonTable />
      </div>
    );
  }

  if (data.error) {
    return (
      <div className={styles.shell} style={shellStyle}>
        <div className={styles.card} style={{ border: `1px solid ${t.border}` }}>
          <div className={styles.headerBar} style={{ background: '#293E40' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>⚠️ Error</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <ExpandButton />
            </div>
          </div>
          <div style={{
            padding: '12px 16px', fontSize: '13px', fontWeight: 500,
            background: theme === 'dark' ? '#3D1111' : '#FDE7E7',
            color: theme === 'dark' ? '#F87171' : t.error,
            borderLeft: `3px solid ${t.error}`,
          }}>
            {data.message || 'An unknown error occurred.'}
          </div>
          <NowFooter theme={theme} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell} style={shellStyle}>
      {data.type === 'incidents' && (
        <IncidentsView items={(data.incidents || []) as Incident[]} callTool={callTool} toast={toast} theme={theme} cacheInfo={(data as any)._cache} />
      )}
      {data.type === 'requests' && (
        <RequestsView items={(data.requests || []) as ServiceRequest[]} callTool={callTool} toast={toast} theme={theme} cacheInfo={(data as any)._cache} />
      )}
      {data.type === 'change_requests' && (
        <ChangesView items={(data.items || []) as ChangeRequest[]} callTool={callTool} toast={toast} theme={theme} cacheInfo={(data as any)._cache} />
      )}
      {data.type === 'problems' && (
        <ProblemsView items={(data.items || []) as Problem[]} callTool={callTool} toast={toast} theme={theme} cacheInfo={(data as any)._cache} />
      )}
      {data.type === 'knowledge_articles' && (
        <KnowledgeView items={(data.items || []) as KnowledgeArticle[]} theme={theme} cacheInfo={(data as any)._cache} />
      )}
      {data.type === 'service_catalog' && (
        <CatalogView items={(data.items || []) as CatalogItem[]} theme={theme} cacheInfo={(data as any)._cache} />
      )}
      {data.type === 'approvals' && (
        <ApprovalsView items={(data.items || []) as SnowApproval[]} callTool={callTool} toast={toast} theme={theme} />
      )}
      {data.type === 'hr_cases' && (
        <HrCasesView items={(data.items || [])} callTool={callTool} toast={toast} theme={theme} cacheInfo={(data as any)._cache} />
      )}
      {data.type === 'form' && data.mode === 'resolve' && (
        <ResolveIncidentView
          sys_id={data.recordId || ''}
          number={data.number || ''}
          short_description={data.short_description || ''}
          description={data.description || ''}
          priority={data.priority || ''}
          state={data.state || ''}
          assigned_to={data.assigned_to || ''}
          category={data.category || ''}
          callTool={callTool}
          toast={toast}
          theme={theme}
        />
      )}
      {data.type === 'form' && data.mode !== 'resolve' && (
        <FormView
          entity={(data.entity || 'incident') as 'incident' | 'request' | 'change_request' | 'problem'}
          mode={(data.mode || 'create') as 'create' | 'edit'}
          recordId={data.recordId}
          prefill={data.prefill}
          callTool={callTool}
          toast={toast}
          theme={theme}
        />
      )}
    </div>
  );
}