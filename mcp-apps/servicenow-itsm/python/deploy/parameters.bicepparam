// Ask - ServiceNow — Azure Container Apps deployment parameters

using './main.bicep'

param environmentName  = 'lob-mcp-apps-env'
param acrName          = 'lobmcpapps'         // shared with SF — must be globally unique
param location         = 'southindia'
param imageTag         = 'latest'
param logRetentionDays = 30

// ── ServiceNow credentials ────────────────────────────────────────────────────
param servicenowInstance     = '<YOUR_SERVICENOW_INSTANCE>'
param servicenowAuthMode     = 'oauth'
param servicenowClientId     = '<YOUR_SERVICENOW_CLIENT_ID>'
param servicenowClientSecret = '<YOUR_SERVICENOW_CLIENT_SECRET>'
param servicenowUsername     = ''
param servicenowPassword     = ''

// ── App Insights (optional) ───────────────────────────────────────────────────
param appInsightsConnectionString = ''
param appInsightsRoleName         = 'lob-mcp-sn'
