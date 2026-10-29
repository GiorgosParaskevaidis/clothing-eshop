# Production runbook — απαιτεί πρώτα συμπλήρωση TODO

Η σημερινή έκδοση έχει τοπικά υλοποιημένες εμπορικές ροές. Από 27/10/2026 οι νέες πληρωμές είναι μόνο κατάθεση σε Revolut και αντικαταβολή, όπως περιγράφει το ../../ΠΛΗΡΩΜΕΣ.md. Δεν έχει εγκριθεί production υποδομή/δαπάνη ούτε έχουν δοθεί στοιχεία επιχείρησης, τελικά νομικά κείμενα ή ο νέος Revolut λογαριασμός. Μην ενεργοποιήσεις πραγματικές πωλήσεις πριν ολοκληρωθεί το TODO-PRODUCTION.md.

## Προετοιμασία

1. Συμφωνία merchant/λογιστή: Ελλάδα/EUR, ακριβές φορολογικό καθεστώς, παραστατικά/myDATA, courier/χρόνοι, πραγματικός κατάλογος και retention. Ο υπάρχων tax adapter καλύπτει μόνο εγκεκριμένο ενιαίο συμπεριλαμβανόμενο συντελεστή.
2. Επιλογή host/SQL/S3, domain/TLS/proxy, περιοχές δεδομένων/quotas, διατήρηση keys και SQL backups, offsite αντίγραφα, RPO/RTO και πρόσωπο ειδοποίησης. Χωρίς έγκριση χρήστη δεν επιτρέπεται κάρτα/χρέωση.
3. Μόνιμο Auth:KeyRingPath, PFX με private key από secret store και αντίγραφα παλιών key-decryption certificates για rotation. Windows Development DPAPI keys δεν αντιγράφονται αυτούσια ως production λύση. Δοκιμασμένη αποκρυπτογράφηση σε νέο απομονωμένο host πριν migration/rotation.
4. Auth:Enabled=true, πλήρες ενημερωμένο SHA-256 password blocklist από έμπιστη πηγή και admin bootstrap μόνο μία φορά με StoreMaintenance. MFA/recovery codes αποθηκεύονται ιδιωτικά.
5. Email:Mode=Smtp με TLS, verified sender domain και SMTP credentials μόνο σε secret store. Outbox workers πρέπει να τρέχουν. Μην χρησιμοποιείς DevelopmentFile για πραγματικά μηνύματα.
6. Media:Mode=S3, HTTPS Media:Endpoint, Bucket, Region, AccessKey και SecretKey για S3-compatible provider με path-style requests. Node 22 και εγκατεστημένο frontend sharp απαιτούνται για re-encode· Media:SharpModule δείχνει το sharp module και Media:NodeExecutable προαιρετικά το node executable. Επαλήθευσε πραγματικό upload/read/backup/restore, δικαιώματα bucket και απαγόρευση listing.
7. Trusted proxy addresses/networks δηλώνονται μόνο για την πραγματική αλυσίδα. Έλεγξε HTTPS redirects, Secure cookies, IP limits και spoofed forwarding στην πραγματική διαδρομή. Cors:AllowedOrigins περιέχει μόνο ακριβή HTTPS origins που χρησιμοποιούνται· προτιμάται ίδιο public origin frontend/API proxy.

## Configuration χωρίς εμπορική ενεργοποίηση

- ASPNETCORE_ENVIRONMENT=Production, Database:Initialize=false.
- Store:PublicUrl στο τελικό HTTPS domain, Store:PaymentMode=Manual, Store:SalesEnabled=false μέχρι τελική αποδοχή. Οι νέες μέθοδοι checkout ελέγχονται ανεξάρτητα από παλιές τιμές Stripe/Simulation.
- Εφαρμογή migration 013 πριν την εκκίνηση της νέας έκδοσης. Δικαιούχος/IBAN/προαιρετικό BIC και ενεργοποίηση κατάθεσης ορίζονται αποκλειστικά από `/admin/payments`, με password/MFA. Οι παλιές μεταβλητές BankTransfer δεν χρησιμοποιούνται. Η πρώτη εγγραφή είναι κενή/ανενεργή· επιτρέπεται να παραμείνει μόνο η αντικαταβολή. Οι ενεργές καταθέσεις απαιτούν έγκυρα στοιχεία και πραγματική επαλήθευση λογαριασμού, ενώ τα παλιά order snapshots διατηρούνται.
- Merchant πεδία: BusinessName, TaxIdentity, PostalAddress, SupportEmail, Courier, InvoicingProvider, RetentionPolicy, RecoveryTargets.
- TermsBody/TermsVersion, PrivacyBody/PrivacyVersion, ReturnsBody/ReturnsVersion, ShippingPolicyBody/ShippingPolicyVersion και PoliciesApproved μόνο για εγκεκριμένα τελικά κείμενα.
- TaxCalculationMode=InclusiveSingleRate, TaxRateBasisPoints, TaxPolicyVersion και TaxProfileApproved μόνο μετά λογιστική απόφαση. Μικτοί συντελεστές/απαλλαγές απαιτούν επέκταση.
- ManualPaymentsVerified, SenderDomainVerified, PersistentStorageVerified, ProductionRestoreVerified, ProxyVerified, ReleaseApproved γίνονται true μόνο μετά την αντίστοιχη καταγεγραμμένη απόδειξη.
- ConnectionStrings:Store με runtime DML account και επαλήθευση SQL TLS certificate. PFX/SMTP/S3 secrets παραμένουν εκτός Git/logs. Stripe live keys ή sandbox δεν απαιτούνται για το νέο checkout. Παλιά provider secrets χρησιμοποιούνται μόνο εάν υπάρχει ανάγκη συμφωνίας ιστορικών παραγγελιών.

## Staging / release

Πρώτα ξεχωριστό Staging με SQL, keys, S3 bucket και ελεγχόμενους email recipients. Staging απαιτεί τα ίδια μόνιμα προστατευμένα keys/SMTP/HTTPS/auth contracts. Εκτέλεσε τοπικά τον harness και remote CI πριν deployment. Το δημόσιο preview παραμένει μόνο δοκιμαστικό, χωρίς πραγματικές καταθέσεις/αποστολές.

Συμφώνησε ελεγχόμενο πραγματικό έλεγχο κατάθεσης με αντιστοίχιση ποσού/αριθμού παραγγελίας, αποστολή και είσπραξη/απόδοση αντικαταβολής από τον επιλεγμένο courier και χειροκίνητη επιστροφή χρημάτων. Έλεγξε μη/μερική κατάθεση, ακύρωση πριν αποστολή, άρνηση παραλαβής, έλεγχο επιστρεφόμενων τεμαχίων και όριο καταγεγραμμένων refunds. Μην επιβεβαιώνεις χρήματα από screenshot πελάτη ή αποτέλεσμα browser. Η τοπική fixture suite δεν αποδεικνύει πραγματική λειτουργία τράπεζας/courier. Συμφώνησε προθεσμία κατάθεσης και τυχόν χρέωση αντικαταβολής πριν τη δημοσίευση των τελικών πολιτικών.

Πάρε SQL+media+keys/certificates backup με προσωρινή παύση εγγραφών, επανάφερε σε ξεχωριστή βάση/host, σύγκρινε counts/fingerprints και άνοιξε παλιό MFA/session/outbox payload. Μέτρησε διάρκεια και απόσταση τελευταίου recovery point έναντι συμφωνημένων RPO/RTO.

Εφάρμοσε migrations με χωριστό DDL account και StoreMaintenance. Ο runtime δεν κάνει schema changes. Σε failed/applying ledger μην επανεκτελείς τυφλά: MariaDB DDL δεν έχει atomic rollback. Διερεύνηση, forward repair ή επαναφορά backup πριν ανοίξουν writers. Binary rollback επιτρέπεται μόνο αν είναι συμβατό με νέο schema.

Μετά deploy: health, authenticated /api/admin/operations/health, προϊόντα/εικόνες, admin MFA, customer/email, δοκιμαστική επιτρεπτή ροή και queued-job drain. Κατέγραψε release revision/schema/checks, μην αποθηκεύεις secrets στο report. Τελευταίο βήμα: ρητή merchant αποδοχή και SalesEnabled=true με επαληθευμένο Revolut/courier workflow.

## Καθημερινή λειτουργία / συμβάν

- /admin/jobs εμφανίζει pending/processing/dead και ασφαλές error code. Έλεγχε ηλικία ουράς, dead jobs, ληγμένες pending reservations και payment incidents. Health περιέχει missingProductionSettings μόνο σε admin.
- Έλεγχε awaitingDeposits και awaitingCourierCollections στο admin health. Οι νέες παραγγελίες δεν λήγουν με το παλιό Stripe timer· απλήρωτες μη απεσταλμένες ακυρώνονται ρητά με αιτιολογία και επιστροφή stock.
- Σε αμφίβολο payment/refund: έλεγξε κίνηση Revolut ή αναφορά courier και order history. Επιστροφή χρημάτων εκτελείται πρώτα εκτός εφαρμογής και μετά καταγράφεται με ακριβές ποσό/αναφορά/password/MFA. Μη δημιουργείς νέο request key για να παρακάμψεις άγνωστο αποτέλεσμα. Για ιστορικά provider jobs, replay μόνο του ίδιου durable job.
- Σε late payment ή mismatch, έλεγξε χρήματα/stock και προχώρησε σε ελεγχόμενο refund. Μην αλλάζεις SQL status χειροκίνητα.
- Refund δεν επιστρέφει stock. Return inspection καταγράφει πραγματικά παραληφθέντα και πωλήσιμα τεμάχια.
- SMTP outage: διόρθωση provider/keys/authorized IP, έλεγχος σταθερού Message-ID και replay dead jobs. Πιθανό duplicate email μετά lost acknowledgement είναι αποδεκτό· duplicate πληρωμή δεν είναι.
- Database/keys/media restore πάντα ως ενιαίο recovery set. Μη διαγράφεις παλιά keys ή ιστορικά image bytes χωρίς συμφωνημένη retention και restore test.
- Production load, συνεχές εξωτερικό monitoring/alerts και χειροκίνητος screen reader έλεγχος αποτελούν εξωτερικές εργασίες που δεν εκτελέστηκαν τοπικά.
