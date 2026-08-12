import React from 'react';
import { Dropdown, Field, Option } from '@fluentui/react-components';

// ── FormSelect ─────────────────────────────────────────────────────────────
export function FormSelect({ label, value, options, onChange, labels }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; labels?: Record<string, string>;
}) {
  const disp = (v: string) => (labels && labels[v]) || v;
  return (
    <Field label={label} size="small">
      <Dropdown size="small" value={value ? disp(value) : '— Select —'}
        selectedOptions={value ? [value] : []}
        onOptionSelect={(_, d) => onChange(d.optionValue || '')}
        aria-label={label}
        style={{ minWidth: 0 }}
      >
        {options.map(o => <Option key={o} value={o}>{disp(o)}</Option>)}
      </Dropdown>
    </Field>
  );
}
