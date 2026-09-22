# Apps Script backends

Use these as two separate Google Apps Script projects.

## Company Sheet 1

1. Open the Apps Script project connected to spreadsheet `1utH1iEiYiGOCZjAQ4_z3Mb3KdJcSDUHDyMVMnbNbTSA`.
2. Replace the project code with `company-sheet-1.gs`.
3. Save and deploy a new Web app version.
4. Execute as the spreadsheet owner and grant access to the intended website users.
5. Keep the deployment URL used by the website as the Sheet 1 URL.

On the first request after deployment, the script migrates the existing `Referrals` and `201 Files` headers by name, repairs missing IDs, and normalizes existing 201 Drive filenames. Do not delete the existing tabs before running this migration.

This project handles employee referrals and the `201 Files` directory. It uses `CANDIDATE_RESUMES` for referral uploads and `SCANNED_FILES_OJT` for employee files.

## Company Sheet 2

1. Open the Apps Script project connected to spreadsheet `195-mJN-MRhswL6DQl3nIeXfYxmEAi7ufQd1ebrIXbII`.
2. Replace the project code with `company-sheet-2.gs`.
3. Save and deploy a new Web app version.
4. Execute as the spreadsheet owner and grant access to the intended website users.
5. Keep the deployment URL used by the website as the Sheet 2 URL.

On the first request after deployment, the script migrates both the `MRF`/`MRF Requests` tab and the `Applicants` tab by header name. This prevents old column orders from putting IDs, timestamps, or emails under the wrong headings.

This project handles MRF Monitor and Applicant Intake. It uses `MRF_MONITORING_DATABASE` for MRF uploads and `CANDIDATE_RESUMES` for applicant resumes.

MRF headcount is derived from the Applicants tab: every applicant with an `MRF Transfer` is counted as assigned. An MRF is `In Progress` below its original headcount, `Filled` at the requested headcount, and `Overfilled` above it. Overfilled MRF status cells are highlighted red. Applicant status is not used; assigning an MRF transfer indicates the applicant is hired.

## Required permissions

The owner account must have edit access to both spreadsheets and editor access to all four Drive folders. When ownership moves to the company account, transfer or recreate the Apps Script deployments under that account and update the website URLs only if the deployment IDs change.

The website expects JSON responses and these actions:

- Sheet 1: default `GET`, referral `POST` without an action, `GET?action=201-list`
- Sheet 2: default `GET`, `POST` actions `save` and `delete`, `GET?action=applicant-list`, `POST` action `save-applicant`

The currently deployed URLs must be updated to the new version. The old deployment can continue returning `Unknown action` until the new version is selected under **Deploy > Manage deployments**.
