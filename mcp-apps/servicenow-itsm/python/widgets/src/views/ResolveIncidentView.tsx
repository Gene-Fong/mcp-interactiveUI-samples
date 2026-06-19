import React, { useState } from 'react';
import { Button } from '@fluentui/react-components';
import { LockClosedRegular } from '@fluentui/react-icons';
import { ExpandButton } from '@gtc/mcp-shared';
import { PRIORITY_LABELS } from '../constants';
import { NowFooter } from '../components/NowFooter';
import { useStyles } from '../styles';
import { now } from '../theme';

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

export function ResolveIncidentView({ sys_id, number, short_description, description, priority, state, assigned_to, category, callTool, toast, theme, renderList }: {
  sys_id: string;
  number: string;
  short_description?: string;
  description?: string;
  priority?: string;
  state?: string;
  assigned_to?: string;
  category?: string;
  callTool: (name: string, args?: Record<string, any>) => Promise<any>;
  toast: (msg: string, type?: 'success' | 'error' | 'info', timeout?: number) => void;
  theme: 'light' | 'dark';
  renderList: (data: any, callTool: (n: string, a?: any) => Promise<any>, toast: (m: string, t?: any, timeout?: number) => void, theme: 'light' | 'dark') => React.ReactNode;
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
      toast('Incident resolved');
      if (result) setListAfterAction(result);
    } catch (e: any) {
      toast(e.message || 'Failed to resolve incident', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (listAfterAction) {
    const node = renderList(listAfterAction, callTool, toast, theme);
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
          <span style={{ fontSize: '18px', display: 'inline-flex' }}><LockClosedRegular /></span>
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
              icon={<LockClosedRegular />}
              onClick={handleResolve}
              disabled={submitting}
              style={{ background: '#293E40', borderColor: '#293E40', borderRadius: '4px', height: '34px', padding: '0 20px' }}
            >
              {submitting ? '…' : 'Resolve Incident'}
            </Button>
          </div>
        </div>
      <NowFooter theme={theme} />
    </div>
  );
}
