# CallNexa Web Application

## Team handoff document

This is the current team-facing document for the CallNexa web application. It describes what is in the web app now, what each role can do, what is intentionally hidden, and what is still waiting for a later phase.

**Current scope:** Web application only. Mobile call-log and sync work remains separate and is not being changed in this phase.

## Current status

The core web application is implemented and working locally. The main workflows are connected to the FastAPI backend, authentication is real, organization data is isolated, and the web production build passes.

The application is ready for team review and workflow testing.

Two areas are intentionally deferred:

- The Integrations page is hidden from authenticated navigation and routes.
- Payment processing is not active yet. When a customer chooses a plan, CallNexa shows the sales contact popup instead of starting checkout.

## What the web application does

CallNexa helps organizations monitor sales calls, manage customer relationships, follow up on opportunities, and review team performance from one web dashboard.

The web app supports:

- Organization dashboards.
- Employee-specific dashboards.
- Super Admin platform management.
- Call logs, recordings, transcripts, notes, and call outcomes.
- Leads and customer profiles.
- Customer activity timelines.
- Open opportunities and closed deals.
- Calendar-based follow-up scheduling and completion.
- Team performance analytics.
- Device health monitoring.
- Reports and exports.
- Organization settings and account security.
- Subscription pricing and billing structure.

## User roles

### Organization / Company

Company users can manage their organization and see organization-scoped data.

They can:

- View company call activity.
- Review employee performance.
- Manage employees.
- Manage leads and customers.
- Manage opportunities.
- Schedule and complete follow-ups.
- Review transcripts and recordings where permitted.
- Monitor connected devices.
- View analytics and reports.
- Manage excluded phone numbers.
- View pricing, subscription information, and invoices.
- Edit their profile, theme, WhatsApp number, password, and 2FA settings.

### Employee

Employees see their own work and assigned data.

They can:

- View their dashboard.
- View their own call logs.
- Update their own call notes and outcomes where allowed.
- View assigned leads and customers.
- View assigned opportunities.
- View closed deals assigned to them.
- View and complete their follow-ups.
- Use their own settings and security controls.

Employees do not receive organization-only actions such as adding leads, bulk lead uploads, employee management, organization billing, or platform administration.

### Super Admin

Super Admins manage the CallNexa platform.

They can:

- View organizations.
- Create, suspend, activate, and delete organizations.
- Reset organization administrator passwords.
- Review platform employees, devices, SIMs, calls, and sync health.
- Review audit logs and system health.
- Review application versions.
- Search across platform records.
- Manage subscription plans, prices, and organization subscriptions.
- Extend or suspend subscriptions with an audit reason.

## Main web navigation

### Dashboard

The dashboard shows the organization or employee overview, including:

- Call KPIs.
- Connected and missed calls.
- Talk time.
- Hot leads.
- Team leaderboard.
- Opportunity pipeline.
- Device health.
- Needs-attention items.
- Recent activity.

Dashboard cards and attention items navigate to the related page.

### Calls

Calls contains:

- Call Logs.
- Transcripts.
- Follow-up Calendar.

The Follow-up Calendar supports day, week, and month views, pending/completed filters, a next follow-up banner, and a right-side details drawer for opening, editing, or completing an event.

- Search by customer, phone number, or employee.
- Incoming, outgoing, missed, rejected, and recorded filters.
- Employee filtering for organization users.
- CSV export.
- Refresh and auto-refresh.
- Call Intelligence drawer.
- Call notes and progress status.
- Follow-up scheduling.
- Recording playback when available.
- Transcript and summary access when permitted.
- Privacy controls where permitted.
- Call and WhatsApp actions where configured.

### Team / Employees

The Team page supports:

- Employee registration.
- Day, week, and month analytics.
- Employee profile drawers.
- Employee call history.
- Device and battery status.
- Employee export.
- Deactivate employee.
- Restore employee.
- Trashed employee view.
- Mobile onboarding guidance.

### Leads

Leads supports:

- Search.
- Status filtering.
- CSV export.
- Add lead for authorized organization users.
- Bulk CSV upload for authorized organization users.
- Lead status updates.
- Employee assignment visibility.
- Follow-up and expected-value information.

Employees can view their permitted leads but do not receive admin-only creation and bulk-upload controls.

### Customers

Customers supports:

- Search by name, phone, email, or company.
- Manual customer creation.
- Customer editing.
- Customer profile drawer.
- Normalized phone-number matching.
- Customer activity timeline.

The activity timeline can include:

- Calls.
- Call outcomes.
- Leads.
- Opportunities.
- Follow-ups.

Customer records are organization-scoped.

### Opportunities

Opportunities supports:

- Open pipeline view.
- New, Qualified, Proposal, and Negotiation stages.
- Opportunity value and probability.
- Expected close date.
- Next action.
- Notes.
- Stage changes for authorized users.
- Won and Lost actions.
- Closed Deals view.
- Reopening a closed opportunity.
- Employee-specific opportunity visibility.

### Analytics and Reports

Analytics and Reports show team and organization performance using backend data.

They include:

- Call volume.
- Connected-call rate.
- Missed calls.
- Talk time.
- Daily activity.
- Outcomes.
- Employee leaderboard.
- Performance summaries.
- Exportable report data.

### Devices

Device Health supports:

- Device list.
- Online and offline status.
- Battery level.
- Android and app version.
- Last sync time.
- Permission status.
- SIM information.
- Reconnect request for offline devices.

### Billing and Invoices

The Billing area currently contains:

- Subscription pricing.
- Organization seat usage.
- Current subscription state when configured.
- Payment history when payments exist.
- Invoice history.
- Invoice detail data.
- Invoice download using server-backed invoice information.

Cashfree payment checkout is intentionally not exposed yet.

When a user selects a package, the web app opens a contact popup instead of creating a payment order.

The popup shows:

- Phone: **+91 83415 51387**
- Email: **suresh.md@tzmicha.com**

The phone link opens the dialer. The email link opens the user’s email client.

### Settings

Settings supports:

- Organization details.
- Light and dark theme.
- Profile editing.
- Email notification preference for the current browser.
- WhatsApp number configuration.
- Password change.
- Google Authenticator 2FA setup.
- 2FA verification and disabling.

### Excluded Numbers

Authorized organization users can:

- View excluded phone numbers.
- Add a number.
- Add a reason.
- Remove an excluded number.

## Public pages

The public web application includes:

- Landing page.
- Features page.
- Pricing page.

The public Pricing page now shows all four packages and all three durations.

## Official pricing

The source prices are stored as regular price and selling price. Prices are not recalculated by the frontend.

Currency: INR.

| Package | Duration | Regular price | Selling price |
|---|---:|---:|---:|
| Starter — 5 members | 1 Month | ₹2,458 | ₹1,499 |
| Starter — 5 members | 6 Months | ₹9,750 | ₹5,999 |
| Starter — 5 members | 1 Year | ₹17,500 | ₹6,999 |
| Growth — 10 members | 1 Month | ₹3,083 | ₹1,849 |
| Growth — 10 members | 6 Months | ₹13,500 | ₹8,099 |
| Growth — 10 members | 1 Year | ₹25,000 | ₹9,999 |
| Professional — 15 members | 1 Month | ₹4,542 | ₹2,799 |
| Professional — 15 members | 6 Months | ₹22,250 | ₹13,349 |
| Professional — 15 members | 1 Year | ₹42,500 | ₹16,999 |
| Business — 20 members | 1 Month | ₹5,167 | ₹3,099 |
| Business — 20 members | 6 Months | ₹26,000 | ₹15,599 |
| Business — 20 members | 1 Year | ₹50,000 | ₹19,999 |

The selling price shown above is the exact configured value. It is not converted into a monthly equivalent.

## Subscription and billing backend

The backend now contains the foundation for:

- Subscription plans.
- Plan prices.
- Organization subscriptions.
- Payments.
- Invoice price snapshots.
- Member limits.
- Subscription status.
- Payment verification.
- Webhook idempotency.
- Super Admin price management.
- Subscription extension and suspension audit records.

Migration applied:

```text
backend/migrations/018_subscription_billing.sql
```

Important backend routes include:

```text
GET  /api/v1/subscription/plans
GET  /api/v1/subscription/plans/{id}
GET  /api/v1/subscription/current
POST /api/v1/subscription/checkout
POST /api/v1/subscription/payment/verify
POST /api/v1/subscription/webhook
GET  /api/v1/subscription/payments
POST /api/v1/subscription/renew
POST /api/v1/subscription/change-plan
GET  /api/v1/subscription/invoices
GET  /api/v1/subscription/invoices/{id}
GET  /api/v1/subscription/usage
```

Super Admin billing routes include:

```text
GET   /api/v1/admin/plans
POST  /api/v1/admin/plans
PATCH /api/v1/admin/plans/{id}
PATCH /api/v1/admin/plan-prices/{id}
GET   /api/v1/admin/subscriptions
POST  /api/v1/admin/subscriptions/{id}/extend
POST  /api/v1/admin/subscriptions/{id}/suspend
```

## Seat enforcement

When an organization has an active subscription, the selected package controls active member capacity.

Examples:

- Starter allows 5 active members.
- Growth allows 10 active members.
- Professional allows 15 active members.
- Business allows 20 active members.

Seat checks are enforced when:

- An admin creates an employee.
- An employee registers using the organization code.

Super Admin accounts are not counted as organization seats.

Existing organizations without a purchased subscription remain in legacy mode so current users are not unexpectedly locked out. Seat enforcement begins when a subscription is activated.

## Intentionally hidden or deferred

### Integrations

The Integrations page is hidden from authenticated navigation and routes. Its code remains available for a later phase.

No fake CRM connection or fake sync success is shown to users.

### Cashfree payments

Cashfree is not connected yet.

The application does not claim payment success, does not activate subscriptions from the browser, and does not expose payment checkout to customers.

When the business is ready, Cashfree can be connected through the existing provider-independent billing structure.

### Automatic billing operations

These are not active yet:

- Automatic renewal jobs.
- Expiry reminder jobs.
- Email billing notifications.
- Refund processing.
- Live payment-provider reconciliation.
- PDF invoice generation.

## Security and data rules

- Authentication remains required.
- Organization data is scoped by organization ID.
- Employee users receive employee-scoped data.
- Billing mutations require organization admin permission.
- Super Admin billing controls require Super Admin permission.
- Backend pricing is the source of truth.
- Payment secrets must remain server-side.
- Customer, call, recording, invoice, and audit data must not be deleted because a subscription expires.
- Cashfree or another provider must verify payment server-side before activation.

## Local development

Backend:

```powershell
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Web:

```powershell
cd web
npm run dev
```

Current local URLs:

- Web: `http://localhost:5174`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

## Validation completed

The following checks pass:

```text
npm run build
python -m compileall -q app
python migration_runner.py --check
git diff --check
```

The local pricing API was also checked for all 12 combinations. All 12 regular prices and selling prices matched the official source values exactly.

## Recommended team testing

### Company account

- Sign in.
- Open Dashboard.
- Open Calls and search a phone number.
- Open a call and save a note.
- Schedule a follow-up.
- Complete the follow-up.
- Open Leads and update a lead status.
- Open Customers and edit a customer.
- Open Opportunities and move an opportunity to Won or Lost.
- Reopen a closed deal.
- Open Employees and deactivate or restore an employee.
- Open Analytics and Reports.
- Open Devices.
- Open Settings and test profile, password, theme, and 2FA controls.
- Open Subscription and select a package.
- Confirm the contact popup displays the correct phone and email.
- Confirm no payment screen opens.

### Employee account

- Confirm only own calls, leads, customers, opportunities, and follow-ups are visible.
- Confirm admin-only lead creation controls are hidden.
- Confirm employee settings work.

### Super Admin account

- Open platform tabs.
- Open Billing.
- Review the four plans and 12 prices.
- Edit a plan price only in a test environment.
- Review organization subscriptions.
- Confirm extension and suspension require an audit reason.

## Source files

Main frontend files:

- `web/src/App.jsx`
- `web/src/components/PremiumLayout.jsx`
- `web/src/pages/Dashboard.jsx`
- `web/src/pages/CallLogs.jsx`
- `web/src/pages/Leads.jsx`
- `web/src/pages/Customers.jsx`
- `web/src/pages/Opportunities.jsx`
- `web/src/pages/FollowUps.jsx`
- `web/src/pages/Employees.jsx`
- `web/src/pages/Subscription.jsx`
- `web/src/pages/PricingPage.jsx`
- `web/src/pages/Invoices.jsx`
- `web/src/pages/Settings.jsx`
- `web/src/pages/SuperAdmin.jsx`

Main billing files:

- `backend/app/routers/billing.py`
- `backend/app/billing_service.py`
- `backend/app/models/billing.py`
- `backend/app/models/invoice.py`
- `backend/app/models/organization.py`
- `backend/migrations/018_subscription_billing.sql`

## Final handoff note

The web app is ready for team review and local acceptance testing.

The core application is implemented. Payment provider activation is intentionally waiting for the business decision and Cashfree setup. No GitHub push has been made from this work.
