# Δωρεάν online preview — Render + Filess.io

## Τρέχουσα έκδοση — 29/10/2026

Κώδικας **c888f8a**, deployment **dep-dbhks3ifngtc73bu9h0g**, επιβεβαιωμένο **Live** στο Render, διάρκεια **53,0s**. Παραμένει Free/Frankfurt, χωρίς κάρτα, πληρωμένο storage ή add-on. Κατάστημα: https://thesamenot-preview.onrender.com · checkout: https://thesamenot-preview.onrender.com/checkout · admin: https://thesamenot-preview.onrender.com/admin.

- Next **16.4.3**, Ελληνικά/English και οι νέες σελίδες καταλόγου/admin. Δημόσιο checkout μόνο με Revolut κατάθεση / αντικαταβολή. Η κατάθεση εμφανίζεται αλλά είναι **ανενεργή**, χωρίς δικαιούχο/IBAN. Οι παραγγελίες είναι αποκλειστικά δοκιμαστικές και δεν αποστέλλονται.
- Το `Store:PaymentMode=Simulation` παραμένει ως υποχρεωτικό Preview configuration/ιστορική συμβατότητα. Δεν επαναφέρει παλιό simulated/card δημόσιο checkout και δεν επιτρέπει να σημειωθεί νέα COD παραγγελία πληρωμένη από το simulation endpoint.
- Η χωριστή Filess βάση έχει πλέον **36 πίνακες / 13 applied migrations**. Πριν το online DDL έγινε κρυπτογραφημένο backup, απομονωμένη τοπική SQL επαναφορά με ίδια collation και σύγκριση fingerprints. Οι migrations δοκιμάστηκαν στο αντίγραφο και εφαρμόστηκαν μετά από προσωρινή παύση της υπηρεσίας και επανέλεγχο της αμετάβλητης πηγής. Διατηρήθηκαν τα δύο παλιά demo orders.
- Ιδιωτικό recovery set: `.local/backups/preview-20261029-131915-9b1c9971`, με `database.sql.protected`, `verification.json`, `migration-result.json`. Η προστασία DPAPI απαιτεί τον κατάλληλο Windows λογαριασμό/μηχάνημα· δεν αποτελεί ανεξάρτητο offsite recovery.
- Το Filess άλλαξε self-signed πιστοποιητικό. Ο χρήστης ενέκρινε ρητά το νέο SHA-256 στις 29/10. Ενημερώθηκαν το pin και το `Database__Initialize=false`, διατηρώντας SQL/admin credentials. Η ακριβής τιμή και τα backups configuration είναι στα ignored preview αρχεία. Δεν απενεργοποιήθηκε η TLS επαλήθευση.
- Το `start.mjs` προσθέτει **μόνο** `Proxy__KnownAddresses__0=127.0.0.1`: ο loopback-only backend αναγνωρίζει HTTPS από τον εσωτερικό Next proxy, ώστε το CSRF endpoint να παράγει Secure/HttpOnly cookie. HTTP και ξένο Origin εξακολουθούν να απορρίπτονται.

### Όρια δωρεάν demo

**Auth:Enabled=false**, **Email:Mode=None**, **Media:Mode=Disabled**. Διατηρήθηκε ο παλιός ξεχωριστός admin (`.local/render-preview-access.txt`), χωρίς bootstrap ή μεταφορά προσωπικών credentials/MFA/SMTP. Λειτουργούν guest checkout και legacy demo admin. Δεν ενεργοποιήθηκαν customer accounts, MFA-dependent ενέργειες αλλαγής τραπεζικών στοιχείων/καταγραφής χρημάτων ή uploads. Οι εργασίες email δημιουργούνται αλλά **δεν αποστέλλονται σε inbox**. Δεν χρησιμοποιούμε πραγματικά προσωπικά δεδομένα.

Το default Data Protection key ring του Free container είναι προσωρινό. Restart/redeploy μπορεί να ακυρώσει demo sessions/guest cookies ή να κάνει παλιές κρυπτογραφημένες εργασίες μη αναγνώσιμες. Αυτό δεν είναι υποδομή για πραγματικούς λογαριασμούς/MFA/email. Τα production safeguards δεν άλλαξαν. Η βάση παραμένει στον χωριστό πάροχο με τα δωρεάν όριά του.

### Επαληθεύσεις

Το Docker build πέρασε: .NET publish, Next production build/TypeScript και `npm ci` με 0 vulnerabilities. Το πρώτο deploy απέτυχε στο παλιό pin. Μετά την επαληθευμένη αποθήκευση ανέβηκε το e19483c· ο οπτικός έλεγχος εντόπισε το HTTPS/CSRF ζήτημα και η διορθωμένη έκδοση c888f8a ανέβηκε επιτυχώς.

Πέρασαν **19 online API/SSR checks** πριν τη μοναδική προσθήκη proxy configuration: health, προϊόντα/εικόνα, EL/EN SSR, δύο μέθοδοι/ανενεργή κατάθεση, προστασία admin, παλιό login/ασφαλές cookie, admin λίστες/ανάγνωση πληρωμών, guest context, μία test COD παραγγελία, unpaid receipt, retry χωρίς δεύτερη παραγγελία και απόρριψη card/deposit/simulation-paid. Δημιουργήθηκε η **TSN-BD3754243C934521**, «PREVIEW TEST - NO DISPATCH», ένα Ghost Hoodie S. Δεν είναι πώληση και καταναλώνει ένα demo τεμάχιο. Read-only SQL επιβεβαίωσε δύο buyer/admin creation email jobs.

Πέρασαν **5 απομονωμένα local Preview checks** για τη διόρθωση: startup, HTTPS CSRF, Secure/HttpOnly cookie, HTTP rejection και foreign-Origin rejection. Μετά το τελικό deployment επαληθεύτηκαν online CSRF **200** με Secure cookie και foreign Origin **403**. Στον Edge ελέγχθηκαν πραγματικό καλάθι, EL/EN, ετικέτες πληρωμών, quote και σύνολο €46 (€42 + €4), χωρίς νέο browser submit. Δεν εκτελέστηκε destructive fixture στην online βάση. Reports: `.local/preview-online-smoke-report.json`, `.local/preview-proxy-test/result.json`. Αναλυτικά στο `ΕΛΕΓΧΟΙ.md`.

## Ιστορική εγκατάσταση — 09/10 και σημειώσεις 19/10

Οι παρακάτω ενότητες διατηρούν το ιστορικό. Για το τρέχον schema, πληρωμές και όρια ισχύει η παραπάνω ενημέρωση 29/10.

Ένα Docker Web Service στο Render Free τρέχει Next.js στη δημόσια θύρα PORT και ASP.NET Core μόνο στο loopback:8080. Τα δεδομένα αποθηκεύονται στη χωριστή preview MariaDB του Filess.io. Η εφαρμογή μπορεί να ανοίγει από άλλον υπολογιστή χωρίς να λειτουργεί ο τοπικός υπολογιστής.

Το περιβάλλον είναι **Preview**, με δοκιμαστικές πληρωμές, χωρίς Stripe keys/webhook και Secure admin cookie. Δεν προορίζεται για πραγματικές πωλήσεις ή πραγματικά στοιχεία πελατών.

Οι φάσεις 0/1 του νέου database authentication δοκιμάστηκαν τοπικά στις 13/10/2026. Δεν έγινε νέο deploy ή online migration. Το δωρεάν demo διατηρεί Auth:Enabled=false και το ξεχωριστό config-only admin. Μελλοντική ενεργοποίηση database accounts απαιτεί migrations/bootstrap, SMTP και μόνιμο προστατευμένο key ring· το προσωρινό Render filesystem δεν επαρκεί για MFA secrets. Δεν εγκρίθηκε paid storage ή άλλη χρέωση.

## Ρυθμίσεις Render

- Manual New → Web Service, GitHub → GiorgosParaskevaidis/clothing-eshop, branch main.
- Name: thesamenot-preview. Language: Docker. Region: Frankfurt.
- Instance type: **Free, $0/month**. Δεν καταχωρίζουμε κάρτα και δεν ενεργοποιούμε paid add-ons.
- Root Directory: κενό. Docker build context: repository root.
- Dockerfile: deploy/preview/Dockerfile. Health check: /api/health. Auto-Deploy: Off όσο γίνεται η αρχική δοκιμή.
- Εισαγωγή των ιδιωτικών environment settings από .local/render-preview.env. Το render.env.example περιέχει μόνο μη απόρρητο υπόδειγμα.
- Το RENDER_EXTERNAL_URL δίνεται αυτόματα από το Render. Το Docker build το χρησιμοποιεί για NEXT_PUBLIC_SITE_URL και ο supervisor για Store:PublicUrl.

Το API_INTERNAL_URL ενσωματώνεται στο Next.js build ως http://127.0.0.1:8080. Ο supervisor ξεκινά πρώτα το API, περιμένει health και μετά το frontend. Αν σταματήσει ένα παιδί, τερματίζει και το άλλο. Δεν περνά SQL/admin/Stripe secrets στο frontend process. Τα local settings, .env, .local, bin/obj και node_modules εξαιρούνται από το build context.

## Βάση και TLS

Η νέα βάση δημιουργείται μόνο στο Filess.io Shared Free. Η αρχική φόρμα ανέφερε 10.7.4, αλλά το πραγματικό SELECT VERSION() επέστρεψε 11.6.2-MariaDB-ubu2404 στις 09/10/2026. Η υπάρχουσα MariaDB 3306 και η τοπική thesamenot_test:13307 παραμένουν ανεξάρτητες.

Ο server παρέχει self-signed certificate, με διαφορετικό Common Name από το hostname. Επειδή δεν εντοπίστηκε έμπιστο CA certificate στο panel, χρησιμοποιείται **ρητά εγκεκριμένο SHA-256 certificate pin**, μαζί με SslMode=Required. Το StoreConnectionFactory απαιτεί το ίδιο αποτύπωμα και έγκυρες ημερομηνίες σε κάθε TLS handshake. Δεν υπάρχει callback που δέχεται οποιοδήποτε πιστοποιητικό. Η αρχική εμπιστοσύνη του pin βασίζεται στο πιστοποιητικό που παρατηρήθηκε από το συγκεκριμένο provider endpoint· δεν είναι ανεξάρτητη επιβεβαίωση από CA. Αν αλλάξει το πιστοποιητικό, η σύνδεση αποτυγχάνει μέχρι να ελεγχθεί και να εγκριθεί το νέο pin.

Η δημόσια ανάγνωση πιστοποιητικού δεν στέλνει SQL credentials:

```powershell
node deploy/preview/inspect-certificate.mjs HOST PORT .local/filess-certificate.json
```

Τα στοιχεία της νέας βάσης αποθηκεύονται τοπικά στο ignored .local/filess-preview-credentials.json (host, port, database, user, password). Το εργαλείο εξάγει μόνο configuration, χωρίς αλλαγές στη βάση:

```powershell
dotnet run --project tools/StoreSetup -- --root D:/Projects/clothing-eshop --preview-env
```

Δημιουργεί ξεχωριστό admin και τα .local/render-preview-settings.json, render-preview.env, render-preview-access.txt. Σε επανάληψη διατηρεί τον υπάρχοντα admin και το Database__Initialize. Δεν εμφανίζει passwords ή hashes στην έξοδο.

Το schema εφαρμόζεται μόνο στη νέα preview βάση. Μετά την αρχική επιβεβαίωση, Database__Initialize=false. Το pool περιορίζεται σε τρεις συνδέσεις. Μην τρέχεις τα υπάρχοντα API integration tests στην online βάση: καθαρίζουν πίνακες και προορίζονται για νέα απομονωμένη test database.

## Όρια και πρόσβαση

- Το δημόσιο URL ανοίγει το κατάστημα. Η διαχείριση είναι στο /admin και χρησιμοποιεί τα ξεχωριστά στοιχεία από .local/render-preview-access.txt.
- Το Render Free μπορεί να κοιμάται μετά από αδράνεια και η πρώτη επίσκεψη να αργεί. Η MariaDB Free έχει μικρό όριο αποθήκευσης· χρησιμοποιούμε μόνο demo δεδομένα.
- Το container filesystem είναι προσωρινό. Δεν αποθηκεύουμε uploads ή τη βάση εκεί. Τα Data Protection keys δεν είναι μόνιμα: admin sessions μπορεί να χρειάζονται νέο login μετά από restart/deploy.
- Απουσία κάρτας δεν ενεργοποιούμε χρεώσεις ή αναβάθμιση όταν εξαντληθούν τα δωρεάν όρια.
- Το Docker build και το deploy ολοκληρώθηκαν στο Render στις 09/10/2026, σε 1m28s. Επιβεβαιώθηκαν δημόσια home/admin/API, assets, sitemap domain, admin login/logout και simulation checkout από Edge. Δεν έχει γίνει load test ή μέτρηση συμπεριφοράς στα όρια μνήμης/δωρεάν quota.

Πηγές: [Render Free](https://render.com/docs/free), [Docker στο Render](https://render.com/docs/docker), [MySqlConnector TLS options](https://mysqlconnector.net/connection-options/).
## Επιβεβαιωμένο deployment

Σημείωση 19/10: το παρακάτω περιγράφει το παλιό πραγματικά δημοσιευμένο demo, όχι τη νέα τοπική έκδοση φάσεων 2–5. Δεν έγινε νέο push/deploy ή αλλαγή online δεδομένων. Auto-Deploy παραμένει Off.

Ο νέος κώδικας απαιτεί όλες τις migrations 001–012 μέσω χωριστού maintenance εργαλείου πριν runtime εκκίνηση. Database__Initialize=true δεν υποστηρίζεται πλέον. Πριν μελλοντικό manual deploy: online backup/restore rehearsal, έλεγχος DDL πρόσβασης, schema/key/mail σχέδιο και ξεχωριστή έγκριση διάθεσης. Μην χρησιμοποιήσεις το local destructive harness στη Filess βάση.

Το Dockerfile περιλαμβάνει Sharp αλλά Media__Mode=Disabled: χωρίς μόνιμο object storage δεν επιτρέπονται uploads. Νέα database accounts/MFA και κρυπτογραφημένο outbox απαιτούν μόνιμα προστατευμένα keys/SMTP. Το παλιό Auth=false preview παραμένει μόνο demo· νέα production λειτουργία δεν ενεργοποιείται από αυτό το Dockerfile. Το νέο Docker build δεν έχει εκτελεστεί τοπικά/στο Render.

- Κατάστημα: https://thesamenot-preview.onrender.com
- Διαχείριση: https://thesamenot-preview.onrender.com/admin
- Render service: srv-db40sbad0e5s73fcvo5g, Free, Frankfurt.
- Deployment: dep-db40sc2d0e5s73fcvpr0, κώδικας 7bc612d. Auto-Deploy Off· μελλοντικά code changes χρειάζονται Manual Deploy.
- Το dashboard ονόμασε την ομάδα υπηρεσιών Production, αλλά το ASP.NET περιβάλλον επιβεβαιώθηκε από τα logs ως Preview.
- Online admin email: admin@thesamenot.preview. Κωδικός στο τοπικό ignored .local/render-preview-access.txt, διαφορετικός από τον τοπικό admin.
- Στην online βάση υπάρχει η δοκιμαστική παραγγελία 8AB5F455 με fake στοιχεία, paid/Simulation, €46 και ένα Ghost Hoodie L. Δεν έγινε πραγματική χρέωση. Το διαθέσιμο L είναι 14 μετά από αυτή τη δοκιμή.
- Δεν καταχωρίστηκε κάρτα ούτε ενεργοποιήθηκε επί πληρωμή υπηρεσία/add-on.
