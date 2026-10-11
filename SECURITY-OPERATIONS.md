# Security and Operations

## Enabled at the website edge

- Vercel serves this static site through its CDN and scales static delivery without a separately managed origin load balancer.
- `vercel.json` sets HSTS, clickjacking and MIME-sniffing protections, a restrictive Permissions Policy, and a Content Security Policy.
- Root `/assets`, `/css`, `/images`, and `/js` files have short browser caching and one-day shared-edge caching. HR pages and data requests are not given these asset cache rules.

## Not yet provided by this architecture

- **Authorization and RLS:** Google Sheets and Apps Script do not provide row-level security for these endpoints. Browser session state is not a trusted identity, and UI route guards do not protect API actions. Every protected read and write needs server-side authentication and role checks, or the data must move to a database with enforced RLS policies.
- **Login transport:** The website now sends HR login credentials in a POST body rather than URL query parameters. Redeploy the updated Company Sheet 1 Apps Script project for this change to take effect; this does not replace TLS or server-side authorization.
- **Rate limiting:** Requests go directly from browsers to public Apps Script deployments. Vercel Firewall rules cannot limit requests that bypass Vercel. Put the data API behind a rate-limited server-side gateway before treating login, recovery, uploads, or writes as protected.
- **Credential handling:** The Apps Script source contains seeded account credentials and stores account passwords in the spreadsheet. Remove seeded credentials and migrate to salted password hashing and managed secrets as part of the authenticated backend work. Do not rely on client-side checks to compensate.
- **Load balancing and backend scaling:** Vercel handles static delivery, but it does not balance or scale the Google Apps Script services. Apps Script execution quotas and Sheets/Drive limits remain the backend capacity boundary.
- **Error tracking:** Vercel deployment logs do not capture browser JavaScript errors or Apps Script execution failures end-to-end. Select an error monitoring provider, configure its client key and privacy settings, and add server-side reporting after introducing a gateway.
- **Availability and recovery:** Vercel deployments can be rolled back, but that does not restore spreadsheet or Drive data. Establish tested, scheduled backups for both spreadsheets and upload folders, define recovery objectives, and periodically test restoration.

## Before calling the system production-secure

1. Move protected HR endpoints behind a server-side API and issue short-lived, signed sessions after login. Never accept a browser-provided role or session flag as authorization.
2. Replace plaintext and seeded credentials; restrict account recovery and account administration to verified identities.
3. Enforce per-user/role access on every API action and data record. If adopting a database, enable and test RLS with least-privilege policies for anonymous, authenticated, and HR roles.
4. Add edge or gateway throttling for login, recovery, uploads, and mutation actions, with request-size limits and abuse alerts.
5. Configure error monitoring, alert routing, spreadsheet/Drive backups, and a documented restore test.

The inline scripts and styles currently required by the pages mean the CSP still includes `'unsafe-inline'`. Removing that allowance requires migrating inline code/styles to external files or using per-response nonces.