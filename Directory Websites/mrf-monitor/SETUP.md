# MRF Monitor setup

The MRF Monitor reads and writes the Company Sheet 2 Apps Script deployment. Configure the optional sync relay to enable automatic updates while the page is open.

## Sync relay

1. Start `sync-relay.cjs` on a reachable server with `SYNC_RELAY_SECRET` set.
2. Set `window.HR_PORTAL_SYNC_RELAY` to that server's base URL before `api-config.js` loads.
3. Set the Apps Script project properties `SYNC_RELAY_URL` and `SYNC_RELAY_SECRET` to the same values.
4. Run `setupDatabase()` once from Apps Script to create the outbox and retry trigger.

The relay uses Server-Sent Events. The website continues to use Google Sheets as the canonical data source and reloads records after each `mrf.changed` event. The manual Refresh button remains available for recovery.

## Notes

- The frontend limits uploads to 5 MB.
- Pending relay events are retained in the `Sync Outbox` sheet and retried with exponential backoff.
- Do not commit relay secrets or the generated `sync-relay-events.json` state file.
