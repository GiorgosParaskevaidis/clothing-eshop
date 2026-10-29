# thesamenot — Drop 01

## Σχεδιασμός μετάβασης σε WordPress — 29/10/2026

Η υπάρχουσα Next/.NET υλοποίηση αποθηκεύτηκε και ανέβηκε στο ιδιωτικό GitHub, commit `22deba5`, ετικέτα `pre-wordpress-2026-10-29`. Το [ΠΛΑΝΟ-WORDPRESS.md](ΠΛΑΝΟ-WORDPRESS.md) περιγράφει την προτεινόμενη μετάβαση σε WordPress + WooCommerce στο υπάρχον Bluehost Basic, με στάδια, κόστος, διατήρηση δεδομένων και κριτήρια αποδοχής. Προς το παρόν υπάρχει μόνο πλάνο· η παρακάτω εφαρμογή και η τοπική εκκίνησή της παραμένουν όπως είναι. Μυστικά και λειτουργική βάση δεν αποθηκεύονται στο Git.

Λειτουργική εφαρμογή e-shop βασισμένη στο `thesamenot-site-export.zip`.

- **Frontend και διαχείριση:** Next.js 16.4.3 (ενημέρωση ασφαλείας), React 19.3, TypeScript.
- **Backend:** ASP.NET Core / .NET 10.
- **Δεδομένα:** MariaDB 10.11, MySqlConnector και Dapper.
- **Πληρωμές:** μόνο τραπεζική κατάθεση σε Revolut και αντικαταβολή, με χειροκίνητη επιβεβαίωση είσπραξης. Ο admin ορίζει δικαιούχο/IBAN/BIC και ενεργοποιεί ή απενεργοποιεί την κατάθεση από τις **Ρυθμίσεις πληρωμών** (`/admin/payments`), χωρίς αλλαγή αρχείων ή restart· δες [ΠΛΗΡΩΜΕΣ.md](ΠΛΗΡΩΜΕΣ.md).
- **Γλώσσες:** Ελληνικά / English σε όλο το δημόσιο κατάστημα, με ελληνικά ως προεπιλογή και αποθήκευση επιλογής. Αρχεία, λειτουργία και όρια: [ΓΛΩΣΣΕΣ.md](ΓΛΩΣΣΕΣ.md).
- **Email παραγγελίας:** επιβεβαίωση στον αγοραστή και ειδοποίηση στο τρέχον επαληθευμένο email του admin, για κατάθεση και αντικαταβολή. Αποθηκεύονται μαζί με την παραγγελία στη μόνιμη ουρά· η αποστολή απαιτεί ενεργό email worker και SMTP. Δες [οδηγίες email](deploy/email/README.md).

Διάβασε πρώτα τις [ΟΔΗΓΙΕΣ.md](ΟΔΗΓΙΕΣ.md). Άνοιξε το `Thesamenot.sln` στο Visual Studio και το `Thesamenot.code-workspace` στο VS Code για προβολή όλων των αρχείων. Δες και τον [ΧΑΡΤΗΣ-ΑΡΧΕΙΩΝ.md](ΧΑΡΤΗΣ-ΑΡΧΕΙΩΝ.md).

Οι κωδικοί και το `appsettings.Local.json` εξαιρούνται από Git και από το παραδοτέο ZIP. Το [δημόσιο preview](https://thesamenot-preview.onrender.com) ενημερώθηκε στις **29/10/2026** με Next 16.4.3, Ελληνικά/English και τις νέες χειροκίνητες πληρωμές. Η κατάθεση παραμένει ανενεργή χωρίς στοιχεία Revolut. Το demo επιτρέπει guest δοκιμές και τον παλιό ξεχωριστό admin, με accounts/SMTP/uploads απενεργοποιημένα· δες [τρέχουσα έκδοση και όρια](deploy/preview/README.md). Πραγματικές πωλήσεις απαιτούν ολοκλήρωση των εκκρεμοτήτων ανοίγματος του καταστήματος.

Για τη μετάβαση σε κανονικό εμπορικό κατάστημα, δες το [ΠΛΑΝΟ-PRODUCTION.md](ΠΛΑΝΟ-PRODUCTION.md). Οι φάσεις 0/1 τεκμηριώνονται στο [ΦΑΣΕΙΣ-0-1.md](ΦΑΣΕΙΣ-0-1.md). Η συνέχεια προσθέτει πελάτες/διευθύνσεις/ιστορικό, guest access, κατάλογο πολλών σελίδων, πλήρες admin προϊόντων/εικόνων/μεταφορικών/παραγγελιών, επιστροφές/refunds και durable εργασίες. Τα contracts και όλα τα αρχεία βρίσκονται στο [ΦΑΣΕΙΣ-2-5.md](ΦΑΣΕΙΣ-2-5.md), τα πραγματικά αποτελέσματα στο [ΕΛΕΓΧΟΙ.md](ΕΛΕΓΧΟΙ.md).

Τα admin credentials παραμένουν στο ιδιωτικό .local/auth-admin-access.txt, με MFA. Το [Brevo Free SMTP](deploy/email/README.md) έχει επιβεβαιωμένη τοπική παραλαβή από 14/10. Οι νέες δοκιμές στέλνουν μόνο σε απομονωμένα αρχεία, όχι σε πραγματικά inbox. Επιχειρηματικά/νομικά στοιχεία, νέος Revolut λογαριασμός, πραγματικός έλεγχος τραπεζικής κατάθεσης/αντικαταβολής, domain και production υποδομή εκκρεμούν στο [TODO-PRODUCTION.md](TODO-PRODUCTION.md). Το [production runbook](deploy/production/README.md) δεν ενεργοποιεί υπηρεσίες ή χρεώσεις.

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

Το setup ζητά τοπικά τα στοιχεία της MariaDB στην `127.0.0.1:3306`, δημιουργεί **καινούρια** βάση `thesamenot`, ειδικό χρήστη περιορισμένο σε αυτή τη βάση και hashed κωδικό διαχειριστή. Δεν μεταβάλλει υπάρχουσες βάσεις. Το νέο checkout χρησιμοποιεί χειροκίνητες πληρωμές· η κατάθεση περιμένει τα στοιχεία Revolut.


Η τρέχουσα τοπική εγκατάσταση βρίσκεται στο `D:\Projects\clothing-eshop`. Για την υπάρχουσα ιδιωτική προεπισκόπηση, ξεκίνησε τη βάση με `./scripts/start-preview-database.ps1` πριν από frontend/backend. Δες την ενότητα 11 στις οδηγίες.


## Online preview — 09/10/2026

Προετοιμάστηκε δωρεάν Render Docker service με frontend και loopback-only backend, ξεχωριστό Preview environment και εξωτερική Filess.io MariaDB. Το πραγματικό database version είναι 11.6.2. Οι τοπικές βάσεις και IDE ρυθμίσεις παραμένουν ανεξάρτητες. Δες [deploy/preview/README.md](deploy/preview/README.md) για ρυθμίσεις, TLS certificate pin, ιδιωτικά admin στοιχεία και όρια. Το Docker build και το deployment ολοκληρώθηκαν επιτυχώς στις 09/10/2026. Δημόσιο κατάστημα: [thesamenot-preview.onrender.com](https://thesamenot-preview.onrender.com), διαχείριση: [/admin](https://thesamenot-preview.onrender.com/admin). Το προσωπικό PC δεν χρειάζεται να λειτουργεί. Το Free service μπορεί να καθυστερεί στην πρώτη επίσκεψη μετά από αδράνεια. Οι πληρωμές του preview είναι αποκλειστικά simulation.
