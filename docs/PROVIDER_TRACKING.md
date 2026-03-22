# Provider Tracking Implementation

## Overview
This implementation adds provider tracking to intraday ticks, ensuring intraday charts only show data from one provider at a time for spread consistency.

## Changes Made

### 1. Database (database.js)
- Added `provider_id` column to `intraday_ticks` table
- Added index on `provider_id` for faster filtering

### 2. Backend goldPriceService.js
- Modified `saveIntradayTick(priceData, providerId)` to accept and store provider_id
- Modified `getIntradayTicks(startDate, endDate, providerId?)` to accept optional provider filter
- Updated `fetchFromSwissquoteOnly()` to pass 'swissquote' as provider_id
- Updated `fetchFromConfiguredApi()` to pass the provider.id
- Updated `updateDailyAggregate()` to also track provider_id

### 3. Backend index.js API
- Updated `/api/price/intraday` endpoint to accept optional `providerId` query param
- Pass providerId to getIntradayTicks()

### 4. Frontend useStore.ts
- Added `activeProviderId` state
- Modified `fetchIntradayData()` to fetch `/api/price/intraday?providerId=${activeProviderId}` if set
- Added `setActiveProviderId` action

### 5. Frontend IntradayChart.tsx
- Displays which provider's data is being shown
- Shows warning if viewing data from a different provider than currently active

## Historical Data Note

The historical charts use `price_history` (FreeGoldAPI daily data) and `daily_aggregates` (computed from Swissquote). These are not provider-specific because:

1. **price_history**: Contains daily data from FreeGoldAPI used as reference for historical charts
2. **daily_aggregates**: Computed from Swissquote intraday ticks, but represent daily OHLC values

These tables maintain their own `source` column for informational purposes, but are not filtered by active provider in the same way as intraday ticks.

## Data Flow

1. Price data is fetched from configured provider (Swissquote or custom API)
2. Each tick is saved with `provider_id` identifying the source
3. Frontend requests intraday data with optional `providerId` filter
4. If `providerId` is specified, only ticks from that provider are returned
5. Intraday chart displays data source and warns if viewing different provider's data
