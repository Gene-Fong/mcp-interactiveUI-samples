// Ask - HubSpot — Azure Container Apps deployment parameters
//
// Copy this file to parameters.bicepparam (gitignored) and fill in real values.
//
// Usage:
//   cp deploy/parameters.example.bicepparam deploy/parameters.bicepparam
//   .\deploy\AzureImageSetup.ps1

using './main.bicep'

param environmentName  = 'lob-mcp-apps-env'
param acrName          = 'lobmcpapps'         // must be globally unique, lowercase, no hyphens
param location         = 'southindia'
param logRetentionDays = 30

// ── HubSpot credentials ───────────────────────────────────────────────────────
param hubspotAccessToken = ''                 // HubSpot Private App access token (pat-...)

// ── App Insights (optional) ───────────────────────────────────────────────────
param appInsightsConnectionString = ''
param appInsightsRoleName         = 'lob-mcp-hs'
