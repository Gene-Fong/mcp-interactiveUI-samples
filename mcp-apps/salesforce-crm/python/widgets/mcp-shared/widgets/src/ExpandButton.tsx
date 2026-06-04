import React from 'react';
import { useMcpBridge } from './McpBridge';
import { ChevronDownRegular } from '@fluentui/react-icons';

export function ExpandButton() {
  const { canExpand, isFullscreen, requestFullscreen, exitFullscreen } = useMcpBridge();

  if (!canExpand) return null;

  return (
    <button
      onClick={isFullscreen ? exitFullscreen : requestFullscreen}
      aria-label={isFullscreen ? 'Exit expanded view' : 'Expand to fullscreen'}
      aria-pressed={isFullscreen}
      title={isFullscreen ? 'Exit expanded view' : 'Expand'}
      style={{
        background: '#fff',
        border: '1px solid rgba(0,0,0,0.1)',
        color: '#000',
        borderRadius: '4px',
        height: '32px',
        padding: '0 16px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        boxShadow: 'none',
      }}
    >
      {isFullscreen ? '✕ Exit' : <><ChevronDownRegular style={{ fontSize: '16px' }} /> Expand</>}
    </button>
  );
}
