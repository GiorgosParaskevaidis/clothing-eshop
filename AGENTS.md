# Working in this project

This is the existing thesamenot clothing e-shop, located at D:\Projects\clothing-eshop. Continue the existing implementation. Do not create a replacement project or move the source back to C.

## Start here

On 29/10/2026 the user requested preserving all current work, then a WordPress/WooCommerce migration plan for the existing Bluehost Basic. The custom application is committed and pushed at `22deba5`, tagged `pre-wordpress-2026-10-29`. Read `ΠΛΑΝΟ-WORDPRESS.md` for this new direction. Only planning has been requested so far; do not install/publish WordPress, buy licenses, or modify the existing Bluehost sites from this planning request. Future authorized WordPress development belongs under `wordpress/` in this repository, preserving the current `frontend/` and `backend/`. The existing-stack guidance below applies to the preserved custom implementation.

Read README.md, ΟΔΗΓΙΕΣ.md, ΧΑΡΤΗΣ-ΑΡΧΕΙΩΝ.md and ΣΥΝΕΧΕΙΑ-ΕΡΓΟΥ.md before making changes. ΕΛΕΓΧΟΙ.md records what was actually verified and the remaining limitations. The frontend also has its own AGENTS.md with Next.js guidance.

## Collaboration

- Communicate with the user in Greek.
- For each change, identify the actual files and explain their purpose. The user explicitly wants to see which files are being edited.
- Keep the Greek instructions and file map accurate when configuration or setup changes.
- Prefer extending the agreed stack: Next.js/React/TypeScript, ASP.NET Core .NET 10, MariaDB with Dapper/MySqlConnector. As of 27/10/2026 new checkout accepts only Revolut bank transfer and cash on delivery. Read ΠΛΗΡΩΜΕΣ.md. Do not reintroduce Stripe/card checkout; provider code is historical compatibility only.
- Keep backend Minimal API routes in the focused Endpoints modules. Program.cs is only composition/startup; use Hosting for service/pipeline configuration, Middleware for request/error handling, Security for admin credential verification, Validation for request rules, and StoreDatabase for SQL.
- The user runs the backend from Visual Studio and the frontend from VS Code, and uses Microsoft Edge.
- The full VS Code workspace is Thesamenot.code-workspace. Its launch/tasks mirror the frontend-only .vscode configurations; update both when changing frontend startup behavior.

## Local setup

- Frontend: http://localhost:3000. Backend: http://127.0.0.1:5080.
- Backend F5 uses Kestrel and launchBrowser=false. Do not reintroduce the unwanted automatic health-check browser popup.
- Frontend F5 starts Node directly with internalConsole and opens the default browser via openExternally. Edge is the current Windows HTTP default. Browser-debugger attachment previously failed; PowerShell terminal startup previously blocked on PSReadLine trust prompts. The workspace uses Command Prompt.
- The current backend uses the separate local test database thesamenot_test at 127.0.0.1:13307. Its datadir is .local/mariadb-preview; scripts/start-preview-database.ps1 starts it.
- Phases 0/1 were implemented on 13/10/2026; local phases 2–5 followed on 19/10. Local thesamenot_test now has 36 tables and 13 applied migrations after encrypted backup, isolated restore/fingerprints and copied-key/MFA verification (payment-settings migration 013 on 27/10). Bank details and enable/disable are managed at /admin/payments, stored only in payment_settings; legacy BankTransfer configuration is ignored. Auth:Enabled=true and existing enrolled admin/MFA credentials were preserved; owner F5 is required for IDE runs of the new code. Credentials remain in ignored .local/auth-admin-access.txt; preview-access.txt belongs to the old local demo. Never print passwords or SQL identity hashes.
- Read ΦΑΣΕΙΣ-2-5.md, TODO-PRODUCTION.md and deploy/production/README.md for the new commerce contracts and external launch blockers. Source migration/recovery evidence is in ΕΛΕΓΧΟΙ.md and ignored .local/backups/20261019-140705-6078e021. Local restore uses the same Windows user/DPAPI, not an offsite/cross-host production recovery proof.
- Read ΦΑΣΕΙΣ-0-1.md and tools/StoreMaintenance/README.md for the auth contracts. Apply migrations with the separate maintenance tool; do not run runtime DDL or bootstrap another admin. Local activation/backup locations are in ignored .local/phase1-local-activation.json. Development email capture and persistent DPAPI-protected keys use .local/auth-mail and .local/auth-keys.
- The user's existing MariaDB 10.11.14 at 127.0.0.1:3306 is a different server. We have not created the e-shop database there. A future switch requires the appropriate local credentials and StoreSetup workflow. Do not overwrite any existing database.
- Read appsettings.Local.json only as needed, and do not print connection passwords or admin hashes. Local secrets and .local files must remain excluded from Git and clean archives.
- When a port is occupied, identify its owner before acting. Do not stop the user's Visual Studio or VS Code debug sessions just to run checks.

## Verification and release

Run checks appropriate to the change. Preserve unrelated user changes, including generated Next.js files from their dev sessions. There is no need to repeat the full E2E suite for every IDE setting change.

Use node scripts/test-phase1.mjs (or --browser) for database/API checks. It creates its own phase1_<random>_test database on local 13307 and owns ports 5082/3001. It also runs offline Stripe SDK/tax contracts; --focus-payments isolates payment transport/worker contracts. scripts/test-setup.mjs owns a separate random database and runtime SQL users, and removes only those. Never point destructive fixtures at thesamenot_test or online data. Final 19/10 full suite: 66 API + 14 browser; extra 10 offline payment and 7 tax contracts. The manual-payment suite covers the new public checkout; --focus-manual isolates it. Historical Stripe contracts remain offline compatibility checks. Real Revolut/courier/manual-refund verification, S3/proxy/key rotation/offsite recovery and remote CI/deployment remain separate verification.

The app is a local development implementation. Revolut account details, real bank/courier/manual-refund verification, final merchant policies, email delivery, hosting and production operations remain unfinished. Do not describe it as ready for real sales. Bank transfer remains unavailable until the account holder and valid IBAN are configured. No deposit deadline or COD surcharge has been agreed. Manual payment confirmation, cancellation and completed-refund recording use audited admin actions; never mark money received from a customer/browser assertion.

The private GitHub remote is https://github.com/GiorgosParaskevaidis/clothing-eshop. The implementation was pushed to main on 08/10/2026 after merging the initial remote history without force. main tracks origin/main. Two GitHub accounts are stored; use the command-scoped credential.username=GiorgosParaskevaidis override for this repository. Do not force-push or silently switch global identities.
## Remote preview
The authorized remote demo uses deploy/preview/Dockerfile on Render Free and a separate Filess.io database. Preview permits simulation only, requires HTTPS and admin credentials, and rejects Stripe keys. Production still rejects simulation. Read deploy/preview/README.md. Remote credentials stay in ignored .local/render-preview* files. SQL TLS uses an explicitly approved SHA-256 server certificate pin; never silently accept a changed certificate or disable verification. Do not run destructive integration fixtures on the online database. No credit card or paid upgrade is authorized.
