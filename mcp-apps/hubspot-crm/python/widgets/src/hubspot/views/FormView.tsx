import React, { useState } from 'react';
import { Button, Field, Input, Textarea, tokens } from '@fluentui/react-components';
import { SaveRegular, AddRegular } from '@fluentui/react-icons';
import { useStyles } from '../styles';
import { hs } from '../theme';
import { FormSelect } from '../components/FormSelect';
import { HsFooter } from '../components/HsFooter';
import { ExpandButton } from '../../shared/ExpandButton';
import { useMcpBridge } from '../../shared/McpBridge';

// ── FkHint — conditional footer for FK fields ──────────────────────────────
function FkHint({ fields, theme }: { fields: any[]; theme: 'light' | 'dark' }) {
  const t = hs(theme);
  const hasFk = fields.some(f => f.fk);
  if (!hasFk) return null;
  return (
    <div style={{
      marginTop: '12px', paddingTop: '8px', fontSize: '11px',
      color: t.textWeak, borderTop: `1px solid ${t.border}`, lineHeight: 1.4,
    }}>
      🔗 Lookup fields link to other HubSpot records. Type the full name — we look up on save and show suggestions if no exact match.
    </div>
  );
}

// ── FormView — standalone create/edit form (schema-driven) ─────────────────
export function FormView({ data, callTool, toast, theme }: {
  data: any; callTool: (n: string, a?: any) => Promise<any>;
  toast: (m: string, t?: any) => void; theme: 'light' | 'dark';
}) {
  const styles = useStyles();
  const t = hs(theme);
  const { navigate } = useMcpBridge();
  const isEdit = data.mode === 'edit';
  const entity = data.entity || 'company';
  const prefill = data.prefill || {};
  const schema = data._schema || {};
  const allFormFields: any[] = schema.formFields || [];
  // FK association fields (company_name/contact_name/deal_name) create links at
  // create time only — the update handlers do NOT re-associate, so showing them
  // on an edit form would silently drop the value. Hide them when editing.
  const formFields: any[] = isEdit ? allFormFields.filter((f: any) => !f.fk) : allFormFields;

  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    formFields.forEach((f: any) => { init[f.name] = prefill[f.name] || ''; });
    return init;
  });
  const [saving, setSaving] = useState(false);

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const getToolName = (action: 'create' | 'update' | 'get') => {
    if (action === 'create') return `hs__create_${entity}`;
    if (action === 'update') return `hs__update_${entity}`;
    const plural: Record<string, string> = { company: 'companies', contact: 'contacts', deal: 'deals', order: 'orders', product: 'products' };
    return `hs__get_${plural[entity] || 'companies'}`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let result: any;
      if (isEdit) {
        result = await callTool(getToolName('update'), { [`${entity}_id`]: data.recordId, ...form });
      } else {
        result = await callTool(getToolName('create'), form);
      }
      // FK alert or API error — persistent toast, stay on form
      if (result && (result.type === 'alert' || result.type === 'error')) {
        toast(result.message || 'Cannot complete — please correct and retry.', { intent: 'error', duration: 0 });
        setSaving(false);
        return;
      }
      toast(`${entityLabel} ${isEdit ? 'updated' : 'created'}`);
      // Redirect to the list view (refreshed). navigate() swaps the rendered
      // view directly — a fire-and-forget call would be suppressed by the
      // widgetCallDepth guard and leave us stranded on the form.
      const list = await callTool(getToolName('get'), { refresh: true });
      navigate(list);
    } catch (e: any) { toast(e.message || 'Failed', { intent: 'error' }); }
    finally { setSaving(false); }
  };

  const handleBack = () => { callTool(getToolName('get'), {}); };

  const entityLabel = entity.charAt(0).toUpperCase() + entity.slice(1);

  return (
    <div className={styles.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '16px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: tokens.colorNeutralForeground1 }}>
          {isEdit ? `Edit ${entityLabel}` : `New ${entityLabel}`}
        </h2>
        <ExpandButton />
      </div>
      <div className={styles.formPanel}>
        <div className={styles.formGrid}>
          {formFields.map((f: any) =>
            f.multiline ? (
              <Field key={f.name} label={f.label} size="small" required={f.required} style={{ gridColumn: '1 / -1' }}>
                <Textarea size="small" rows={3} resize="vertical" value={form[f.name]} onChange={(_, d) => setF(f.name, d.value)} aria-label={f.label} />
              </Field>
            ) : f.picklist ? (
              <FormSelect key={f.name} label={f.label} value={form[f.name]} options={f.picklist} onChange={v => setF(f.name, v)} labels={f.picklistLabels} />
            ) : (
              <Field key={f.name} label={f.label} size="small" required={f.required}>
                <Input size="small" type={f.inputType || 'text'} value={form[f.name]} onChange={(_, d) => setF(f.name, d.value)} aria-label={f.label} />
              </Field>
            )
          )}
        </div>
        <FkHint fields={formFields} theme={theme} />
        <div className={styles.formActions}>
          <Button appearance="secondary" onClick={handleBack} disabled={saving}>Cancel</Button>
          <Button appearance="primary" onClick={handleSave} disabled={saving}
            icon={isEdit ? <SaveRegular /> : <AddRegular />}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      <HsFooter theme={theme} />
    </div>
  );
}
