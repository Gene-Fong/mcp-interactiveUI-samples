import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Spinner, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, tokens } from '@fluentui/react-components';
import { CartRegular, DismissRegular, EditRegular, EyeRegular } from '@fluentui/react-icons';
import { useStyles, H_CELL, D_CELL } from '../styles';
import { hs } from '../theme';
import { HsViewHeader } from '../components/ViewHeader';
import { RecordDialog } from '../components/RecordDialog';
import { HsFooter } from '../components/HsFooter';

interface OrderDetails { deals: any[]; line_items: any[]; companies: any[]; }

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

// ── OrdersView ─────────────────────────────────────────────────────────────
export function OrdersView({ items: initItems, callTool, toast, theme, cacheInfo: initCacheInfo, isFullscreen }: {
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
  const [viewingOrder, setViewingOrder] = useState<any | null>(null);
  const [orderDetails, setOrderDetails] = useState<Record<string, OrderDetails>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  const ORDER_EDIT_FIELDS = [
    { key: 'hs_order_name', label: 'Order Name' },
    { key: 'hs_total_price', label: 'Total Price' },
    { key: 'hs_currency_code', label: 'Currency', type: 'select' as const, options: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR'] },
    { key: 'hs_fulfillment_status', label: 'Fulfillment Status', type: 'select' as const, options: ['pending', 'fulfilled', 'shipped', 'canceled'] },
    { key: 'hs_payment_status', label: 'Payment Status', type: 'select' as const, options: ['pending', 'paid', 'refunded', 'failed'] },
    { key: 'hs_closed_date', label: 'Closed Date', inputType: 'date' as const },
    { key: 'hs_source_store', label: 'Source Store' },
  ];

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const fFields = ORDER_EDIT_FIELDS.map(f => ({
    ...f,
    value: form[f.key] || '',
    onChange: (v: string) => setF(f.key, v),
  }));

  // Open the 360 view dialog and lazily load related records (aligned with
  // the Salesforce Account 360 pattern — related lists live inside the modal).
  const openView = async (order: any) => {
    setViewingOrder(order);
    if (orderDetails[order.id]) return;
    setLoadingDetails(true);
    try {
      const [rd, rli, rco] = await Promise.all([
        callTool('hs__get_associations', { entity_type: 'orders', entity_id: order.id, association_type: 'deals' }).catch(() => null),
        callTool('hs__get_associations', { entity_type: 'orders', entity_id: order.id, association_type: 'line_items' }).catch(() => null),
        callTool('hs__get_associations', { entity_type: 'orders', entity_id: order.id, association_type: 'companies' }).catch(() => null),
      ]);
      setOrderDetails(p => ({ ...p, [order.id]: { deals: rd?.items || [], line_items: rli?.items || [], companies: rco?.items || [] } }));
    } finally { setLoadingDetails(false); }
  };

  // ── Refresh ───────────────────────────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await callTool('hs__get_orders', { refresh: true });
      if (res?.items) { setLocalItems(res.items); setCacheInfo(res._cache); }
    } catch { toast('Refresh failed', { intent: 'error' }); }
    setRefreshing(false);
  };

  // ── Save (edit) ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await callTool('hs__update_order', { order_id: editingId, ...form });
      if (res?.type === 'error' || res?.type === 'alert') {
        toast(res.message || 'Update failed', { intent: 'error' });
        setSaving(false);
        return;
      }
      if (res?.items) { setLocalItems(res.items); setCacheInfo(res._cache); }
      setLastSavedId(editingId);
      setTimeout(() => setLastSavedId(null), 2200);
      toast('Order updated');
      setEditingId(null);
    } catch { toast('Save failed', { intent: 'error' }); }
    finally { setSaving(false); }
  };

  const openEdit = (order: any) => {
    setViewingOrder(null);
    setForm({
      hs_order_name: order.hs_order_name || '',
      hs_total_price: order.hs_total_price || '',
      hs_currency_code: order.hs_currency_code || '',
      hs_fulfillment_status: order.hs_fulfillment_status || '',
      hs_payment_status: order.hs_payment_status || '',
      hs_closed_date: toDateInput(order.hs_closed_date),
      hs_source_store: order.hs_source_store || '',
    });
    setEditingId(order.id);
  };

  const editingRecord = localItems.find((o: any) => o.id === editingId);
  const orderViewFields = viewingOrder ? [
    { label: 'Order Name', value: viewingOrder.hs_order_name },
    { label: 'Total', value: fmtAmount(viewingOrder.hs_total_price) },
    { label: 'Currency', value: viewingOrder.hs_currency_code },
    { label: 'Fulfillment', value: viewingOrder.hs_fulfillment_status },
    { label: 'Payment', value: viewingOrder.hs_payment_status },
    { label: 'Closed Date', value: fmtDate(viewingOrder.hs_closed_date) },
    { label: 'Source Store', value: viewingOrder.hs_source_store },
    { label: 'Contact', value: viewingOrder.contact },
    { label: 'Company', value: viewingOrder.company },
    { label: 'Deal', value: viewingOrder.deal },
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
        icon={<CartRegular style={{ fontSize: 18, color: tokens.colorBrandForeground1 }} />}
        title="Orders"
        count={localItems.length}
        theme={theme}
        cacheInfo={cacheInfo}
        onRefresh={isFullscreen ? handleRefresh : undefined}
        refreshing={refreshing}
      />
      <Table size="small" aria-label="Orders" style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%' }}>
        <TableHeader>
          <TableRow style={{ background: t.headerBg }}>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak, width: '20%' }}>Order Name</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak, width: '10%' }}>Total</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak, width: '12%' }}>Fulfillment</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak, width: '11%' }}>Payment</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak, width: '12%' }}>Closed</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak, width: '13%' }}>Contact</TableHeaderCell>
            <TableHeaderCell style={{ ...H_CELL, color: t.textWeak, width: '12%' }}>Company</TableHeaderCell>
            {isFullscreen && <TableHeaderCell style={{ ...H_CELL, width: 50, color: t.textWeak }} />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {localItems.length === 0 && (
            <TableRow><TableCell colSpan={99} className={styles.empty}><Text>No orders found.</Text></TableCell></TableRow>
          )}
          {localItems.map((order: any) => (
              <TableRow key={order.id} className="hs-row"
                style={{ borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, ...(lastSavedId === order.id ? { animation: 'hsRowFlash 2s ease-out' } : {}) }}
                aria-label={`Order: ${order.hs_order_name}`}
              >
                <TableCell style={{ ...D_CELL, fontWeight: 600 }}>{order.hs_order_name || '—'}</TableCell>
                <TableCell style={D_CELL}>{fmtAmount(order.hs_total_price)}</TableCell>
                <TableCell style={D_CELL}>{order.hs_fulfillment_status || '—'}</TableCell>
                <TableCell style={D_CELL}>{order.hs_payment_status || '—'}</TableCell>
                <TableCell style={D_CELL}>{fmtDate(order.hs_closed_date)}</TableCell>
                <TableCell style={{ ...D_CELL, color: tokens.colorBrandForeground1 }}>{order.contact || '—'}</TableCell>
                <TableCell style={{ ...D_CELL, color: tokens.colorBrandForeground1 }}>{order.company || '—'}</TableCell>
                {isFullscreen && (
                  <TableCell style={D_CELL}>
                    <Button appearance="subtle" icon={<EyeRegular />} size="small" onClick={() => openView(order)} aria-label={`View ${order.hs_order_name}`} title="View" />
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
          title={`Edit Order: ${editingRecord.hs_order_name}`}
          fields={fFields}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setEditingId(null)}
          mode="edit"
        />
      )}
      <Dialog open={!!viewingOrder} onOpenChange={(_, data) => { if (!data.open) setViewingOrder(null); }}>
        <DialogSurface style={{ maxWidth: '820px', width: '92vw', padding: '24px' }}>
          <DialogBody>
            <DialogTitle style={{ fontSize: '18px', fontWeight: 700, color: tokens.colorBrandForeground1 }}>
              {viewingOrder?.hs_order_name || 'Order'}
            </DialogTitle>
            <DialogContent style={{ paddingTop: '16px' }}>
              {viewingOrder && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 28px' }}>
                    {orderViewFields.map(field => (
                      <div key={field.label} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                        <div style={{ color: t.textWeak, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{field.label}</div>
                        <div style={{ color: ['Company', 'Contact', 'Deal'].includes(field.label) ? tokens.colorBrandForeground1 : t.text, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{field.value || '—'}</div>
                      </div>
                    ))}
                  </div>
                  {loadingDetails && !orderDetails[viewingOrder.id] ? (
                    <div style={{ padding: 20, textAlign: 'center' }}><Spinner size="small" label="Loading related records…" /></div>
                  ) : orderDetails[viewingOrder.id] && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <RelatedList title="Deals" count={orderDetails[viewingOrder.id].deals.length}
                        headers={['Deal', 'Amount', 'Stage', 'Close Date']}
                        rows={orderDetails[viewingOrder.id].deals.map((d: any) => [d.dealname || '—', d.amount != null && d.amount !== '' ? '$' + Number(d.amount).toLocaleString() : '—', d.dealstage || '—', d.closedate ? new Date(d.closedate).toLocaleDateString() : '—'])} />
                      <RelatedList title="Line Items" count={orderDetails[viewingOrder.id].line_items.length}
                        headers={['Name', 'Qty', 'Price', 'Amount', 'SKU']}
                        rows={orderDetails[viewingOrder.id].line_items.map((li: any) => [li.name || '—', li.quantity || '—', li.price ? '$' + Number(li.price).toLocaleString() : '—', li.amount ? '$' + Number(li.amount).toLocaleString() : '—', li.sku || '—'])} />
                      <RelatedList title="Companies" count={orderDetails[viewingOrder.id].companies.length}
                        headers={['Name', 'Domain', 'City']}
                        rows={orderDetails[viewingOrder.id].companies.map((co: any) => [co.name || '—', co.domain || '—', co.city || '—'])} />
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
            <DialogActions style={{ paddingTop: '16px' }}>
              <Button appearance="secondary" icon={<DismissRegular />} onClick={() => setViewingOrder(null)}>Close</Button>
              {viewingOrder && (
                <Button appearance="primary" icon={<EditRegular />} onClick={() => openEdit(viewingOrder)}>Edit</Button>
              )}
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
