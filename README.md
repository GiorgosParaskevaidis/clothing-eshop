# thesamenot — Drop 01

Λειτουργική εφαρμογή e-shop βασισμένη στο `thesamenot-site-export.zip`.

- **Frontend και διαχείριση:** Next.js 16.4, React 19.3, TypeScript.
- **Backend:** ASP.NET Core / .NET 10.
- **Δεδομένα:** MariaDB 10.11, MySqlConnector και Dapper.
- **Πληρωμές:** Stripe Checkout με υπογεγραμμένα webhooks και ξεχωριστό τοπικό simulation.

Διάβασε πρώτα τις [ΟΔΗΓΙΕΣ.md](ΟΔΗΓΙΕΣ.md). Άνοιξε το `Thesamenot.sln` στο Visual Studio και το `Thesamenot.code-workspace` στο VS Code για προβολή όλων των αρχείων. Δες και τον [ΧΑΡΤΗΣ-ΑΡΧΕΙΩΝ.md](ΧΑΡΤΗΣ-ΑΡΧΕΙΩΝ.md).

Οι κωδικοί και το `appsettings.Local.json` εξαιρούνται από Git και από το παραδοτέο ZIP. Υπάρχει δημόσιο δοκιμαστικό preview, χωρίς χρέωση χρημάτων. Πραγματικές πωλήσεις απαιτούν ρύθμιση του επαγγελματικού Stripe και ολοκλήρωση των απαιτήσεων ανοίγματος του καταστήματος.

## Γρήγορη εκκίνηση σε Windows

Προαπαιτούμενα: .NET 10 SDK, Node.js 22 LTS, MariaDB 10.11.

Από τον φάκελο του project:

```powershell
./scripts/setup.ps1
```

Σε δύο ξεχωριστά terminal:

```powershell
./scripts/start-backend.ps1
```

```powershell
./scripts/start-frontend.ps1
```

Κατάστημα: `http://localhost:3000` · Διαχείριση: `http://localhost:3000/admin` · Έλεγχος API: `http://127.0.0.1:5080/api/health`.

Το setup ζητά τοπικά τα στοιχεία της MariaDB στην `127.0.0.1:3306`, δημιουργεί **καινούρια** βάση `thesamenot`, ειδικό χρήστη περιορισμένο σε αυτή τη βάση και hashed κωδικό διαχειριστή. Δεν μεταβάλλει υπάρχουσες βάσεις. Αρχικά χρησιμοποιεί Development-only δοκιμαστικές πληρωμές.


Η τρέχουσα τοπική εγκατάσταση βρίσκεται στο `D:\Projects\clothing-eshop`. Για την υπάρχουσα ιδιωτική προεπισκόπηση, ξεκίνησε τη βάση με `./scripts/start-preview-database.ps1` πριν από frontend/backend. Δες την ενότητα 11 στις οδηγίες.


## Online preview — 09/10/2026

Προετοιμάστηκε δωρεάν Render Docker service με frontend και loopback-only backend, ξεχωριστό Preview environment και εξωτερική Filess.io MariaDB. Το πραγματικό database version είναι 11.6.2. Οι τοπικές βάσεις και IDE ρυθμίσεις παραμένουν ανεξάρτητες. Δες [deploy/preview/README.md](deploy/preview/README.md) για ρυθμίσεις, TLS certificate pin, ιδιωτικά admin στοιχεία και όρια. Το Docker build και το deployment ολοκληρώθηκαν επιτυχώς στις 09/10/2026. Δημόσιο κατάστημα: [thesamenot-preview.onrender.com](https://thesamenot-preview.onrender.com), διαχείριση: [/admin](https://thesamenot-preview.onrender.com/admin). Το προσωπικό PC δεν χρειάζεται να λειτουργεί. Το Free service μπορεί να καθυστερεί στην πρώτη επίσκεψη μετά από αδράνεια. Οι πληρωμές του preview είναι αποκλειστικά simulation.
