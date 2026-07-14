# PROJECT_STATUS

## Aurora Commercial Integration V1

- MT5 License API Client: added in `commerce-api/src/clients/mt5LicenseApiClient.js`.
- XAU License API Client: added in `commerce-api/src/clients/xauLicenseApiClient.js`.
- Commerce Router: added in `commerce-api/src/router.js`.
- Product Dispatcher: routes product IDs to MT5 or XAU license API clients.
- Download Dispatcher: resolves product-specific download links without implementing download logic.
- Email Dispatcher: sends through external email API when configured; otherwise returns a skipped dispatch response.
- Webhook Handler: accepts PayPal webhook events and orchestrates Product -> License API -> Email -> Download link flow.
- Removed placeholder License Server from Docker Compose and Nginx routing.
- Scope: no License generation, no machine binding, no activation, no validation, no MT5/XAU business logic changes.

## Aurora Product Experience V1.0

- Customer Trust: Trust Center copy now states live API source, no mock fallback and buyer-verifiable signals.
- Product Value Expression: Product detail highlights now focus on live trading visibility, Aurora Cloud verification and customer area readiness.
- Conversion Readiness: Pricing and demo pages now guide customers toward reservation, trust verification and demo review without payment logic.
- Scope: no backend added, no API added, no payment logic added, no Cloud changes, no MT5 changes.

## Aurora Platform V1.1

- Customer Experience Upgrade: completed for Aurora MT5 live card.
- MT5 Live Card UI: key-value layout for Broker, Server, Session, Balance, Equity, Open Positions, AI Status, Cloud Status and Last Update.
- Status Color System: Running, Connected, Syncing, Offline, Profit, Loss and Unknown states styled consistently.
- Time Format: Last Update and Last Trade render as relative time.
- Performance Widget: Today P/L, Win Rate, Today's Trades and Last Trade read from Aurora Cloud API.
- Quick Detail: Aurora MT5 card expands inline with Trade Summary, Recent Trades, System Health and Cloud Status.
- Scope: no new products, no new pages, no mock data, no Cloud changes, no MT5 changes, no Battle Test changes.

## Aurora Platform Customer Journey

- Sprint 151 Customer Journey: Landing Page -> View Live MT5 -> Product Detail -> Pricing -> Compare Plans -> Book Demo -> Buy Now -> Checkout Reserved -> License Reserved -> Download Reserved -> Customer Portal Reserved.
- Sprint 152 Pricing Page: Starter, Professional and Enterprise plans created without live payment collection.
- Sprint 153 Book Demo: Google Meet scheduling page structure created for future Google Calendar integration.
- Sprint 154 Download Center: Aurora MT5 AI release, version and system requirements page created; download link reserved for Aurora Cloud.
- Sprint 155 Customer Portal: Login, My Products, My Licenses, My Downloads and My Updates structure reserved.
- Sprint 156 Trust Center: Live Trading, Battle Test, Release Notes, System Health, AI Status and Cloud Status read from Aurora Cloud API where available.
- Scope: no Aurora Cloud modification, no Aurora MT5 modification, no mock data added, no real payment or login enabled.

## Customer Area Foundation

- Sprint 161 Customer Area: `/account` created as the post-login reserved customer entry inside Aurora_Website.
- Sprint 162 Customer Dashboard: My Products, My Licenses, Downloads, Updates and Support placeholder cards created.
- Sprint 163 Navigation: public navbar shows Home, Products, Pricing, Book Demo, Trust and Login; account navbar shows Dashboard, My Products, Support and Logout Reserved.
- Sprint 164 Account Layout: shared Customer Layout created with sidebar, content area and top bar.
- Sprint 165 Downloads: customer downloads page reads Aurora Cloud products where available; no download logic implemented.
- Sprint 166 Licenses: My Licenses structure created without license logic.
- Sprint 167 Updates: Update History structure created for future Aurora Cloud connection.
- Sprint 168 Support: Support Center includes FAQ, Contact and Documentation structure.
- Sprint 169 Responsive: layout supports desktop, tablet and mobile breakpoints.
- Sprint 170 PROJECT_STATUS: Customer Area Foundation recorded.
- Scope: no standalone customer portal repository, no mock data, no payment logic, no license logic, no Cloud changes, no MT5 changes.

## Aurora Platform Integration

- Cloud Connected: live Aurora Cloud API verified locally
- Website Connected: live API configured through `VITE_AURORA_CLOUD_API_BASE`
- Live Dashboard: homepage Aurora MT5 card bound to Aurora Cloud `/api/v1/heartbeat`, `/api/v1/status` and `/api/v1/performance`
- Mock Removed: complete
- Platform Ready: compile ready and customer-facing live card verified

## API Integration

- Heartbeat: `/api/v1/heartbeat`
- Status: `/api/v1/status`
- Performance: `/api/v1/performance`
- Auto Refresh: 10 seconds
- Offline State: `Cloud Offline. Waiting for Aurora Cloud... Retry`

## Data Flow

```text
Aurora MT5
  -> Aurora Cloud
  -> Aurora Website
```
