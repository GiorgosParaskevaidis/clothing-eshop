# Production TODO — thesamenot

Τελευταία ενημέρωση: 27/10/2026. Συνολικό πλάνο: ΠΛΑΝΟ-PRODUCTION.md. Έλεγχοι: ΕΛΕΓΧΟΙ.md. Ισχύουσα αλλαγή πληρωμών: ΠΛΗΡΩΜΕΣ.md· οι παλιές Stripe εργασίες δεν αποτελούν απαίτηση ανοίγματος.

## Συμφωνημένα

- [x] Υπάρχον project στον D, Next.js/React/TypeScript, .NET 10 Minimal APIs σε modules, MariaDB/Dapper.
- [x] Απόφαση 27/10: μόνο τραπεζική κατάθεση σε Revolut και αντικαταβολή· νέες παραγγελίες χωρίς Stripe Checkout.
- [x] Ρυθμίσεις πληρωμών `/admin/payments`: δικαιούχος/IBAN/BIC, ενεργοποίηση/απενεργοποίηση στη βάση, password/MFA, version/audit και διατήρηση παλιών snapshots. Τοπικά εφαρμόστηκε η 013 μετά από backup/restore/MFA verification: 36 πίνακες/13 migrations. Παραμένει κενή/ανενεργή μέχρι να δοθούν πραγματικά στοιχεία.
- [x] Λογαριασμός πελάτη και αγορά ως επισκέπτης.
- [x] Ελλάδα, EUR, αρχικά μεταφορικά 4€, δωρεάν από 80€· επεξεργασία από admin.
- [x] Φάσεις 0/1 τοπικά: identity, MFA, ασφαλή cookies, migrations, auth ροές.
- [x] Brevo Free τοπικά, επιβεβαιωμένη πραγματική παραλαβή email στις 14/10.
- [x] Password 8–128 Unicode χαρακτήρες με κεφαλαίο/μικρό/αριθμό/σύμβολο.
- [x] Έγκριση 19/10: συνέχεια όλων των υπολοίπων φάσεων και των αναγκαίων δοκιμών.
- [x] Χωρίς κάρτα, αγορά υπηρεσίας ή paid upgrade.

## Κώδικας και επαλήθευση

- [x] W20 / φάση 2: προφίλ/διευθύνσεις με ownership/version, προσωπικό ιστορικό και λεπτομέρειες.
- [x] W20: Customer checkout από έμπιστο session, guest identity και scoped idempotency.
- [x] W20: guest access/claim με token μίας χρήσης, expiry, revocation και ρητή αντιστοίχιση email.
- [x] W20: admin πελατών, ασφαλές disable/revoke και reset-link.
- [x] W30 / φάση 3: draft/publish/archive προϊόντων, slug/SKU/χρώματα/κατηγορίες και versions.
- [x] W30: εικόνες με πραγματικό decode/re-encode/όρια και S3 adapter· πραγματικός provider εκκρεμεί παρακάτω.
- [x] W30: shop/product/category σελίδες, φίλτρα/pagination/sorting, SEO.
- [x] W30: inventory modes limited/replenishable και audited stock movements.
- [x] W41 / φάση 4: shipping στη βάση, admin shipping και server quote/version.
- [x] W42: reservations/payment/fulfillment states, durable webhook inbox, leases/reconciliation.
- [x] W42: refunds/disputes, idempotency και late payment/expiry exception handling.
- [x] W43: tracking/order history, επιστροφές/online υπαναχώρηση και ελεγχόμενο restock.
- [x] W43: transactional outbox, retries/backoff, dead-letter και operator replay.
- [x] W43: newsletter consent/status και ασφαλές unsubscribe.
- [x] W50 / φάση 5, τοπικό μέρος: πλήρης isolated API/browser suite, CI definition και dependency/secret checks· remote CI εκκρεμεί.
- [x] W50: αντιμετώπιση NU1902/NU1903 για την υφιστάμενη System.Security.Cryptography.Pkcs 10.0.0, με επαληθευμένη patched έκδοση και έλεγχο εξαρτήσεων.
- [x] W50 τοπικά: axe σε επιλεγμένες σελίδες, mobile/keyboard, SEO, headers και bounded κατάλογος 150 προϊόντων· manual screen reader/production load εκκρεμούν.
- [x] W50: εργαλεία/runbooks monitoring, backup/restore και επαλήθευση σε απομονωμένη βάση.
- [x] W50: ασφαλής εφαρμογή migrations στην προσωπική local εγκατάσταση, μετά από backup/restore και έλεγχο ενεργών διεργασιών.

Κάθε checkbox ολοκληρώνεται μόνο με υλοποίηση και πραγματική επαλήθευση. Η ύπαρξη endpoint ή αρχείου δεν αρκεί.

## Εξωτερικά στοιχεία / φάση 6 — λείπουν, επιβεβαίωση χρήστη 19/10

- [ ] Στοιχεία επιχείρησης/εμπόρου, επωνυμία, στοιχεία επικοινωνίας/έδρας και φορολογικό προφίλ.
- [ ] Τελικοί όροι αγοράς, αποστολών, επιστροφών/υπαναχώρησης, ιδιωτικότητας και χρόνοι παράδοσης.
- [ ] Courier και λειτουργική διαδικασία αποστολής/επιστροφής.
- [ ] Λογιστής και πάροχος/διαδικασία παραστατικών και myDATA.
- [ ] Άνοιγμα Revolut λογαριασμού και καταχώριση πραγματικού δικαιούχου, IBAN και προαιρετικού BIC.
- [ ] Πραγματική δοκιμή κατάθεσης/συμφωνίας ποσού-αριθμού παραγγελίας, απόδοσης αντικαταβολής από courier και χειροκίνητης επιστροφής χρημάτων· μετά Merchant:ManualPaymentsVerified=true.
- [ ] Συμφωνία τυχόν χρέωσης αντικαταβολής και προθεσμίας κατάθεσης/ακύρωσης· προς το παρόν δεν υπάρχει πρόσθετη χρέωση ή αυτόματη λήξη.
- [ ] Ιδιόκτητο domain, πιστοποίηση email αποστολέα/DNS και επαληθευμένη production παράδοση.
- [ ] Επιλογή production hosting/SQL/storage, περιοχές δεδομένων/όρια/κόστος και έγκριση τυχόν δαπάνης.
- [ ] Production μόνιμα κρυπτογραφημένα keys, πλήρες password blocklist, trusted proxy/TLS και backup/key restore.
- [ ] Πραγματικά SKU, εικόνες, σύνθεση/φροντίδα/μεγεθολόγιο και τελικό απόθεμα προϊόντων.
- [ ] Συμφωνημένη retention, πρόσβαση/διαγραφή προσωπικών δεδομένων και RPO/RTO.
- [ ] Remote CI, staging deploy/restore και υπογεγραμμένη checklist εμπορικού ανοίγματος.
- [ ] Τελική ελληνική διατύπωση/έγκριση εμπορικού UI και περιεχομένου, πλήρης χειροκίνητος screen reader έλεγχος και production load/quotas.
- [ ] Συνεχές εξωτερικό monitoring/alerts, χειριστής συμβάντων και δοκιμή ειδοποιήσεων/αποκατάστασης.

Τα παραπάνω δεν συμπληρώνονται με επινοημένα επιχειρηματικά δεδομένα. Κώδικας/τοπικές δοκιμές συνεχίζονται ανεξάρτητα· πραγματικές πωλήσεις παραμένουν κλειστές ώσπου να ολοκληρωθούν οι αναγκαίες εξωτερικές απαιτήσεις.

## Τρέχουσα εργασία

Ολοκληρώθηκαν τα τοπικά παραδοτέα W20–W50 στις 19/10: 66 API + 14 browser, 10 Stripe SDK/worker offline contracts, 7 tax contracts, isolated setup/permissions και πραγματικό local backup/restore+migrations. Στις 27/10 προστέθηκαν η διαχείριση πληρωμών και η migration 013: η thesamenot_test έχει πλέον 36 πίνακες/13 migrations, με διατήρηση credentials/MFA. Η νέα επαλήθευση καλύπτει 43 API checks και 36 διακριτές browser περιπτώσεις· αναλυτικά στο ΕΛΕΓΧΟΙ.md. Επόμενο: πραγματικά στοιχεία Revolut/επιχειρηματικές εργασίες W60 και τα δηλωμένα υπόλοιπα W50. Καμία πραγματική πώληση, νέα δημοσίευση ή πληρωμένη υπηρεσία.

- [x] 29/10: security upgrade Next 16.4.0 → **16.4.3**, ίδιο React 19.3.0. Επίσημος security resolver και npm registry επέλεξαν τη σταθερή διορθωμένη έκδοση, `npm audit` 0 ευπάθειες και production build/TypeScript επιτυχές. Browser/API αποτελέσματα στο ΕΛΕΓΧΟΙ.md.
- [x] 29/10: νέα κατάθεση/αντικαταβολή αποθηκεύει email αγοραστή και ειδοποίηση τρέχοντος admin στη μόνιμη ουρά. Επαληθεύτηκε με isolated DevelopmentFile, χωρίς πραγματική αποστολή. Η πραγματική παράδοση των νέων ειδοποιήσεων και η production υποδομή email παραμένουν εξωτερικός έλεγχος.
