# Working in this project

This is the existing thesamenot clothing e-shop, located at D:\Projects\clothing-eshop. Continue the existing implementation. Do not create a replacement project or move the source back to C.

## Start here

Read README.md, ΟΔΗΓΙΕΣ.md, ΧΑΡΤΗΣ-ΑΡΧΕΙΩΝ.md and ΣΥΝΕΧΕΙΑ-ΕΡΓΟΥ.md before making changes. ΕΛΕΓΧΟΙ.md records what was actually verified and the remaining limitations. The frontend also has its own AGENTS.md with Next.js guidance.

## Collaboration

- Communicate with the user in Greek.
- For each change, identify the actual files and explain their purpose. The user explicitly wants to see which files are being edited.
- Keep the Greek instructions and file map accurate when configuration or setup changes.
- Prefer extending the agreed stack: Next.js/React/TypeScript, ASP.NET Core .NET 10, MariaDB with Dapper/MySqlConnector, Stripe.
- Keep backend Minimal API routes in the focused Endpoints modules. Program.cs is only composition/startup; use Hosting for service/pipeline configuration, Middleware for request/error handling, Security for admin credential verification, Validation for request rules, and StoreDatabase for SQL.
- The user runs the backend from Visual Studio and the frontend from VS Code, and uses Microsoft Edge.
- The full VS Code workspace is Thesamenot.code-workspace. Its launch/tasks mirror the frontend-only .vscode configurations; update both when changing frontend startup behavior.

## Local setup

- Frontend: http://localhost:3000. Backend: http://127.0.0.1:5080.
- Backend F5 uses Kestrel and launchBrowser=false. Do not reintroduce the unwanted automatic health-check browser popup.
- Frontend F5 starts Node directly with internalConsole and opens the default browser via openExternally. Edge is the current Windows HTTP default. Browser-debugger attachment previously failed; PowerShell terminal startup previously blocked on PSReadLine trust prompts. The workspace uses Command Prompt.
- The current backend uses the separate local test database thesamenot_test at 127.0.0.1:13307. Its datadir is .local/mariadb-preview; scripts/start-preview-database.ps1 starts it.
- The user's existing MariaDB 10.11.14 at 127.0.0.1:3306 is a different server. We have not created the e-shop database there. A future switch requires the appropriate local credentials and StoreSetup workflow. Do not overwrite any existing database.
- Read appsettings.Local.json only as needed, and do not print connection passwords or admin hashes. Local secrets and .local files must remain excluded from Git and clean archives.
- When a port is occupied, identify its owner before acting. Do not stop the user's Visual Studio or VS Code debug sessions just to run checks.

## Verification and release

Run checks appropriate to the change. Preserve unrelated user changes, including generated Next.js files from their dev sessions. There is no need to repeat the full E2E suite for every IDE setting change.

The app is a local development implementation. Stripe live credentials, final merchant policies, email delivery, hosting and production operations remain unfinished. Do not describe it as ready for real sales.

The private GitHub remote is https://github.com/GiorgosParaskevaidis/clothing-eshop. The implementation was pushed to main on 08/10/2026 after merging the initial remote history without force. main tracks origin/main. Two GitHub accounts are stored; use the command-scoped credential.username=GiorgosParaskevaidis override for this repository. Do not force-push or silently switch global identities.
## Remote preview
The authorized remote demo uses deploy/preview/Dockerfile on Render Free and a separate Filess.io database. Preview permits simulation only, requires HTTPS and admin credentials, and rejects Stripe keys. Production still rejects simulation. Read deploy/preview/README.md. Remote credentials stay in ignored .local/render-preview* files. SQL TLS uses an explicitly approved SHA-256 server certificate pin; never silently accept a changed certificate or disable verification. Do not run destructive integration fixtures on the online database. No credit card or paid upgrade is authorized.
