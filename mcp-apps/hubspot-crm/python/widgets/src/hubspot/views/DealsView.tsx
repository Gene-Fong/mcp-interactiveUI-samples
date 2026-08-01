import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, tokens } from '@fluentui/react-components';
import { DismissRegular, EditRegular, EyeRegular, MoneyRegular } from '@fluentui/react-icons';
import { useStyles, H_CELL, D_CELL } from '../styles';
import { hs } from '../theme';
import { HsViewHeader } from '../components/ViewHeader';
import { RecordDialog } from '../components/RecordDialog';
import { HsFooter } from '../components/HsFooter';

interface DealDetails { contacts: any[]; companies: any[]; tickets: any[]; }

// Stage ID → label mapping (matches server stageLabels)
const STAGE_LABELS: Record<string, string> = {
  '3442945774': 'Lead Captured',
  '3442945775': 'Qualified',
  '3442945776': 'Proposal Sent',
  '3442945777': 'Negotiation',
  'closedwon': 'Closed Won',
  'closedlost': 'Closed Lost',
};

function stageLabel(id: string): string {
  return STAGE_LABELS[id] || id;
}

function fmtAmount(amt: string | number | undefined): string {
  if (amt == null || amt === '') return '—';
  const n = Number(amt);
  return isNaN(n) ? String(amt) : '$' + n.toLocaleString();
}

function fmtDate(d: string | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

// Normalize a HubSpot date value (ISO string or epoch-ms) to the YYYY-MM-DD
// format required by <input type="date">.
function toDateInput(d: string | number | undefined): string {
  if (d == null || d === '') return '';
  const dt = new Date(typeof d === 'string' && /^\d+$/.test(d) ? Number(d) : d);
  return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
}

// ── DealsView ──────────────────────────────────────────────────────────────
export function DealsView({ items: initItems, callTool, toast, theme, cacheInfo: initCacheInfo, isFullscreen }: {
  items: any[]; callTool: (n: string, a?: any) => Promise<any>;
  toast: (m: string, t?: any) => void; theme: 'light' | 'dark';
  cacheInfo?: { hit: boolean; cached_at: string }; isFullscreen?: boolean;
}) {
  const styles = useStyles();
  const t = hs(theme);
  const [localItems, setLocalItems] = useState(initItems);
  const [cacheInfo, setCacheInfo] = useState(initCacheInfo);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [viewingDeal, setViewingDeal] = useState<any | null>(null);
  const [dealDetails, setDealDetails] = useState<Record<string, DealDetails>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  const DEAL_EDIT_FIELDS = [
    { key: 'dealname', label: 'Deal Name' },
    { key: 'amount', label: 'Amount' },
    { key: 'pipeline', label: 'Pipeline', type: 'select' as const, options: ['default'] },
    { key: 'dealstage', label: 'Stage', type: 'select' as const, options: Object.keys(STAGE_LABELS) },
    { key: 'closedate', label: 'Close Date', inputType: 'date' as const },
    { key: 'dealtype', label: 'Deal Type', type: 'select' as const, options: ['newbusiness', 'existingbusiness'] },
    { key: 'description', label: 'Description' },
  ];

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const fFields = DEAL_EDIT_FIELDS.map(f => ({
    ...f,
    value: form[f.key] || '',
    onChange: (v: string) => setF(f.key, v),
  }));

  // Open the 360 view dialog and lazily load related records (aligned with
  // the Salesforce Account 360 pattern — related lists live inside the modal).
  const openView = async (deal: any) => {
    setViewingDeal(deal);
    if (dealDetails[deal.id]) return;
    setLoadingDetails(true);
    try {
      const [rc, rco, rt] = await Promise.all([
        callTool('hs__get_associations', { entity_type: 'deals', entity_id: deal.id, association_type: 'contacts' }).catch(() => null),
        callTool('hs__get_associations', { entity_type: 'deals', entity_id: deal.id, association_type: 'companies' }).catch(() => null),
        callTool('hs__get_associations', { entity_type: 'deals', entity_id: deal.id, association_type: 'tickets' }).catch(() => null),
      ]);
      setDealDetails(p => ({ ...p, [deal.id]: { contacts: rc?.items || [], companies: rco?.items || [], tickets: rt?.items || [] } }));
    } finally { setLoadingDetails(false); }
  };

  // ── Refresh ───────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await callTool('hs__get_deals', { refresh: true });
      if (res?.items) { setLocalItems(res.items); setCacheInfo(res._cache); }
    } catch { toast('Refresh failed', { intent: 'error' }); }
    setRefreshing(false);
  };

  // ── Save (edit) ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await callTool('hs__update_deal', { deal_id: editingId, ...form });
      if (res?.type === 'error' || res?.type === 'alert') {
        toast(res.message || 'Update failed', { intent: 'error' });
        setSaving(false);
        return;
      }
      if (res?.items) { setLocalItems(res.items); setCacheInfo(res._cache); }
      setLastSavedId(editingId);
      setTimeout(() => setLastSavedId(null), 2200);
      toast('Deal updated');
      setEditingId(null);
    } catch { toast('Save failed', { intent: 'error' }); }
    finally { setSaving(false); }
  };

  const openEdit = (deal: any) => {
    setViewingDeal(null);
    setForm({
      dealname: deal.dealname || '',
      amount: deal.amount || '',
      pipeline: deal.pipeline || 'default',
      dealstage: deal.dealstage || '',
      closedate: toDateInput(deal.closedate),
      dealtype: deal.dealtype || '',
      description: deal.description || '',
    });
    setEditingId(deal.id);
  };

  const editingRecord = localItems.find((d: any) => d.id === editingId);
  const dealViewFields = viewingDeal ? [
    { label: 'Deal Name', value: viewingDeal.dealname },
    { label: 'Amount', value: fmtAmount(viewingDeal.amount) },
    { label: 'Stage', value: stageLabel(viewingDeal.dealstage || '') },
    { label: 'Pipeline', value: viewingDeal.pipeline },
    { label: 'Close Date', value: fmtDate(viewingDeal.closedate) },
    { label: 'Deal Type', value: viewingDeal.dealtype || '—' },
    { label: 'Company', value: viewingDeal.company },
    { label: 'Description', value: viewingDeal.description },
  ] : [];

  // ── Sub-table for drill-down sections ──────────────────────────────────────
  const SubTable = ({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }} role="table">
      <thead>
        <tr style={{ backgroundColor: tokens.colorNeutralBackground3 }}>
          {headers.map(h => <th key={h} style={{ padding: '4px 10px', textAlign: 'left', color: tokens.colorNeutralForeground3, borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, fontWeight: 600 }}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={headers.length} style={{ padding: '6px 10px', color: tokens.colorNeutralForeground3, fontStyle: 'italic' }}>None</td></tr>
        ) : rows.map((cells, i) => (
          <tr key={i} style={{ borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
            {cells.map((cell, j) => <td key={j} style={{ padding: '4px 10px', color: j === 0 ? tokens.colorNeutralForeground1 : tokens.colorNeutralForeground3 }}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const RelatedList = ({ title, count, headers, rows }: { title: string; count: number; headers: string[]; rows: React.ReactNode[][] }) => (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textWeak, marginBottom: 6, paddingBottom: 4, borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{title}</span>
        <span style={{ fontWeight: 400, fontSize: 10 }}>({count})</span>
      </div>
      <SubTable headers={headers} rows={rows} />
    </div>
  );

  return (
    <div className={styles.card}>
      <HsViewHeader
        icon={<MoneyRegular style={{ fontSize: 18, color: tokens.colorBrandForeground1 }} />}
        title="Deals"
        count={localItems.length}
        theme={theme}
        cacheInfo={cacheInfo}
        onRefresh={isFullscreen ? handleRefresh : undefined}
        refreshing={refreshing}
      />
      <Table size="small" aria-label="Deals" style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak, width: '22%' }}>Deal Name</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak, width: '14%' }}>Amount</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak, width: '16%' }}>Stage</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak, width: '12%' }}>Pipeline</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak, width: '14%' }}>Close Date</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak, width: '16%' }}>Company</TableHeaderCell>
            {isFullscreen && <TableHeaderCell style={{ ...H_CELL, width: 50, color: t.textWeak }} />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {localItems.length === 0 && (
            <TableRow><TableCell colSpan={99} className={styles.empty}><Text>No deals found.</Text></TableCell></TableRow>
          )}
          {localItems.map((deal: any) => (
              <TableRow key={deal.id} className="hs-row"
                style={{ borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, ...(lastSavedId === deal.id ? { animation: 'hsRowFlash 2s ease-out' } : {}) }}
                aria-label={`Deal: ${deal.dealname}`}
              >
                <TableCell style={{ ...D_CELL, fontWeight: 600 }}>{deal.dealname || '—'}</TableCell>
                <TableCell style={D_CELL}>{fmtAmount(deal.amount)}</TableCell>
                <TableCell style={D_CELL}>{stageLabel(deal.dealstage || '')}</TableCell>
                <TableCell style={D_CELL}>{deal.pipeline || '—'}</TableCell>
                <TableCell style={D_CELL}>{fmtDate(deal.closedate)}</TableCell>
                <TableCell style={{ ...D_CELL, color: tokens.colorBrandForeground1 }}>{deal.company || '—'}</TableCell>
                {isFullscreen && (
                  <TableCell style={D_CELL}>
                    <Button appearance="subtle" icon={<EyeRegular />} size="small" onClick={() => openView(deal)} aria-label={`View ${deal.dealname}`} title="View" />
                  </TableCell>
                )}
              </TableRow>
          ))}
        </TableBody>
      </Table>
      <HsFooter theme={theme} />

      {editingRecord && (
        <RecordDialog
          open={!!editingId}
          title={`Edit Deal: ${editingRecord.dealname}`}
          fields={fFields}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setEditingId(null)}
          mode="edit"
        />
      )}
      <Dialog open={!!viewingDeal} onOpenChange={(_, data) => { if (!data.open) setViewingDeal(null); }}>
        <DialogSurface style={{ maxWidth: '820px', width: '92vw', padding: '24px' }}>
          <DialogBody>
            <DialogTitle style={{ fontSize: '18px', fontWeight: 700, color: tokens.colorBrandForeground1 }}>
              {viewingDeal?.dealname || 'Deal'}
            </DialogTitle>
            <DialogContent style={{ paddingTop: '16px' }}>
              {viewingDeal && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 28px' }}>
                    {dealViewFields.map(field => (
                      <div key={field.label} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, gridColumn: field.label === 'Description' ? '1 / -1' : undefined }}>
                        <div style={{ color: t.textWeak, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{field.label}</div>
                        <div style={{ color: field.label === 'Company' ? tokens.colorBrandForeground1 : t.text, fontSize: 13, whiteSpace: field.label === 'Description' ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{field.value || '—'}</div>
                      </div>
                    ))}
                  </div>
                  {loadingDetails && !dealDetails[viewingDeal.id] ? (
                    <div style={{ padding: 20, textAlign: 'center' }}><Spinner size="small" label="Loading related records…" /></div>
                  ) : dealDetails[viewingDeal.id] && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <RelatedList title="Contacts" count={dealDetails[viewingDeal.id].contacts.length}
                        headers={['Name', 'Email', 'Phone']}
                        rows={dealDetails[viewingDeal.id].contacts.map((ct: any) => [`${ct.firstname || ''} ${ct.lastname || ''}`.trim() || '—', ct.email || '—', ct.phone || '—'])} />
                      <RelatedList title="Companies" count={dealDetails[viewingDeal.id].companies.length}
                        headers={['Name', 'Domain', 'City']}
                        rows={dealDetails[viewingDeal.id].companies.map((co: any) => [co.name || '—', co.domain || '—', co.city || '—'])} />
                      <RelatedList title="Tickets" count={dealDetails[viewingDeal.id].tickets.length}
                        headers={['Subject', 'Status', 'Priority']}
                        rows={dealDetails[viewingDeal.id].tickets.map((tk: any) => [tk.subject || '—', tk.status || '—', tk.priority || '—'])} />
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
            <DialogActions style={{ paddingTop: '16px' }}>
              <Button appearance="secondary" icon={<DismissRegular />} onClick={() => setViewingDeal(null)}>Close</Button>
              {viewingDeal && (
                <Button appearance="primary" icon={<EditRegular />} onClick={() => openEdit(viewingDeal)}>Edit</Button>
              )}
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
