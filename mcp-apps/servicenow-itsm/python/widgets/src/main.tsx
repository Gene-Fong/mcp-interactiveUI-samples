import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  ErrorBoundary,
  McpBridgeProvider,
  FluentWrapper,
  ToastContainer,
} from '@gtc/mcp-shared';
import { ServiceNowApp } from './App';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <McpBridgeProvider appName="gtc-snow-widget">
      <FluentWrapper>
        <ServiceNowApp />
        <ToastContainer />
      </FluentWrapper>
    </McpBridgeProvider>
  </ErrorBoundary>
);
