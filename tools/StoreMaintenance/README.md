# Migrations και πρώτος διαχειριστής

Οι εντολές migrate/bootstrap εφαρμόζονται στην **ήδη επιλεγμένη** βάση. Δεν δημιουργούν βάση/SQL χρήστη, δεν κάνουν DROP, δεν εισάγουν προϊόντα και δεν αλλάζουν αυτόματα το appsettings.Local.json. Το ξεχωριστό StoreSetup παραμένει για καινούριο demo setup. Οι νέες ρητές backup-verify-local/migrate-local-verified δημιουργούν και αφαιρούν μόνο το δικό τους τυχαίο restore_*_test αντίγραφο, όπως περιγράφεται παρακάτω.

Από το D:/Projects/clothing-eshop:

~~~powershell
dotnet run --project tools/StoreMaintenance -c Release -- migrate --settings backend/Thesamenot.Api/appsettings.Local.json --root D:/Projects/clothing-eshop
dotnet run --project tools/StoreMaintenance -c Release -- bootstrap-admin --settings backend/Thesamenot.Api/appsettings.Local.json --email YOUR_EMAIL
~~~

Το password ζητείται κρυφά στο terminal. Χρησιμοποίησε **νέο** ισχυρό password 8–128 Unicode χαρακτήρων, με κεφαλαίο, μικρό, αριθμό και σημείο στίξης ή σύμβολο (π.χ. ! ή ?). Το κενό δεν μετρά ως σύμβολο και συνηθισμένοι/αποκλεισμένοι κωδικοί απορρίπτονται. Δεν αποθηκεύεται σε settings ή αρχείο πρόσβασης. Σε αυτοματοποιημένο περιβάλλον δίνεται από private secret environment ως STORE_ADMIN_PASSWORD, ποτέ ως command argument ή μέσα στο Git. Το email του πρώτου admin θεωρείται επιβεβαιωμένο από τον χειριστή του εργαλείου. Δεύτερο bootstrap απορρίπτεται· δημόσιο endpoint δημιουργίας admin δεν υπάρχει.

Πριν εφαρμογή σε βάση με πραγματικά δεδομένα: backup και δοκιμασμένη επαναφορά, χειριστής με DDL permissions και παύση των εγγραφών κατά το schema change. Το runtime SQL account χρειάζεται μόνο τα αναγκαία DML permissions στους πίνακες της εφαρμογής. Δεν χρειάζεται CREATE/ALTER/DROP.

Το 001 ελέγχει τους έξι εμπορικούς πίνακες (στήλες, τύπους/μήκη/nullability, unique keys/FKs και InnoDB) πριν υιοθετήσει την αφετηρία. Το 002 προσθέτει identity. Τα applied migrations είναι αμετάβλητα. Επανάληψη δεν εκτελεί ξανά SQL. Χρησιμοποιείται MariaDB GET_LOCK και ledger με SHA-256. Επειδή το MariaDB DDL κάνει implicit commits, αποτυχία αφήνει failed/applying κατάσταση που απαιτεί χειροκίνητη διερεύνηση και forward repair ή επαναφορά· δεν γίνεται υποτιθέμενο αυτόματο rollback ούτε παράκαμψη checksum.

Αν υπάρχουν ήδη identity πίνακες χωρίς καταγεγραμμένο applied migration, το 002 αρνείται την υιοθέτηση. Δεν γίνεται overwrite ή προσθήκη admin roles σε άγνωστους υπάρχοντες users. Απαιτείται διερεύνηση από τον χειριστή.

Μετά migrations/bootstrap πρόσθεσε στο ignored appsettings.Local.json:

~~~json
{
  "Auth": {
    "Enabled": true,
    "KeyRingPath": "D:/Projects/clothing-eshop/.local/auth-keys"
  },
  "Email": {
    "Mode": "DevelopmentFile",
    "Directory": "D:/Projects/clothing-eshop/.local/auth-mail"
  }
}
~~~

Συγχώνευσε αυτές τις ενότητες με το υπάρχον αρχείο· **μην αντικαταστήσεις** τα ConnectionStrings/Store/Stripe. Κράτησε Database:Initialize=false. Το Store:PublicUrl πρέπει να ταιριάζει ακριβώς στο frontend origin, εδώ http://localhost:3000. Επανεκκίνησε το δικό σου backend F5 από Visual Studio. Στο /admin συνδέσου με τον νέο λογαριασμό, πρόσθεσε το setup key σε authenticator και φύλαξε τα δέκα recovery codes. Ένας κωδικός TOTP χρησιμοποιείται μία φορά· για άλλη ευαίσθητη ενέργεια περίμενε νέο κωδικό ή χρησιμοποίησε διαθέσιμο recovery code.

Με Auth:Enabled=true ο παλιός Admin:PasswordHash και τα demo cookies δεν δίνουν πρόσβαση. Το configuration-only login επιτρέπεται μόνο σε Development/Preview με Auth:Enabled=false. Το Production αρνείται αυτή τη λειτουργία.

Με Email:Mode=DevelopmentFile τα email είναι JSON αρχεία μόνο στον δηλωμένο ignored φάκελο, χωρίς αποστολή σε inbox. Η υπάρχουσα προσωπική εγκατάσταση χρησιμοποιεί Brevo SMTP. Άνοιξε ιδιωτικά τα links· μην ανεβάσεις αρχεία ή tokens στο Git. Verification στον browser εγγραφής συνδέει αυτόματα τον Customer, άλλος browser οδηγεί σε sign-in. Οι χρήστες, διευθύνσεις και παραγγελίες αποθηκεύονται στη MariaDB· βλ. ΦΑΣΕΙΣ-2-5.md.

Για SMTP: Email:Mode=Smtp, Host, Port (587 STARTTLS ή 465 TLS), FromAddress, Username/Password σε secret settings. Δεν απενεργοποιείται η επαλήθευση TLS. Η αποστολή γίνεται από κρυπτογραφημένο SQL transactional outbox με leases, retries/backoff και dead-letter/replay στο /admin/jobs. Το HTTP response δεν περιμένει SMTP. Διατήρησε το key ring: παλιά pending payloads χρειάζονται τα ίδια κλειδιά.

Production απαιτεί επιπλέον HTTPS PublicUrl, μόνιμο KeyRingPath, Auth:KeyEncryptionCertificatePath / KeyEncryptionCertificatePassword (PFX με private key) και Auth:CompromisedPasswordHashesPath. Το τελευταίο είναι ιδιωτικό UTF-8 αρχείο, ένα SHA-256 hash UTF-8 password ανά γραμμή, 64 hex χαρακτήρες. Η μικρή ενσωματωμένη λίστα common passwords δεν αντικαθιστά πλήρες, ενημερωμένο dataset. Στα Windows Development τα κλειδιά προστατεύονται με DPAPI του τρέχοντος χρήστη. Απώλεια του key ring σημαίνει απώλεια MFA secrets και cookies· περιλαμβάνεται στο σχέδιο backup, με προστασία των κλειδιών.

Το Render Free demo δεν μεταφέρεται αυτόματα στο νέο auth: χρειάζονται πραγματικός email sender και μόνιμα προστατευμένα κλειδιά. Δεν χρησιμοποιούμε το προσωρινό container filesystem για MFA λογαριασμούς και δεν υπάρχει έγκριση χρέωσης.

## Φάσεις 2–5 και τοπική αναβάθμιση

Ο runtime πλέον ελέγχει όλες τις migrations 001–013 πριν εκκίνηση και δεν κάνει DDL, ακόμη και με Auth:Enabled=false. Η 013 προσθέτει μόνο τον πίνακα `payment_settings`, με κενά τραπεζικά στοιχεία και ανενεργή κατάθεση. Η διαχείριση γίνεται μετά από `/admin/payments`, χωρίς configuration import. Μην επανεκτελέσεις bootstrap σε υπάρχον admin. Το StoreSetup εφαρμόζει migrations μόνο όταν δημιουργεί καινούρια κενή demo βάση.

Για την αποκλειστική προσωπική thesamenot_test στον 127.0.0.1:13307 υπάρχει Windows/DPAPI workflow:

~~~powershell
dotnet run --project tools/StoreMaintenance -c Release -- backup-verify-local --settings .local/maintenance-settings.json --root D:/Projects/clothing-eshop
dotnet run --project tools/StoreMaintenance -c Release -- migrate-local-verified --settings .local/maintenance-settings.json --root D:/Projects/clothing-eshop
~~~

Το maintenance settings είναι ignored, με χωριστό DDL account και το πραγματικό Auth:KeyRingPath· δεν αντικαθιστά τον DML λογαριασμό της εφαρμογής. Το workflow αρνείται ενεργές 3000/5080 ή άλλες source συνδέσεις. Δεν σταματά διεργασίες.

Κάθε εκτέλεση παίρνει νέο encrypted SQL dump, επαναφέρει μόνο σε τυχαία restore_*_test βάση, συγκρίνει counts/fingerprints όλων των πινάκων, αντιγράφει το key ring και ελέγχει αποκρυπτογράφηση υπαρχόντων MFA secrets. Εκτελεί όλες τις εκκρεμείς migrations στο αντίγραφο και ξανασυγκρίνει την αμετάβλητη πηγή. Μόνο το migrate-local-verified εφαρμόζει κατόπιν source migrations. Backup/report στο .local/backups, προστασία dump στο .local/backup-keys. Δεν εκτυπώνονται μυστικά/fingerprints ή MFA keys.

Η προστασία DPAPI απαιτεί τον ίδιο Windows χρήστη/μηχάνημα. Για production χρειάζεται ανεξάρτητο offsite/host restore με τα συμφωνημένα RPO/RTO· βλ. deploy/production/README.md.

## Contracts χωρίς πρόσβαση σε provider

verify-tax-contract ελέγχει συνθετικά ποσά/στρογγυλοποίηση. verify-payment-contract επιτρέπεται μόνο σε phase1_*_test στον 13307, με πραγματικό Stripe SDK και ελεγχόμενο HTTP transport χωρίς δίκτυο. Το scripts/test-phase1.mjs σταματά πρώτα μόνο τον δικό του API worker και τα καλεί. Δεν εκτελούνται στην προσωπική ή online βάση.

Το `scripts/test-phase1.mjs --focus-manual --browser` περιλαμβάνει επίσης ρυθμίσεις πληρωμών/admin και νέο έλεγχο διατήρησης των αποθηκευμένων τραπεζικών στοιχείων/απενεργοποίησης μετά από restart. Αν έχει προηγηθεί επιτυχές build με `API_INTERNAL_URL=http://127.0.0.1:5082`, μπορεί να χρησιμοποιηθεί επιπλέον `--reuse-frontend-build`. Ο runner ελέγχει `BUILD_ID` και το ακριβές API rewrite στο routes manifest πριν ξεκινήσει browser tests, ώστε να αποκλείεται χρήση build που δείχνει στην προσωπική 5080. Η κανονική εκτέλεση εξακολουθεί να κάνει νέο build.

Για στοχευμένο επανέλεγχο των browser tests που απέτυχαν στην προηγούμενη εκτέλεση, το προαιρετικό `--browser-last-failed` περνά το αντίστοιχο flag στον Playwright. Η δημιουργία τυχαίας βάσης, οι απαιτούμενοι API έλεγχοι και το cleanup παραμένουν ίδια.
