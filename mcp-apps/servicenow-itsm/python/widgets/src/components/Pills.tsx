import { tokens } from '@fluentui/react-components';
import {
  APPROVAL_STYLES,
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  RISK_LABELS,
  RISK_STYLES,
  STATE_STYLES,
} from '../constants';

export function PriorityPill({ priority, theme }: { priority: string; theme: 'light' | 'dark' }) {
  const key = String(priority).charAt(0);
  const style = PRIORITY_STYLES[key] || PRIORITY_STYLES['3'];
  return (
    <span style={{
      display: 'inline-block', padding: '4px 12px', borderRadius: '4px',
      fontSize: '12px', fontWeight: 600, letterSpacing: '0.2px',
      background: style.background, color: style.color, border: `1px solid ${style.border}`,
    }}>
      {PRIORITY_LABELS[key] || priority || '—'}
    </span>
  );
}

export function StatePill({ state, theme }: { state: string; theme: 'light' | 'dark' }) {
  const key = (state || '').toLowerCase();
  const style = STATE_STYLES[key] || { background: '#EAEAEA', color: '#555', border: tokens.colorNeutralStroke2 };
  return (
    <span style={{
      display: 'inline-block', padding: '4px 12px', borderRadius: '4px',
      fontSize: '12px', fontWeight: 500,
      background: style.background, color: style.color, border: `1px solid ${style.border}`,
    }}>
      {state || '—'}
    </span>
  );
}

export function ApprovalPill({ approval, theme }: { approval: string; theme: 'light' | 'dark' }) {
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

export function RiskPill({ risk, theme }: { risk: string; theme: 'light' | 'dark' }) {
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

export function SlaPill({ slaDue, madeSla, theme: _theme }: { slaDue?: string; madeSla?: boolean; theme: 'light' | 'dark' }) {
  if (!slaDue) return <span style={{ color: tokens.colorNeutralForeground3, fontSize: '11px' }}>—</span>;
  const breached = madeSla === false;
  const met = madeSla === true;
  const bg = breached ? tokens.colorPaletteRedBackground1 : met ? tokens.colorPaletteGreenBackground1 : tokens.colorNeutralBackground2;
  const color = breached ? tokens.colorPaletteRedForeground2 : met ? tokens.colorPaletteGreenForeground2 : tokens.colorNeutralForeground2;
  const border = breached ? tokens.colorPaletteRedBorder1 : met ? tokens.colorPaletteGreenBorder1 : tokens.colorNeutralStroke2;
  const label = breached ? 'Breached' : met ? 'Met' : slaDue;
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '15px', fontSize: '11px', fontWeight: 500, background: bg, color, border: `1px solid ${border}` }}>
      {label}
    </span>
  );
}
