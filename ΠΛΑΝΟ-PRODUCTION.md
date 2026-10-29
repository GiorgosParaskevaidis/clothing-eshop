# Πλάνο production e-shop — thesamenot

Ημερομηνία: **13/10/2026**. Αφορά το υπάρχον project **D:\Projects\clothing-eshop**.

**Κατάσταση 19/10/2026: υλοποιήθηκαν τα τοπικά παραδοτέα W20–W50 της συνέχειας φάσεων 2–5.** Οι φάσεις 0/1 παραμένουν η βάση authentication/migrations. Τα νέα contracts, αρχεία και η κάλυψη όλων των 26 κριτηρίων βρίσκονται στο [ΦΑΣΕΙΣ-2-5.md](ΦΑΣΕΙΣ-2-5.md), τα αποτελέσματα στο [ΕΛΕΓΧΟΙ.md](ΕΛΕΓΧΟΙ.md). Η εξωτερική αποδοχή production παραμένει ανοιχτή στο [TODO-PRODUCTION.md](TODO-PRODUCTION.md): λείπουν επιχείρηση/πολιτικές, λογιστική/courier, Stripe sandbox, domain και production υποδομή. Η εφαρμογή παραμένει τοπική development/demo υλοποίηση και το παλιό online preview simulation δεν ενημερώθηκε.

**Επιβεβαιωμένη επιλογή χρήστη:** λογαριασμοί πελατών **και αγορά ως επισκέπτης**. Διατηρούμε Next.js/React/TypeScript, ASP.NET Core .NET 10, MariaDB με Dapper/MySqlConnector και Minimal API endpoints σε ξεχωριστά αρχεία ανά λειτουργία. Από 27/10 οι νέες πληρωμές είναι μόνο κατάθεση σε Revolut και αντικαταβολή· βλ. [ΠΛΗΡΩΜΕΣ.md](ΠΛΗΡΩΜΕΣ.md). Οι παλιότερες ενότητες Stripe του σχεδίου αποτελούν ιστορική τεκμηρίωση. Αντικαθίστανται για το εμπορικό άνοιγμα από πραγματικό έλεγχο κατάθεσης, είσπραξης/απόδοσης αντικαταβολής και χειροκίνητης επιστροφής, με Merchant:ManualPaymentsVerified. Stripe sandbox/live δεν είναι πλέον εκκρεμότητα του TODO.

## 1. Προτεινόμενη κατεύθυνση

Προτείνεται επέκταση της υπάρχουσας εφαρμογής, με οργανωμένο κατάλογο, σελίδες προϊόντων, λογαριασμούς και πλήρες admin. Η αρχική σελίδα μπορεί να κρατήσει τον χαρακτήρα του drop και να προβάλλει 10–15 επιλεγμένα ρούχα. Ολόκληρο το κατάστημα δεν χρειάζεται να περιορίζεται σε αυτή.

Το backend παραμένει μία εφαρμογή με σαφή modules για ταυτότητα χρηστών, κατάλογο, παραγγελίες, αποστολές και πληρωμές. Η Program.cs παραμένει μόνο composition/startup. Οι συναλλαγές και τα SQL παραμένουν στη StoreDatabase, που μπορεί να χωριστεί σε επιμέρους partial αρχεία ανά λειτουργία.

Πρώτη προτεινόμενη εμπορική έκδοση: ελληνικά, EUR, αποστολές στην Ελλάδα, ένας τρόπος αποστολής με σταθερή χρέωση και προαιρετικό όριο δωρεάν μεταφορικών, κατάθεση σε Revolut και αντικαταβολή, ρόλοι Customer/Admin. Φορολογική μεταχείριση, courier/τυχόν αντικαταβολή, στοιχεία Revolut και τελικό εμπορικό περιεχόμενο χρειάζονται επιχειρηματική επιβεβαίωση.

## 2. Τι υπάρχει ήδη και τι λείπει

Ο παρακάτω πίνακας αποτυπώνει την αρχική αφετηρία της ανάλυσης της 13/10, πριν την υλοποίηση. Τα νέα identity/authentication/migration παραδοτέα και οι εκτελεσμένοι έλεγχοι καταγράφονται στην ενότητα 15 και στα ΦΑΣΕΙΣ-0-1.md / ΕΛΕΓΧΟΙ.md.

| Περιοχή | Υπάρχει ήδη | Χρειάζεται για production |
|---|---|---|
| Σελίδες | Next.js App Router, αρχική, checkout, admin, policies και αποτελέσματα αγοράς | Κατάλογος με pagination/φίλτρα, προϊόν ανά URL, λογαριασμός, διακριτές οθόνες admin |
| Προϊόντα | Δύο seeded προϊόντα, μεγέθη, εικόνες εμπρός/πίσω, επεξεργασία τιμής/κειμένου και active | Δημιουργία, αρχειοθέτηση, slug, SKU, χρώματα, κατηγορίες, ασφαλές ανέβασμα εικόνων |
| Χρήστες | Ένας admin από configuration, PasswordHasher, HttpOnly cookie | Πελάτες στη βάση, ρόλοι, επιβεβαίωση email, reset password, MFA admin, ανάκληση sessions |
| Παραγγελίες | Αποθήκευση στοιχείων/γραμμών, snapshots τιμών, κράτηση stock και idempotency | Σύνδεση με χρήστη, ιστορικό, πληρωμές/refunds, αποστολές, επιστροφές και audit |
| Αποστολή | Ποσό από StoreOptions/configuration | Ρυθμίσεις στη βάση και επεξεργασία από admin χωρίς επανεκκίνηση |
| Απόθεμα | InnoDB transactions, row locks, atomic μείωση, version check και όριο edition | Ιστορικό κινήσεων, σαφής κύκλος reservations, αποστολή/επιστροφή, κανόνας restock |
| Πληρωμές | Stripe Checkout, signature/ποσό/νόμισμα, deduplication events και reconciliation worker | Πραγματικές Stripe sandbox δοκιμές, refunds/disputes, ανθεκτικές εργασίες και ειδοποιήσεις |
| Rate limits | Admin login: 5 αιτήματα/λεπτό/IP. Public policy: 60/λεπτό/IP σε επιλεγμένα routes | Όρια ανά IP και λογαριασμό, lockout, reset/register/upload limits, κοινή προστασία πολλών instances |
| Προστασία requests | Cookie SameSite, X-Store-Request guard, βασικά headers και generic errors | Ρητός έλεγχος CSRF στα cookie requests, origin policy, όρια body/upload, CSP και ασφαλή logs |
| Δοκιμές/CI | Integration και browser tests· CI με .NET/Next builds | Αυτόματη εκτέλεση κρίσιμων tests, migrations, isolated MariaDB, dependency/secret checks |
| Λειτουργία | Δωρεάν Render/Filess preview με simulation και εγκεκριμένο TLS pin | Production υποδομή, backups/restore, monitoring, email, παραστατικά και διαδικασίες λειτουργίας |

Υφιστάμενα αρχεία αναφοράς:

- [ServiceCollectionExtensions.cs](D:/Projects/clothing-eshop/backend/Thesamenot.Api/Hosting/ServiceCollectionExtensions.cs): cookies, authentication, rate limiting και trusted proxies.
- [AdminEndpoints.cs](D:/Projects/clothing-eshop/backend/Thesamenot.Api/Endpoints/AdminEndpoints.cs): σημερινές δυνατότητες και authorization του admin.
- [schema.sql](D:/Projects/clothing-eshop/backend/Thesamenot.Api/Database/schema.sql): οι έξι υπάρχοντες πίνακες.
- [StoreDatabase.cs](D:/Projects/clothing-eshop/backend/Thesamenot.Api/Database/StoreDatabase.cs): SQL και συναλλαγές.
- [Payments.cs](D:/Projects/clothing-eshop/backend/Thesamenot.Api/Payments.cs): πληρωμές και reconciliation.
- [next.config.ts](D:/Projects/clothing-eshop/frontend/next.config.ts), [api.ts](D:/Projects/clothing-eshop/frontend/lib/api.ts), [page.tsx](D:/Projects/clothing-eshop/frontend/app/page.tsx): proxy API και υπάρχουσα δομή storefront.

## 3. Δομή καταστήματος: δεν περιοριζόμαστε σε μία σελίδα

Το SPA περιγράφει κυρίως τον τρόπο πλοήγησης/rendering, όχι τον αριθμό οθονών ή προϊόντων. Η εφαρμογή χρησιμοποιεί ήδη Next.js App Router και Server Components· δεν απαιτείται επανεγγραφή για να αποκτήσει πολλές σελίδες. Η επίσημη τεκμηρίωση υποστηρίζει συνδυασμό server rendering και client αλληλεπίδρασης με routes ανά σελίδα. [Next.js — σελίδες και layouts](https://nextjs.org/docs/app/getting-started/layouts-and-pages), [Server και Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components).

| URL | Σκοπός |
|---|---|
| / | Brand/drop, επιλεγμένα προϊόντα και σύνδεσμος προς ολόκληρο τον κατάλογο |
| /shop | Κατάλογος, pagination, φίλτρα μεγέθους/χρώματος/τιμής/διαθεσιμότητας και ταξινόμηση |
| /products/[slug] | Φωτογραφίες, περιγραφή, σύνθεση, φροντίδα, οδηγός μεγεθών, επιλογή variant και αγορά |
| /categories/[slug] | Κατηγορία ρούχων με τον ίδιο μηχανισμό καταλόγου |
| /checkout | Επισκέπτης ή συνδεδεμένος πελάτης, αποστολή και τελικό ποσό |
| /account/login, /account/register | Είσοδος και εγγραφή |
| /account/verify-email, /account/forgot-password, /account/reset-password | Διαχείριση ασφαλούς πρόσβασης |
| /account, /account/addresses, /account/orders, /account/orders/[id] | Προφίλ, διευθύνσεις και προσωπικό ιστορικό |
| /order-access | Ασφαλής πρόσβαση επισκέπτη με σύνδεσμο που αποστέλλεται στο email |
| /returns | Υποβολή επιστροφής/υπαναχώρησης και για επισκέπτη |
| /admin/products, /admin/orders, /admin/shipping, /admin/users | Εστιασμένες οθόνες διαχείρισης |
| /policies/[slug] | Οριστικοί όροι, αποστολές, επιστροφές και ιδιωτικότητα |

Ακόμη και για 10–15 ρούχα προτείνεται κάθε προϊόν να έχει δικό του URL: βοηθά σε κοινοποίηση, αναζήτηση και πληροφορίες αγοράς. Η αρχική διατηρεί το σημερινό design.

Η πρώτη σελίδα καταλόγου μπορεί αρχικά να επιστρέφει 24 προϊόντα, με ανώτατο server limit. Φίλτρα/page/sort αποτυπώνονται στο URL. Το SQL εφαρμόζει φίλτρα και pagination πριν επιστρέψει δεδομένα· δεν φορτώνουμε ολόκληρο τον κατάλογο και όλα τα variants στον browser. Προστίθενται indexes για πραγματικά queries και deterministic sorting με δεύτερο κλειδί id.

Δημόσιες σελίδες προϊόντων/κατηγοριών αποκτούν title/description, canonical URL, σωστά structured data, sitemap μόνο δημοσιευμένων προϊόντων, optimized εικόνες και alt text. Admin, account και checkout αποκλείονται από indexing και caching. Η ασφάλεια επιβάλλεται στο API, ανεξάρτητα από robots.txt.

Σήμερα υπάρχει force-dynamic/no-store και γενικό Cache-Control no-store στο API. Δημόσια δεδομένα μπορούν αργότερα να αποκτήσουν ελεγχόμενο caching με invalidation μετά από δημοσίευση. Προσωπικά δεδομένα μένουν no-store και η τελική διαθεσιμότητα/τιμή ελέγχεται πάντα ξανά στο checkout. SSR και metadata χρειάζονται πραγματικό SEO/performance έλεγχο μετά την υλοποίηση.

## 4. Λογαριασμοί, δικαιώματα και αγορά επισκέπτη

### 4.1 Ταυτότητα χρηστών

Προτείνεται ASP.NET Core Identity για UserManager/SignInManager, password hashing, lockout, security stamps και MFA. Διατηρούμε Dapper/MariaDB με custom user/role stores. Η Microsoft τεκμηριώνει αυτή τη δυνατότητα, συμπεριλαμβανομένων αποθηκευτικών υλοποιήσεων με Dapper. [Identity με custom storage](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity-custom-storage-providers?view=aspnetcore-10.0).

Η υλοποίηση των stores είναι ουσιαστική εργασία: χρειάζονται τα interfaces για password, email, lockout, security stamp, roles, authenticator και recovery codes, καθώς και integration tests. Δεν αρκεί να προστεθεί ένας πίνακας users ή να αντιγραφεί ο σημερινός admin έλεγχος.

Ο πελάτης αποκτά εγγραφή, επιβεβαίωση email, login/logout, αλλαγή password, ασφαλές reset, αλλαγή email με επαλήθευση, διευθύνσεις και ιστορικό. Η απλή αγορά ως επισκέπτης δεν απαιτεί εγγραφή. Μη επιβεβαιωμένος λογαριασμός δεν αποκτά πρόσβαση σε παλιές παραγγελίες μόνο επειδή δήλωσε το email τους.

Απόφαση χρήστη 14/10/2026: η αρχική πρόταση ελάχιστου 15 χαρακτήρων αντικαθίσταται με **8–128 Unicode χαρακτήρες και τουλάχιστον ένα κεφαλαίο, ένα μικρό, έναν αριθμό και ένα σημείο στίξης ή σύμβολο**. Το κενό δεν καλύπτει την απαίτηση συμβόλου. Ο κανόνας εφαρμόζεται σε εγγραφή, επαναφορά, αλλαγή κωδικού και CLI bootstrap, με κοινή περιγραφή και συμφωνία backend/browser. Οι υπάρχοντες κωδικοί εξακολουθούν να γίνονται δεκτοί κατά τη σύνδεση. Η συγκεκριμένη επιλογή μήκους/σύνθεσης είναι απαίτηση του έργου.

Διατηρούνται password managers, έλεγχος συνηθισμένων/παραβιασμένων κωδικών χωρίς αποστολή plaintext σε τρίτους, χωρίς σιωπηρή περικοπή ή υποχρεωτική περιοδική αλλαγή χωρίς αιτία. Τα passwords αποθηκεύονται μόνο ως salted hashes μέσω Identity PasswordHasher, με ελεγχόμενο κόστος και rehash όταν απαιτείται. Login/reset απαντήσεις δεν αποκαλύπτουν ύπαρξη account και αποφεύγουν εμφανείς διαφορές χρόνου. Σχετικό υπόβαθρο ασφάλειας: [OWASP — Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

Κρατάμε cookie sessions με HttpOnly/Secure, χωρίς tokens στο localStorage. Προτείνονται ξεχωριστά schemes/cookies για Customer και Admin, host-only scope και production ονόματα με __Host- όπου πληρούνται οι απαιτήσεις. Η επιλογή SameSite ελέγχεται στις πραγματικές επιστροφές από Stripe και email: Lax είναι αρχική επιλογή για πελάτη, Strict για admin όπου η ροή το επιτρέπει. Cookies δεν εκδίδονται πριν ολοκληρωθεί η απαιτούμενη MFA.

### 4.2 Κρίσιμος διαχωρισμός admin

**Αρχικό P0, αντιμετωπίστηκε στη φάση 1:** το group /api/admin έλεγχε μόνο authentication. Πλέον απαιτεί ρητή Admin policy και, όταν ενεργοποιούνται database accounts, ξεχωριστό Admin scheme, role και ολοκληρωμένη MFA. Οι δοκιμές αποκλείουν συνδεδεμένο Customer από όλα τα admin routes.

Τα δικαιώματα ελέγχονται στο backend σε κάθε route. Ο πελάτης βλέπει μόνο orders/addresses που ανήκουν στο user id του session· το user_id δεν γίνεται αποδεκτό από το request ως απόδειξη ιδιοκτησίας. Κρυμμένα κουμπιά ή layouts του frontend δεν αποτελούν authorization. [OWASP — Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

Ο admin μεταφέρεται από configuration σε πραγματικό χρήστη στη βάση με μοναδικό προσωπικό λογαριασμό. Το bootstrap γίνεται ελεγχόμενα μέσω εργαλείου/one-time πρόσκλησης, όχι δημόσιου endpoint ή seeded production password. Ο νέος production κωδικός δεν επαναχρησιμοποιεί τα demo credentials. MFA για admin, ασφαλής φύλαξη recovery codes και επιβεβαίωση ταυτότητας πριν από αλλαγή MFA/ρόλων ή ευαίσθητο refund. [OWASP — MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html).

### 4.3 Σύνδεση παραγγελιών

- Συνδεδεμένος πελάτης: orders.user_id από το server session.
- Επισκέπτης: orders.user_id = NULL· αποθηκεύονται τα απαραίτητα στοιχεία checkout, χωρίς τεχνητό account.
- Μεταγενέστερη σύνδεση guest order: επιβεβαιωμένος λογαριασμός με το ίδιο email και ειδικό token μιας χρήσης στο email της συγκεκριμένης παραγγελίας. Δεν κάνουμε μαζική αυτόματη σύνδεση μόνο από αντιστοίχιση email.
- Αλλαγή προφίλ ή διεύθυνσης δεν μεταβάλλει παλιές παραγγελίες.
- Guest order access: μη προβλέψιμο token, hash στη βάση, λήξη/ανάκληση, rate limit, απόκρυψη token από logs και περιορισμένη προβολή προσωπικών δεδομένων. Η απλή δημόσια απόδειξη αγοράς δεν επιστρέφει ολόκληρη διεύθυνση.
- Αλλαγή/reset password ή απενεργοποίηση λογαριασμού ανακαλεί sessions, με server έλεγχο στην επόμενη προστατευμένη κλήση.

Το σημερινό καλάθι παραμένει για επισκέπτες. Με login προσφέρεται προβλέψιμη συγχώνευση, με server έλεγχο variants/ποσοτήτων. Μόνιμο καλάθι στη βάση είναι προαιρετική δεύτερη έκδοση, χωρίς να εμποδίζει λογαριασμούς/ιστορικό.

## 5. Προτεινόμενο μοντέλο βάσης

Η ενότητα αποτυπώνει το αρχικό σχέδιο της 13/10. Οι πραγματικές migrations και εφαρμογές τους καταγράφονται στα ΦΑΣΕΙΣ-0-1.md, ΦΑΣΕΙΣ-2-5.md και ΕΛΕΓΧΟΙ.md. Τα υπάρχοντα ids μπορούν να διατηρηθούν. Χρήματα σε ακέραια cents, currency ρητά, ημερομηνίες UTC, foreign keys και database constraints μαζί με validation. Οι decimal φορολογικοί συντελεστές και οι κανόνες στρογγυλοποίησης καθορίζονται χωριστά.

### 5.1 Χρήστες και ασφάλεια

| Πίνακας | Βασικά πεδία / σχέσεις |
|---|---|
| users | id, email, normalized_email UNIQUE, email_confirmed_at, password_hash, display_name, phone προαιρετικό, status, security_stamp, concurrency_stamp, access_failed_count, lockout_end_utc, created_at, updated_at |
| roles / user_roles | Μοναδικό role name, user_id + role_id composite PK· αρχικά Customer/Admin |
| user_addresses | id, user_id FK, label, recipient, address lines, city, postal_code, country, phone, default flags, version |
| user_sessions | id/nonce hash, user_id FK, scheme, created/expires/revoked_at, security stamp/version· ασφαλή metadata όπου χρειάζονται |
| user_action_tokens | user_id, purpose, token_hash UNIQUE, expires_at, used_at· email verification/change, reset και one-time actions |
| user_mfa / user_recovery_codes | Προστατευμένο authenticator secret, ενεργοποίηση, hashes recovery codes και consumed_at· πρόσβαση μόνο από auth υπηρεσίες |

Η normalized_email έχει σαφή εφαρμοστικό κανόνα και database uniqueness, ώστε ταυτόχρονες εγγραφές να μην δημιουργούν διπλούς λογαριασμούς. Δεν αφαιρούμε αυθαίρετα dots ή +suffixes email. Tokens υψηλής τυχαιότητας, σύντομης διάρκειας και μίας χρήσης. Κλειδιά προστασίας MFA/token payloads φυλάσσονται εκτός της βάσης με ελεγχόμενη πρόσβαση.

Claims/external logins προστίθενται μόνο εάν χρειαστεί social login· δεν αποτελούν απαίτηση της πρώτης έκδοσης.

### 5.2 Κατάλογος και απόθεμα

| Πίνακας | Βασικά πεδία / σχέσεις |
|---|---|
| products — επέκταση | slug UNIQUE, name, description, price_cents, currency, status draft/published/archived, material/care/size-guide πληροφορίες, edition/inventory_mode, version, timestamps |
| variants — επέκταση | product_id FK, SKU UNIQUE, size, color, available, version, active· μοναδικός συνδυασμός product/size/color |
| categories / product_categories | slug/name/order/active και σύνδεση πολλών προϊόντων με κατηγορίες |
| product_images | product_id FK, optional variant_id, storage_key, sort_order, alt_text, dimensions, status |
| stock_reservations | order_id, variant_id, quantity, expires_at, state, released/consumed_at· μοναδική ενεργή δέσμευση ανά γραμμή |
| inventory_movements | variant_id, order_id προαιρετικό, movement_type, quantity delta, admin/system actor, reason, timestamp, deduplication key |

Δεν διπλασιάζουμε τη λογιστική αποθέματος: θα οριστεί μία σαφής σημασία για available/reserved/sold πριν το migration. Η υπάρχουσα SQL συναλλαγή παραμένει η αφετηρία.

Το σημερινό edition περιορίζει διαθέσιμα + δεσμευμένα + πωλημένα. Χρειάζεται επιχειρηματική απόφαση για limited drops έναντι προϊόντων που ανανεώνονται. Προτείνεται inventory_mode ανά προϊόν: limited με διατήρηση edition cap, replenishable με ελεγχόμενες κινήσεις εισαγωγής. Refund δεν αυξάνει αυτόματα stock· επιστροφή αυξάνει διαθέσιμα μετά την παραλαβή και τον έλεγχο.

### 5.3 Παραγγελίες, πληρωμές και αποστολές

| Πίνακας | Βασικά πεδία / σχέσεις |
|---|---|
| orders — επέκταση | nullable user_id FK, order_number UNIQUE, currency, ξεχωριστά order/payment/fulfillment states, email/address snapshots, subtotal/shipping/tax/discount/total, shipping_rate_version, terms_version, timestamps, version |
| order_items — επέκταση | Υπάρχοντα order/variant FKs, immutable product/SKU/size/color/unit-price/tax snapshots και ποσότητα |
| order_access_tokens | order_id FK, purpose, hash UNIQUE, expiry, used/revoked_at· guest access/claim |
| payments | order_id FK, provider, checkout_session/payment_intent ids UNIQUE όπου υπάρχουν, expected/paid amount, currency, status, timestamps |
| payment_events — επέκταση | provider event id UNIQUE, received/processed_at, processing state, attempts/error reference· ελάχιστα δεδομένα, χωρίς άσκοπο πλήρες PII payload |
| refunds | payment_id FK, provider_refund_id UNIQUE, amount, reason, requested_by, idempotency_key UNIQUE, status, timestamps |
| shipments | order_id FK, courier, tracking_number, status, dispatched/delivered_at· πρώτη έκδοση μπορεί να καταχωρίζει tracking χειροκίνητα |
| return_requests / return_items | order_id, requested_at, είδος αιτήματος, γραμμές/ποσότητες, received/checked state, refund reference και επικοινωνία |
| order_status_history | order_id, προηγούμενη/νέα κατάσταση, actor, αιτία, χρόνος |
| fiscal_documents | order_id, είδος/αριθμός παραστατικού, issuer/provider reference και διαθέσιμο ασφαλές αρχείο· ακριβή πεδία μετά την επιλογή έκδοσης |

Παραδείγματα ανεξάρτητων καταστάσεων: payment pending/paid/partially_refunded/refunded/failed, fulfillment unfulfilled/shipped/delivered/returned. Οι επιτρεπόμενες μεταβάσεις ορίζονται σε υπηρεσία και ελέγχονται server-side. Δεν αφήνουμε αυθαίρετο dropdown αλλαγής κατάστασης που παρακάμπτει πληρωμή ή απόθεμα.

Indexes κατ' ελάχιστο για orders(user_id, created_at, id), διαχείριση κατά status/date, reservations(state, expires_at), variants(product_id), images(product_id, sort_order), outbox(state, next_attempt_at). Οι πλήρεις λίστες admin χρειάζονται pagination· τα σημερινά σταθερά όρια 200 orders/500 subscribers δεν καλύπτουν κανονικό ιστορικό.

### 5.4 Ρυθμίσεις και αξιόπιστες εργασίες

| Πίνακας | Βασικά πεδία / σχέσεις |
|---|---|
| store_settings | Επιτρεπόμενες εμπορικές ρυθμίσεις, currency, version, updated_by/at |
| shipping_methods / shipping_rates | Κωδικός, label, active, country/zone, fee_cents, free_threshold_cents προαιρετικό, έκδοση και ημερομηνίες ισχύος |
| audit_log | actor, action, entity/id, ασφαλές before/after ή changed fields, correlation id, timestamp· χωρίς passwords/tokens/πλήρη στοιχεία κάρτας |
| outbox_messages | event/type, entity reference, ελάχιστο payload, attempts, next_attempt_at, processed_at· unique deduplication key |
| schema_migrations | version, checksum, applied_at· ιστορικό ελεγχόμενων migrations |
| subscribers — επέκταση | Επαληθευμένη συγκατάθεση, status, έκδοση κειμένου, timestamps, προστατευμένα one-time unsubscribe tokens |

~~~mermaid
erDiagram
    USERS o|--o{ ORDERS : "nullable user_id"
    USERS ||--o{ USER_ADDRESSES : owns
    USERS ||--o{ USER_SESSIONS : authenticates
    USERS ||--o{ USER_ROLES : has
    ROLES ||--o{ USER_ROLES : grants
    PRODUCTS ||--o{ VARIANTS : contains
    PRODUCTS ||--o{ PRODUCT_IMAGES : displays
    ORDERS ||--|{ ORDER_ITEMS : snapshots
    VARIANTS ||--o{ ORDER_ITEMS : references
    ORDERS ||--o{ STOCK_RESERVATIONS : reserves
    VARIANTS ||--o{ INVENTORY_MOVEMENTS : records
    ORDERS ||--o{ PAYMENTS : settles
    PAYMENTS ||--o{ REFUNDS : refunds
    ORDERS ||--o{ SHIPMENTS : ships
    ORDERS ||--o{ RETURN_REQUESTS : returns
~~~

Η διαγραφή χρήστη δεν κάνει cascade στις παραγγελίες. Διαχωρίζουμε κατάργηση account από διατήρηση νόμιμων συναλλακτικών αρχείων, με εγκεκριμένη πολιτική διατήρησης και ελαχιστοποίηση/ανωνυμοποίηση όπου επιτρέπεται.

## 6. Τι θα κάνει ο διαχειριστής

### 6.1 Προϊόντα και εικόνες

Από /admin/products: δημιουργία draft, επεξεργασία στοιχείων/τιμής/κατηγορίας, variants μεγέθους/χρώματος/SKU, εικόνες και σειρά τους, αρχικό απόθεμα, προεπισκόπηση και δημοσίευση. Δημοσίευση μόνο με έγκυρα στοιχεία, τιμή, variants και απαιτούμενο περιεχόμενο/εικόνες.

Η «αφαίρεση» από το κατάστημα σημαίνει archived/απόκρυψη. Σταματά νέες αγορές, αλλά διατηρεί παραγγελίες και αναφορές. Μόνιμη διαγραφή μπορεί να επιτρέπεται μόνο σε draft που δεν έχει αναφορές και με σαφή έλεγχο. Δεν εφαρμόζεται cascade delete σε ιστορικά order_items.

Product/settings version checks επιστρέφουν conflict όταν δύο admins αλλάζουν την ίδια έκδοση. Κάθε μεταβολή τιμής, δημοσίευσης, stock και διαγραφής καταγράφεται με actor/reason.

Εικόνες σε μόνιμο object storage, με ξεχωριστά originals/optimized outputs. Upload μόνο από admin: όρια μεγέθους/διαστάσεων/πλήθους, έλεγχος πραγματικού τύπου και decode/re-encode, αφαίρεση metadata, τυχαίο storage key. Αρχικά JPG/PNG/WebP, χωρίς ενεργό SVG/HTML. Δεν εμπιστευόμαστε extension/MIME ή αρχικό filename. Τα presigned uploads, αν χρησιμοποιηθούν, χρειάζονται server verification πριν δημοσίευση. [OWASP — File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

Το filesystem ενός demo container δεν αποτελεί μόνιμη αποθήκη uploads. Διαγραφή εικόνας γίνεται αφού ελεγχθούν αναφορές· προγραμματισμένος καθαρισμός αφαιρεί εγκαταλειμμένα uploads.

### 6.2 Κόστος αποστολής

Από /admin/shipping: βασική χρέωση, όριο δωρεάν μεταφορικών, επιτρεπόμενες χώρες/ζώνες, ενεργός τρόπος αποστολής, περιγραφή και χρόνος παράδοσης. Η πρώτη έκδοση χρειάζεται μόνο έναν συμφωνημένο κανόνα για Ελλάδα· το schema επιτρέπει επόμενες ζώνες.

Σήμερα το ποσό προέρχεται από singleton StoreOptions. Προτείνεται ShippingService που διαβάζει την ενεργή έκδοση από DB, χωρίς restart. Τα μυστικά Stripe/DB και το payment mode παραμένουν deployment configuration, όχι επεξεργάσιμα από αυτή την οθόνη.

Προστίθεται server quote για καλάθι + διεύθυνση. Κατά την τελική υποβολή γίνεται νέος υπολογισμός και έλεγχος quote/version. Εάν άλλαξε τιμή ή μεταφορικά, ο πελάτης βλέπει το νέο ποσό και το επιβεβαιώνει πριν δημιουργηθεί πληρωμή. Παραγγελία/Stripe session που ήδη δημιουργήθηκε κρατά τα αποθηκευμένα ποσά· αλλαγή απαιτεί ελεγχόμενη λήξη και νέο checkout, όχι μεταβολή της χρέωσης στο παρασκήνιο.

### 6.3 Παραγγελίες, πελάτες και επιστροφές

Admin order detail με αναζήτηση/φίλτρα/pagination, στοιχεία παράδοσης, γραμμές, ιστορικό, πραγματική κατάσταση πληρωμής, tracking και παραστατικό. Αποστολή μόνο μετά από έγκυρη πληρωμή. Η δημιουργία voucher μέσω courier μπορεί να ακολουθήσει· πριν το άνοιγμα πρέπει να υπάρχει λειτουργική διαδικασία αποστολής και ενημέρωσης πελάτη.

Refund πλήρες/μερικό με ποσό/αιτία, επανεπιβεβαίωση admin και καταγραφή. Η αίτηση refund δεν ισοδυναμεί με επιτυχημένη επιστροφή χρημάτων. Αιτήματα επιστροφής/υπαναχώρησης καταχωρίζονται και από επισκέπτες· η εμπορική επεξεργασία μπορεί αρχικά να γίνεται χειροκίνητα μέσα από το admin.

Λίστα πελατών με περιορισμένη πρόσβαση, κατάσταση email/account και σχετικές παραγγελίες. Ο admin δεν βλέπει passwords ούτε τα αλλάζει διαβάζοντάς τα· μπορεί να ξεκινά ασφαλή πρόσκληση/reset. Αν προστεθούν υπάλληλοι, επεκτείνουμε permissions χωρίς να δίνουμε υποχρεωτικά πλήρη Admin.

## 7. Ασφάλεια και CORS

### 7.1 Ξεχωριστός κώδικας δεν σημαίνει υποχρεωτικά CORS

Σήμερα ο browser καλεί /api στον ίδιο Next.js host και το next.config.ts κάνει rewrite προς το backend. Προτείνεται ίδια δημόσια διάταξη και στο production:

~~~mermaid
flowchart LR
    B["Browser: HTTPS shop domain"] --> N["Next.js / reverse proxy"]
    N -->|"ιδιωτικό /api"| A["ASP.NET Core"]
    A --> D["MariaDB"]
    A --> S["Stripe / email / storage"]
~~~

Frontend και backend μπορούν να είναι διαφορετικές υπηρεσίες, με **ένα δημόσιο origin** για τον browser. Σε αυτή τη διάταξη δεν χρειάζεται CORS για την εφαρμογή. Αν ο browser καλέσει απευθείας άλλο scheme/host/port, τότε χρειάζεται CORS.

Σε ξεχωριστό API origin: allowlist ακριβών frontend origins ανά περιβάλλον, συγκεκριμένα methods/headers, credentials μόνο όπου χρειάζονται, σωστό preflight και middleware ordering. Δεν συνδυάζουμε wildcard origin με credentials. Το CORS δεν δίνει δικαιώματα και δεν εμποδίζει απευθείας server/εργαλειακά αιτήματα. [Microsoft — CORS](https://learn.microsoft.com/en-us/aspnet/core/security/cors?view=aspnetcore-10.0).

Η τελική proxy αλυσίδα πρέπει να αποδειχθεί με tests: πραγματική client IP, trusted proxy addresses, HTTPS scheme, host validation και απόρριψη πλαστών forwarded headers. Δεν θεωρούμε δεδομένο ότι το Next rewrite μεταφέρει σωστά όλα τα headers για auth/rate limits. SSR προσωπικών σελίδων προωθεί μόνο τα απαιτούμενα cookies προς το έμπιστο εσωτερικό API και μένει no-store.

### 7.2 Έλεγχοι που πρέπει να υλοποιηθούν

| Έλεγχος | Προδιαγραφή / αποδοχή |
|---|---|
| Login limits | Διατηρούμε IP limit και προσθέτουμε αποτυχημένες προσπάθειες ανά λογαριασμό, προσωρινό lockout/backoff και ασφαλές generic μήνυμα |
| Ενδεικτικό account lockout | Αρχική πρόταση: 5 αποτυχίες/15 λεπτά με προσωρινή καθυστέρηση/κλείδωμα· επιβεβαίωση με πραγματική χρήση, χωρίς μόνιμο κλείδωμα από τρίτους |
| Register/reset/email tokens | Ξεχωριστά όρια ανά IP και normalized email, TTL/μία χρήση, ίδια δημόσια απάντηση είτε υπάρχει account είτε όχι |
| Sessions | Secure/HttpOnly, λήξη/inactivity policy, logout/revoke, αλλαγή security stamp και server έλεγχος ανάκλησης |
| Admin MFA | TOTP με προστατευμένο secret και recovery codes· reauthentication σε αλλαγή ρόλων/MFA και ευαίσθητες ενέργειες |
| CSRF | ASP.NET antiforgery token + έλεγχος σε μεταβολές με cookie, συμπεριλαμβανομένων auth/checkout/admin routes· exact Origin validation συμπληρωματικά |
| Webhook εξαίρεση | Δεν απαιτεί browser CSRF token· απαιτεί Stripe signature στο raw body, όριο πραγματικού body και deduplication |
| Input/SQL | Server validation, parameterized SQL, whitelist sort fields, όρια σε lengths/quantities/pagination· μη αποδοχή τιμών/ρόλων από client |
| XSS/browser | Ασφαλές rendering περιγραφών, sanitization εάν εγκριθεί rich text, CSP με τα απαιτούμενα Stripe resources, frame/Referrer policies |
| Logs/PII | Χωρίς passwords, hashes, tokens, πλήρη addresses ή payment secrets· correlation ids και καταγραφή αποτυχιών χωρίς αποκάλυψη στον χρήστη |
| Abuse/διαθεσιμότητα | Body/upload limits, timeouts, concurrency caps, edge προστασία και monitoring· κοινά όρια όταν υπάρχουν πολλά instances |

Το X-Store-Request/SameSite που υπάρχει είναι αφετηρία. Για τα JSON Minimal APIs του .NET 10 ο έλεγχος antiforgery πρέπει να συνδεθεί ρητά, π.χ. με endpoint filter και IAntiforgery.ValidateRequestAsync· δεν θεωρούμε ότι η απλή registration middleware προστατεύει αυτομάτως όλα τα JSON routes. [Microsoft — ValidateRequestAsync](https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.antiforgery.iantiforgery.validaterequestasync?view=aspnetcore-10.0).

Τα ακριβή όρια είναι configuration και χρειάζονται load/abuse tests. Το ενσωματωμένο ASP.NET limiter είναι ανά process· σε πολλά instances απαιτείται κοινός μηχανισμός ή gateway. Προβλέπονται HTTP 429/Retry-After και σωστός χειρισμός frontend. Rate limiting μόνο του δεν είναι συνολική προστασία DDoS. [Microsoft — rate limiting](https://learn.microsoft.com/en-us/aspnet/core/performance/rate-limit?view=aspnetcore-10.0).

Reset tokens δεν αποστέλλονται μέσω logs ή μη ασφαλούς URL generation από αυθαίρετο Host header. Οι αλλαγές password ανακαλούν πρόσβαση και ειδοποιούν τον κάτοχο. [OWASP — Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## 8. Πληρωμές, απόθεμα και email

### 8.1 Διατήρηση και ενίσχυση των συναλλαγών

Κρατάμε τις υπάρχουσες atomic κρατήσεις/row locks και το server-side σύνολο. Το request idempotency συνδέεται με customer identity ή ασφαλή guest checkout identity, ώστε επανάληψη κλειδιού να μην επιστρέφει ξένη παραγγελία. Ίδιο κλειδί με διαφορετικό payload επιστρέφει conflict.

Το απόθεμα δεσμεύεται μαζί με την παραγγελία σε DB transaction. Stripe calls γίνονται έξω από SQL transaction, με idempotency και ασφαλή ανάκτηση μετά από timeout. Οι workers χρησιμοποιούν leases/locks ώστε restart ή δεύτερο instance να μην εκτελεί την ίδια μεταβολή δύο φορές.

Εξετάζεται ρητά το race «λήξη δέσμευσης και καθυστερημένη επιβεβαίωση πληρωμής». Αν δεν μπορεί να διασφαλιστεί stock, η παραγγελία μπαίνει σε κατάσταση εξαίρεσης με ειδοποίηση/ελεγχόμενο refund· δεν εξαφανίζεται η πληρωμή και δεν δημιουργείται αρνητικό stock.

### 8.2 Stripe και refunds

Η επιτυχία του browser δεν χαρακτηρίζει order paid. Διατηρούμε signature verification, expected amount/currency/order/session, event uniqueness και reconciliation. Stripe τεκμηριώνει ότι fulfillment μπορεί να κληθεί πολλές φορές/παράλληλα και πρέπει να είναι idempotent. [Stripe — fulfillment](https://docs.stripe.com/checkout/fulfillment).

Προστίθεται durable inbox για events με retry, bounded payload, API version policy και monitoring. HTTP 2xx δίνεται αφού το event έχει γίνει δεκτό αξιόπιστα, και η βαριά εργασία εκτελείται ασύγχρονα. Αποτυχία αποθήκευσης δεν χαρακτηρίζεται επιτυχής παραλαβή. Η επεξεργασία δεν εξαρτάται από σειρά άφιξης events. [Stripe — webhooks](https://docs.stripe.com/webhooks).

Refund request έχει μοναδικό idempotency key και το αποτέλεσμα ενημερώνεται από έγκυρα provider events/API reconciliation. Υποστηρίζονται pending/failed και μερικά refunds, χωρίς να παρακάμπτουν το όριο πληρωμένου ποσού. Disputes καταγράφονται και ειδοποιούν τον merchant. [Stripe — refunds](https://docs.stripe.com/refunds).

Δεν αποθηκεύονται PAN/CVV ή στοιχεία κάρτας. Η αρχική έκδοση μπορεί να διατηρήσει τους σημερινούς card-only τρόπους. Νέες καθυστερημένες μέθοδοι πληρωμής απαιτούν αλλαγή reservation/event policy και πρόσθετες δοκιμές πριν ενεργοποιηθούν.

### 8.3 Email και outbox

Email επιβεβαίωσης λογαριασμού, reset, αποδοχής παραγγελίας, πληρωμής, αποστολής, refund και επιστροφής. Επιλέγεται πάροχος αποστολής και ρυθμίζεται merchant domain με SPF/DKIM/DMARC.

Η επιχειρηματική μεταβολή και το outbox event αποθηκεύονται στην ίδια SQL transaction. Worker στέλνει με retries/backoff, deduplication, dead-letter κατάσταση και δυνατότητα ασφαλούς επανάληψης από admin. Αποτυχία email δεν κάνει rollback πληρωμένης παραγγελίας. Η απόλυτη μία αποστολή δεν είναι δεδομένη μετά από provider timeout· απαιτείται υποστήριξη provider idempotency όπου υπάρχει.

Marketing consent είναι ξεχωριστό και προαιρετικό. Η εγγραφή λογαριασμού/αγορά δεν συνεπάγεται εγγραφή newsletter.

## 9. API contracts και πραγματικά αρχεία υλοποίησης

### 9.1 Ελάχιστα contracts

Ενδεικτικές διαδρομές· οριστικοποιούνται με DTOs/validation πριν την υλοποίηση.

| Methods / routes | Πρόσβαση / υποχρέωση |
|---|---|
| POST /api/auth/register, /login, /logout, /verify-email, /forgot-password, /reset-password | Rate limits, CSRF όπου απαιτείται, ασφαλείς token/response κανόνες |
| GET /api/auth/session, /api/security/csrf | Μόνο απαραίτητα session στοιχεία· έκδοση antiforgery token |
| GET/PUT /api/account · CRUD /api/account/addresses | Customer, ownership από session, version checks |
| GET /api/account/orders και /{id} | Customer· φιλτράρισμα user_id στο SQL, pagination, 404 για ξένο id |
| POST /api/orders/access-link, /claim | Rate limits, email possession, purpose-bound one-time token |
| GET /api/products και /{slug} · GET /api/categories | Μόνο published/active, server filters, pagination και όρια |
| POST /api/checkout/quote και /api/checkout | Guest/Customer, authoritative ποσά, quote version και scoped idempotency |
| POST /api/returns | Customer/επαληθευμένος guest· καταχώριση και ασφαλής επιβεβαίωση παραλαβής αιτήματος |
| POST /api/admin/products · PUT /{id} · POST /{id}/archive | Admin policy + MFA, validation, version και audit |
| POST /api/admin/products/{id}/images · DELETE /images/{id} | Admin, upload validation και references |
| PUT /api/admin/stock/{id} | Admin, version, movement/reason και inventory invariants |
| GET/PUT /api/admin/shipping | Admin, version και audit· αλλαγή DB ρυθμίσεων |
| GET /api/admin/orders και /{id} · POST /{id}/ship | Admin, pagination και επιτρεπόμενες μεταβάσεις |
| POST /api/admin/orders/{id}/refunds | Admin, reauthentication, idempotency και provider reconciliation |
| GET /api/admin/users · POST /users/{id}/disable | Admin, PII minimization, revocation και audit |
| POST /api/payments/webhook | Stripe signature/durable inbox· εξαίρεση browser antiforgery |

Κοινά: σαφή DTOs, συνεπή JSON errors, cancellation/timeouts, 400 validation, 401 χωρίς session, 403 ανεπαρκή δικαιώματα, 404 μη προσβάσιμο resource, 409 stale version/idempotency mismatch, 429 limits. Το customer/admin role δεν παρέχεται από client DTO.

### 9.2 Αρχεία που θα επεκταθούν

Ο πίνακας περιγράφει τη συνολική επέκταση. Οι διαδρομές identity/authentication/migrations της φάσης 1 δημιουργήθηκαν· οι υπόλοιπες ακολουθούν στις αντίστοιχες φάσεις. Οι backend σχετικές διαδρομές βρίσκονται κάτω από D:\Projects\clothing-eshop\backend\Thesamenot.Api, εκτός όπου δηλώνεται άλλος φάκελος.

| Πραγματικό υπάρχον αρχείο / προτεινόμενο νέο | Σκοπός |
|---|---|
| backend/Thesamenot.Api/Program.cs | Παραμένει μόνο registration/composition των modules |
| Hosting/ServiceCollectionExtensions.cs, ApplicationExtensions.cs | Identity stores, schemes/policies, antiforgery, limits, keys, workers και pipeline |
| Security/Identity/DapperUserStore.cs, DapperRoleStore.cs — νέα | Επίσημα Identity interfaces με αποθήκευση μέσω StoreDatabase |
| Security/SessionValidation.cs, Security/AuthorizationPolicies.cs — νέα | Revocation και διαχωρισμός Customer/Admin/MFA |
| Endpoints/AuthEndpoints.cs, AccountEndpoints.cs — νέα | Εγγραφή/auth/προσωπικές λειτουργίες |
| Endpoints/CatalogEndpoints.cs, AdminProductEndpoints.cs, AdminShippingEndpoints.cs, AdminOrderEndpoints.cs — νέα | Focused Minimal API modules· ανακατανομή σημερινού Store/Admin module |
| Validation/ — επέκταση | DTO/request κανόνες ανά λειτουργία, χωρίς SQL |
| Database/StoreDatabase.cs και νέα StoreDatabase.Users/Catalog/Orders/Settings.cs | Οργανωμένα parameterized queries/transactions σε partial αρχεία |
| Database/Migrations/*.sql — νέα | Versioned schema αλλαγές και migration ledger |
| Services/ShippingService.cs, CatalogService.cs, OrderService.cs — νέα | Εμπορικοί κανόνες και orchestration· SQL παραμένει StoreDatabase |
| Payments.cs και Services/RefundService.cs — επέκταση/νέο | Διατήρηση checkout, ασφαλή refunds και event lifecycle |
| Services/EmailService.cs, Workers/OutboxWorker.cs — νέα | Email provider adapter και durable processing |
| tools/StoreSetup/ και εργαλείο migrations — επέκταση | Ασφαλής εγκατάσταση/production bootstrap χωρίς demo credentials |
| frontend/app/shop/, products/[slug]/, categories/[slug]/ — νέα | Κατάλογος και ανεξάρτητες σελίδες προϊόντων |
| frontend/app/account/, order-access/, returns/ — νέα | Account, guest πρόσβαση και αιτήματα επιστροφής |
| frontend/app/admin/ — επέκταση | Προϊόντα, εικόνες, αποστολές, orders και χρήστες |
| frontend/components/, lib/types.ts, lib/api.ts, lib/server-api.ts | Κοινά UI/DTOs, credentials/CSRF και ασφαλές SSR |
| frontend/app/sitemap.ts, robots.ts, layout.tsx, next.config.ts | SEO, metadata, security headers/proxy/caching όπου απαιτείται |
| frontend/tests/, tests-api/, .github/workflows/ci.yml | Κρίσιμες ροές, isolated DB και CI gates |
| deploy/production/ — νέο, όταν εγκριθεί υποδομή | Production configuration/runbooks, χωρίς μυστικά στο repository |

Δεν αλλάζουμε τις ρυθμίσεις IDE/startup χωρίς ανάγκη. Αν υπάρξει τέτοια αλλαγή, ενημερώνονται και το Thesamenot.code-workspace και τα frontend/.vscode αρχεία. Πριν από frontend κώδικα διαβάζονται τα εγκατεστημένα Next.js docs σύμφωνα με frontend/AGENTS.md.

## 10. Migrations και μετάβαση

1. Καταγραφή του υπάρχοντος schema ως baseline και εργαλείο με schema_migrations/checksums.
2. Προσθήκη identity/roles/session/token πινάκων και Admin policy **πριν** ενεργοποιηθεί customer login.
3. Επέκταση catalog/images/variants με nullable νέα πεδία, backfill των δύο προϊόντων, validation και μετά constraints.
4. Store/shipping settings και μεταφορά της συμφωνημένης αρχικής χρέωσης από configuration.
5. Nullable orders.user_id, snapshots, payments/history/reservations· backfill υπάρχοντων δοκιμαστικών orders μόνο στην αντίστοιχη test/preview βάση.
6. Refunds/returns/shipments, outbox/audit και fiscal references σύμφωνα με τελική εμπορική ροή.

Migrations εκτελούνται ως ξεχωριστό release βήμα με ειδικό schema account. Το runtime SQL account έχει μόνο τα απαραίτητα δικαιώματα, χωρίς DDL. Production Database:Initialize/seed δεν εκτελείται στην εκκίνηση.

Χρησιμοποιούμε προσθήκη → backfill → validation → περιορισμούς/αφαίρεση παλιών πεδίων σε ξεχωριστά ασφαλή βήματα. Δεν βασιζόμαστε σε αυτόματο rollback ολόκληρου MariaDB DDL migration· σχέδιο επαναφοράς/restore και συμβατές προηγούμενες εκδόσεις τεκμηριώνονται πριν το release.

Production αποκτά ξεχωριστή βάση και πραγματικό απόθεμα/merchant setup. Δεν μεταφέρουμε ως πραγματικές πωλήσεις τα simulation orders ή τα demo credentials. Το online Filess preview δεν χρησιμοποιείται για destructive test fixtures.

## 11. Υποδομή και εμπορική λειτουργία πριν το άνοιγμα

### 11.1 Production λειτουργία

- Domain/HTTPS και μία δημόσια διεύθυνση· ιδιωτικό API/DB όπου το επιτρέπει η υποδομή.
- Υποδομή με συμφωνημένη διαθεσιμότητα και χωρητικότητα για Next/.NET/DB, χωρίς να εξαρτάται ο κύκλος πληρωμών από ύπνο δωρεάν demo.
- Μόνιμα και προστατευμένα ASP.NET Data Protection keys, κοινά μεταξύ instances, ώστε restart να μην καταστρέφει cookies/tokens/MFA δεδομένα.
- Μόνιμο image storage, περιορισμένη πρόσβαση, rotation secrets και ελεγχόμενα backups.
- TLS στη βάση, διαχείριση πιστοποιητικών και least-privilege accounts. Το εγκεκριμένο preview pin δεν παρακάμπτεται και αλλαγή πιστοποιητικού δεν γίνεται αποδεκτή σιωπηρά.
- Logs/metrics/alerts για 5xx, webhook failures, pending payments, outbox retries, reservation delays, storage/quota και ύποπτα logins.
- Health/liveness/readiness χωρίς έκθεση secrets ή περιττών εσωτερικών στοιχείων.
- Encrypted backups DB και απαραίτητων αρχείων, διαφορετικό failure domain, δοκιμασμένο restore και διαδικασία incident response.
- Προτεινόμενοι αρχικοί στόχοι προς έγκριση: RPO έως 15 λεπτά (ανεκτή απώλεια δεδομένων) και RTO έως 4 ώρες (αποκατάσταση). Απαιτούν ανάλογη υποδομή/PITR και πραγματική δοκιμή· ένα ημερήσιο dump δεν αποδεικνύει RPO 15 λεπτών.
- Staging με Stripe test mode και ξεχωριστά credentials, ασφαλή deployments/rollback, patches και dependency updates.

Το Render Free/Filess demo τεκμηριώνεται στο [deploy/preview/README.md](deploy/preview/README.md). Οι περιορισμοί αδράνειας/χωρητικότητας και η demo λειτουργία δεν τεκμηριώνουν production εγγυήσεις. Δεν έχει εγκριθεί κάρτα, paid upgrade ή νέα υποδομή. Η επιλογή/χρέωση production υπηρεσιών είναι ξεχωριστή απόφαση· το παρόν δεν ενεργοποιεί υπηρεσίες ούτε υπόσχεται μηδενικό λειτουργικό κόστος.

### 11.2 Παραστατικά, πολιτικές και δεδομένα

Πριν από πραγματικές πωλήσεις χρειάζονται merchant στοιχεία, VAT/τιμές, αποδείξεις/τιμολόγια και επιβεβαιωμένη διαδικασία έκδοσης/διαβίβασης με τον λογιστή και επιλεγμένο σύστημα. Η απόδειξη Stripe δεν θεωρείται αυτόματα το φορολογικό παραστατικό του καταστήματος. Η τελική διασύνδεση και τα πεδία παραστατικών εξαρτώνται από αυτή την επιλογή. [ΑΑΔΕ — myDATA](https://www.aade.gr/mydata).

Οι προσωρινές πολιτικές αντικαθίστανται με τελικά στοιχεία εμπόρου, συνολική τιμή/μεταφορικά, χρόνους παράδοσης, εγγυήσεις, διαδικασία επιστροφών/υπαναχώρησης και επιβεβαίωση σύμβασης σε σταθερό μέσο, όπως email. Ελέγχονται οι εφαρμοστέες εξαιρέσεις και πληροφορίες προϊόντος/σύνθεσης/ασφάλειας για τα πραγματικά ρούχα. [Your Europe — B2C distance selling](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/ecommerce-distance-selling/index_en.htm).

Η online διαδικασία υπαναχώρησης μπαίνει στο πρώτο release, με καταχώριση δήλωσης και επιβεβαίωση παραλαβής σε σταθερό μέσο. Η Οδηγία 2023/2673 προβλέπει withdrawal function και εφαρμογή των μέτρων από 19/06/2026· η ακριβής ελληνική εφαρμογή/μορφή επιβεβαιώνεται πριν το άνοιγμα. Η ανάγκη δεν αναβάλλεται απλώς επειδή η εμπορική επεξεργασία επιστροφών γίνεται χειροκίνητα. [EUR-Lex — Οδηγία 2023/2673](https://eur-lex.europa.eu/eli/dir/2023/2673/oj/eng).

Ορίζονται σκοπός/νομική βάση επεξεργασίας, privacy notice, συνεργάτες/περιοχές δεδομένων, retention ανά κατηγορία και διαδικασία πρόσβασης/διαγραφής. Δεν ζητάμε συγκατάθεση marketing για να επιτραπεί αγορά. Δεν υπόσχεται το UI διαγραφή νόμιμων φορολογικών αρχείων μαζί με account. Προαιρετικά analytics/cookies ενεργοποιούνται μόνο αφού οριστεί κατάλληλος μηχανισμός συγκατάθεσης. [Ευρωπαϊκή Επιτροπή — αρχές GDPR](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en).

Η αρχιτεκτονική υποστηρίζει αυτές τις διαδικασίες· δεν αποτελεί βεβαίωση νομικής/φορολογικής συμμόρφωσης.

## 12. Σειρά υλοποίησης και παραδοτέα

Κάθε φάση παραδίδει κώδικα, migrations όπου χρειάζονται, ενημερωμένες ελληνικές οδηγίες/χάρτη και πραγματικά αποτελέσματα ελέγχων. Η παραγωγική ενεργοποίηση απαιτεί ολοκλήρωση όλων των αναγκαίων φάσεων.

| Φάση | Εργασίες | Εξαρτήσεις / κριτήριο ολοκλήρωσης |
|---|---|---|
| 0 — Αποφάσεις και contracts | Σχήμα, ροές, inventory mode, χώρα/νόμισμα/μεταφορικά, permission matrix, scopes και DTOs | Συμφωνημένοι κανόνες· εκκρεμή εξωτερικά στοιχεία καταγεγραμμένα |
| 1 — Βάση και ασφάλεια | Migrations, Admin policy, Identity/Dapper stores, cookies/sessions/CSRF/limits, email για auth, MFA | Customer δεν αποκτά admin· reset/verify/revoke και concurrent registration δοκιμασμένα |
| 2 — Λογαριασμός και παραγγελίες | Προφίλ/addresses, orders.user_id, ιστορικό, guest access/claim | Ownership στο SQL, guest checkout, ασφαλής claim και snapshots λειτουργούν |
| 3 — Κατάλογος και admin προϊόντων | Δημιουργία/draft/publish/archive, variants/categories/images, stock movements, product/shop routes | Admin δημιουργεί πλήρες προϊόν· customer το βρίσκει/αγοράζει· παλιά orders διατηρούνται |
| 4 — Αποστολή και checkout | DB shipping settings, quote/version, states/payments/refunds/returns/tracking, durable inbox/outbox | Αλλαγή μεταφορικών χωρίς restart, καθυστερημένα/διπλά events και refunds με ελεγμένα invariants |
| 5 — Ποιότητα και λειτουργία | CI integration/E2E, SEO/accessibility/performance, monitoring, backup/restore, deployment runbooks | Αυτόματοι έλεγχοι και επαληθευμένη επαναφορά σε απομονωμένο staging |
| 6 — Εμπορική ενεργοποίηση | Merchant Stripe, sandbox end-to-end, email domain, παραστατικά/courier, τελικές πολιτικές και production υποδομή | Υπογεγραμμένη checklist ανοίγματος· ξεχωριστό production dataset, χωρίς simulation |

Οι εξωτερικές αποφάσεις για Stripe merchant, email, παραστατικά/courier και υποδομή μπορούν να προετοιμάζονται παράλληλα από την αρχή. Η πρόσβαση σε παρόχους/production credentials δεν προϋποτίθεται για τον σχεδιασμό ή τις τοπικές δοκιμές.

**Προτεινόμενο πρώτο πακέτο κώδικα:** φάση 0 + ο πυρήνας της φάσης 1, ώστε η βάση/authorization να είναι σωστά πριν ανοίξει εγγραφή πελατών. Δεν ξεκινάμε μόνο από ένα registration form.

Δεν δίνεται δεσμευτικό χρονοδιάγραμμα από αυτή τη στατική ανάλυση. Identity stores, πληρωμές, μεταφορά schema και λειτουργία είναι ξεχωριστά πακέτα με ουσιαστικές δοκιμές· κάθε φάση εκτιμάται αφού οριστικοποιηθούν τα αντίστοιχα contracts/εξωτερικά στοιχεία.

## 13. Υποχρεωτικά σενάρια αποδοχής

Τα παρακάτω είναι συνολικά κριτήρια αποδοχής για ολόκληρο το production πλάνο. Τοπικά καλύφθηκαν τα authentication μέρη των 1, 3–5, 7–9 και 23, καθώς και μέρος των browser ροών του 25. Claim tokens, πραγματικό Stripe delivery/proxy/HTTPS, deploy/restore και νέα remote CI εκτέλεση παραμένουν στις επόμενες φάσεις. Τα πραγματικά αποτελέσματα καταγράφονται στο ΕΛΕΓΧΟΙ.md· δεν χαρακτηρίζονται ολοκληρωμένα και τα 26 κριτήρια.

1. Customer cookie δεν ανοίγει κανένα admin API· απαιτούνται Admin scheme/role και MFA.
2. Άλλος χρήστης δεν διαβάζει/αλλάζει order ή address μέσω τροποποιημένου id.
3. Δύο ταυτόχρονες εγγραφές ίδιας normalized_email δεν δημιουργούν διπλό χρήστη.
4. Verification/reset/claim tokens λήγουν, χρησιμοποιούνται μία φορά και δεν εμφανίζονται σε logs.
5. Reset password/disable/revoke ακυρώνει υπάρχουσα πρόσβαση· αλλαγή role δεν αφήνει stale προνόμια.
6. Λειτουργούν guest checkout και account checkout, χωρίς αυτόματη ανάθεση ξένων guest orders από email.
7. Υπέρβαση limits επιστρέφει 429/Retry-After· δοκιμάζονται IP/account διαχωρισμός και μη αποκάλυψη ύπαρξης email.
8. Mutation χωρίς έγκυρο CSRF ή με μη επιτρεπτό Origin απορρίπτεται· πραγματικό Stripe webhook παραμένει λειτουργικό.
9. Πλαστά forwarded headers δεν παρακάμπτουν IP limits/HTTPS· δοκιμή της πραγματικής αλυσίδας proxy.
10. Admin δημιουργεί/δημοσιεύει/αρχειοθετεί προϊόν, χωρίς να χαλάει ιστορικό παραγγελιών.
11. Stale αλλαγή προϊόντος/stock/shipping επιστρέφει conflict και διατηρεί σωστό audit.
12. Λάθος MIME/extension, oversized/κακόβουλο upload, SVG/HTML και image decode failure απορρίπτονται.
13. Αλλαγή μεταφορικών εμφανίζεται χωρίς restart· νέο checkout παίρνει νέα έκδοση, παλιό order κρατά το ποσό του.
14. Παράλληλες αγορές του τελευταίου τεμαχίου δεν δημιουργούν overselling· αποτυχία μιας γραμμής κάνει rollback όλης της κράτησης.
15. Επαναλαμβανόμενο checkout δεν διπλοχρεώνει· αλλαγμένο payload ή διαφορετικός owner δεν επιστρέφει ξένη παραγγελία.
16. Έγκυρα/άκυρα/διπλά/εκτός σειράς Stripe events, λάθος ποσό/νόμισμα και χαμένο event ελέγχονται.
17. Restart/timeout μετά τη δημιουργία Stripe session ανακτάται χωρίς δεύτερη πληρωμή.
18. Reservation expiry μαζί με late payment οδηγεί στην προβλεπόμενη εξαίρεση/refund χωρίς σιωπηρή απώλεια χρημάτων.
19. Μερικό/πλήρες/pending/failed refund συμφωνεί με provider και δεν επιστρέφει stock πριν από πραγματική παραλαβή/έλεγχο.
20. Outbox retries/provider timeout δεν αλλάζουν order status λάθος· operator βλέπει και επαναλαμβάνει αποτυχημένη εργασία με ασφάλεια.
21. Online υπαναχώρηση λειτουργεί και για guest, καταγράφει το αίτημα και αποστέλλει επιβεβαίωση.
22. Stripe sandbox: επιτυχία, απόρριψη, ακύρωση και απαιτούμενη επιβεβαίωση κάρτας· πραγματικό delivery σε staging webhook.
23. Restart/deploy διατηρεί Data Protection keys· migration εφαρμόζεται μία φορά και checksum mismatch απορρίπτεται.
24. Πραγματικό backup restore σε νέα απομονωμένη βάση αποδεικνύει συμφωνημένα RPO/RTO.
25. Mobile/keyboard/screen-reader ροές προϊόντος/login/checkout, φόρτωση καταλόγου και SEO metadata ελέγχονται.
26. CI εκτελεί integration/E2E με προσωρινή test DB και δεν αγγίζει local data ή online Filess preview.

## 14. Αποφάσεις που απομένουν και λειτουργίες επόμενης έκδοσης

| Θέμα | Πρόταση / τι πρέπει να επιβεβαιωθεί |
|---|---|
| Επισκέπτης ή λογαριασμός | **Επιβεβαιωμένο: και τα δύο** |
| Limited drops / restock | Διατήρηση limited mode, προσθήκη replenishable όπου απαιτείται· απόφαση ανά προϊόν |
| Χώρες/μεταφορικά | Αρχικά Ελλάδα/EUR και ένας κανόνας· ποσό, όριο δωρεάν και courier από τον merchant |
| Φόροι/παραστατικά | Φορολογικό προφίλ και πάροχος/διαδικασία από λογιστή· τιμές/στρογγυλοποίηση πριν checkout |
| Admin προσωπικό | Αρχικά Admin/Customer· περιορισμένοι επιπλέον ρόλοι εφόσον χρειαστούν |
| Email / storage / hosting | Επιλογή παρόχων, όρια/κόστος και production απαιτήσεις· δεν έχει εγκριθεί πληρωμή |
| Προϊόντα/πολιτικές | Πραγματικά SKU, εικόνες, περιγραφές/σύνθεση/μεγέθη, απόθεμα και τελικά κείμενα |

Wishlist, reviews, social login, loyalty, σύνθετα κουπόνια, πολλαπλά νομίσματα, ERP/πλήρης courier αυτοματοποίηση και abandoned-cart marketing μπορούν να ακολουθήσουν. Η λειτουργική έκδοση πρέπει ήδη να διαθέτει ασφαλή αγορά, διαχείριση προϊόντων/μεταφορικών, ιστορικό, νόμιμη διαδικασία παραστατικών/επιστροφών και επαληθευμένη λειτουργία/επαναφορά.

## 15. Συγκεκριμένη εκκίνηση και παρακολούθηση υλοποίησης

Προστέθηκε στις 13/10/2026 κατόπιν αιτήματος για συγκεκριμένη σειρά εργασίας και αποφυγή παραλείψεων. Εξειδικεύει τις φάσεις της ενότητας 12. Ο χρήστης ενέκρινε την έναρξη των φάσεων 0/1· η τοπική υλοποίηση και οι έλεγχοι W00/W11/W12 καταγράφονται παρακάτω. Στις 19/10 ο χρήστης ενέκρινε όλα τα υπόλοιπα πακέτα. W20–W50 έχουν πλέον τοπικά παραδοτέα/ελέγχους, με ρητές εξωτερικές εκκρεμότητες στα W50/W60.

### 15.1 Πρώτο πακέτο: W00 → W11 → W12

1. **W00 — Οριστικοποίηση της προδιαγραφής.** Αντιστοίχιση απαιτήσεων σε πακέτα, πίνακες/FKs/indexes, DTOs/endpoints, permissions και tests. Καταγραφή πραγματικής αφετηρίας: υφιστάμενα προϊόντα, checkout, stock locks, payments και admin. Έλεγχοι της υπάρχουσας συμπεριφοράς σε προσωρινή απομονωμένη βάση πριν τις runtime αλλαγές. Οι εμπορικές επιλογές που δεν επιβεβαιώθηκαν δεν παρουσιάζονται ως συμφωνημένες.
2. **W11 — Ελεγχόμενες αλλαγές βάσης.** Baseline των έξι υπαρχόντων πινάκων, schema_migrations/checksums και ξεχωριστό εργαλείο εφαρμογής migrations. Προσθήκη users, roles/user_roles, sessions, action tokens και MFA/recovery δεδομένων. Κανένα νέο customer login πριν ολοκληρωθεί η προστασία W12. Δεν γίνεται αυτόματο production schema/seed κατά την εκκίνηση.
3. **W12 — Ταυτότητα και δικαιώματα.** Identity stores με Dapper, Customer/Admin policies και schemes, ελεγχόμενο admin bootstrap, ασφαλές session validation/revocation. Προστασία κάθε admin route με ρόλο και απαιτούμενη MFA. Η μετάβαση των credentials είναι συγκεκριμένη εργασία, χωρίς παράλληλο αφύλακτο παλιό admin route.
4. **W12 — Πλήρης κύκλος authentication.** Register/login/logout/session, email verification/change, password change/reset, lockout/rate limits, antiforgery/Origin, MFA και recovery. Email adapter και ασφαλής τοπικός δοκιμαστικός sender· η χρήση πραγματικού provider είναι εξωτερική ρύθμιση που πρέπει να ελεγχθεί πριν δημοσίευση.
5. **W12 — Οθόνες και αποδοχή.** Login/register/verification/reset και admin MFA. Δοκιμές συνδεδεμένου πελάτη απέναντι σε όλα τα admin endpoints, ληγμένων/επαναχρησιμοποιημένων tokens, concurrent registration, logout/revoke, CSRF και όρια προσπαθειών.

Παραδοτέο του πρώτου πακέτου: ελεγχόμενη βάση ταυτότητας και λειτουργικές τοπικές ροές πρόσβασης, με αποδεδειγμένο διαχωρισμό Customer/Admin. Το προσωπικό ιστορικό παραγγελιών και η δημιουργία προϊόντων ακολουθούν στα W20/W30. Πάροχοι, production credentials και πραγματικό email delivery δεν χαρακτηρίζονται επαληθευμένα από τοπικό test sender.

### 15.2 Ακριβή αρχεία του πρώτου πακέτου

Οι ακόλουθες διαδρομές ήταν ο προγραμματισμός του πρώτου πακέτου. Τα νέα αρχεία δημιουργήθηκαν και περιγράφονται στον ενημερωμένο ΧΑΡΤΗΣ-ΑΡΧΕΙΩΝ.md. Το νέο εργαλείο είναι tools/StoreMaintenance. Το StoreSetup διατηρείται για το αρχικό demo. Το server-api.ts δεν άλλαξε: οι auth ροές χρησιμοποιούν τον browser στο ίδιο origin, χωρίς ανάγκη SSR προώθησης cookies σε αυτή τη φάση.

| Αρχείο / φάκελος | Εργασία |
|---|---|
| D:/Projects/clothing-eshop/backend/Thesamenot.Api/Database/Migrations/ — νέο | Αριθμημένα SQL migrations για baseline και identity, χωρίς demo passwords |
| D:/Projects/clothing-eshop/backend/Thesamenot.Api/Database/StoreDatabase.cs και StoreDatabase.Users.cs — νέο δεύτερο αρχείο | SQL χρηστών, ρόλων, sessions και tokens· σαφή transactions και concurrency |
| D:/Projects/clothing-eshop/backend/Thesamenot.Api/Security/Identity/DapperUserStore.cs και DapperRoleStore.cs — νέα | Identity interfaces με αποθήκευση στη MariaDB μέσω StoreDatabase |
| D:/Projects/clothing-eshop/backend/Thesamenot.Api/Security/AuthorizationPolicies.cs και SessionValidation.cs — νέα | Admin/Customer/MFA policies και ανάκληση πρόσβασης |
| D:/Projects/clothing-eshop/backend/Thesamenot.Api/Security/AdminAuthenticationService.cs | Ελεγχόμενη αντικατάσταση του configuration-only admin με database identity |
| D:/Projects/clothing-eshop/backend/Thesamenot.Api/Endpoints/AuthEndpoints.cs — νέο, AdminEndpoints.cs | Auth routes και προστασία υφιστάμενου admin |
| D:/Projects/clothing-eshop/backend/Thesamenot.Api/Hosting/ServiceCollectionExtensions.cs και ApplicationExtensions.cs | Identity/DI, schemes, limits, antiforgery, key protection και pipeline |
| D:/Projects/clothing-eshop/backend/Thesamenot.Api/Middleware/StoreRequestMiddleware.cs και Validation/ | Συνεπείς αποκρίσεις/headers, CSRF integration και κανόνες auth requests |
| D:/Projects/clothing-eshop/backend/Thesamenot.Api/Services/EmailService.cs — νέο | Email adapter και ασφαλής δυνατότητα δοκιμής· επέκταση με outbox στο W43 |
| D:/Projects/clothing-eshop/tools/StoreSetup/ και νέο εργαλείο migrations στον tools/ | Migration εφαρμογή και ελεγχόμενο bootstrap χωρίς runtime DDL |
| D:/Projects/clothing-eshop/frontend/app/account/ και frontend/app/admin/ | Auth οθόνες και MFA διαχειριστή |
| D:/Projects/clothing-eshop/frontend/lib/api.ts, server-api.ts, types.ts | Auth/CSRF DTOs και ασφαλής προώθηση απαιτούμενων cookies |
| D:/Projects/clothing-eshop/frontend/tests-api/ και frontend/tests/ | Integration/browser tests του πακέτου |
| D:/Projects/clothing-eshop/backend/Thesamenot.Api/Program.cs | Μόνο composition/registration των νέων modules |

Πριν από frontend κώδικα διαβάζονται τα σχετικά εγκατεστημένα Next.js guides. Κάθε αλλαγή αναφέρεται με τα πραγματικά αρχεία της πριν εκτελεστεί.

### 15.3 Πίνακας κάλυψης απαιτήσεων

Οι αριθμοί ελέγχων αναφέρονται στην ενότητα 13. Ο πίνακας συνδέει πακέτα με ελέγχους· δεν αποτελεί αποτέλεσμα εκτέλεσής τους. Όπου το ίδιο σενάριο αφορά διαφορετικές αλλαγές, επανελέγχεται στα αντίστοιχα πακέτα.

| ID / φάση | Απαιτήσεις και παραδοτέα | Ενότητες πλάνου | Έλεγχοι ενότητας 13 | Κατάσταση |
|---|---|---|---|---|
| W00 / 0 | Contracts, πίνακες/σχέσεις, permissions, κανόνες αποθέματος, αφετηρία και επιχειρηματικές εκκρεμότητες | 1, 2, 5, 9, 10, 12, 14 | — | Τοπικό πακέτο ολοκληρώθηκε· ΦΑΣΕΙΣ-0-1.md, baseline 10 tests |
| W11 / 1 | Migration εργαλείο/baseline, identity schema, checksums και ασφαλές bootstrap | 4, 5.1, 10 | 23 | Υλοποιήθηκε/δοκιμάστηκε σε isolated DB· πραγματικό backup/restore στο W50 |
| W12 / 1 | Identity/auth UI, Admin isolation/MFA, password/token/session ασφάλεια, limits/CSRF και proxy έλεγχοι | 3, 4.1–4.2, 7, 9 | 1, 3–5, 7–9 | Τοπική υλοποίηση/έλεγχοι και bootstrap έγιναν. Στις 14/10 ενεργοποιήθηκε Brevo Free, ελέγχθηκε πραγματική παραλαβή και προστέθηκε ασφαλής αυτόματη σύνδεση μετά verification στον browser εγγραφής. Νέο F5 απαιτείται. Production sender/domain, πλήρες blocklist και πραγματικός proxy/keys έλεγχος εκκρεμούν |
| W20 / 2 | Προφίλ/addresses, nullable orders.user_id, προσωπικό ιστορικό, guest access/claim, admin πελατών και scoped checkout ownership | 3, 4.3, 5.3, 6.3, 9 | 2, 4–6, 15 | Τοπική υλοποίηση και έλεγχοι ολοκληρώθηκαν· ΦΑΣΕΙΣ-2-5.md |
| W30 / 3 | Draft/publish/archive, categories/SKU/variants/images, κινήσεις stock, shop/product/category routes, SEO metadata και ασφαλή uploads | 3, 5.2, 6.1, 9 | 10–12, 14, 25 | Τοπικά ολοκληρώθηκε· πραγματικό S3/provider και τελικό περιεχόμενο αναμένουν W60 |
| W41 / 4 | DB shipping settings, admin μεταφορικών, quote/version, αμετάβλητα ποσά παραγγελίας | 5.4, 6.2, 9 | 11, 13, 15 | Τοπικά ολοκληρώθηκε· Ελλάδα/EUR, 4€ και δωρεάν από 80€, όπως επιβεβαίωσε ο χρήστης |
| W42 / 4 | Reservation/payment states, Stripe durable inbox/reconciliation, retries/leases, refunds/disputes και race handling | 5.2–5.3, 8.1–8.2, 9 | 14–19, 22 | Τοπικά υλοποιήθηκε/ελέγχθηκε με signed fixtures και πραγματικό Stripe SDK offline transport· πραγματικό Stripe Sandbox αναμένει W60 |
| W43 / 4 | Admin order lifecycle/tracking, guest/account returns και υπαναχώρηση, ιστορικό/audit, outbox/email retries και newsletter consent | 5.3–5.4, 6.3, 8.3, 9 | 19–21 | Τοπικά ολοκληρώθηκε· production sender/courier/πολιτικές αναμένουν W60 |
| W50 / 5 | CI από απομονωμένη DB, security/SEO/accessibility/performance έλεγχοι, persistent keys/storage, monitoring, backups/restore και runbooks | 3, 7, 11.1, 13 | 23–26 | Τοπικοί API/browser/restore/ασφάλειας έλεγχοι και CI definition· remote CI, πραγματικό proxy/S3, screen reader, staging load και συμφωνημένα RPO/RTO παραμένουν εξωτερικά |
| W60 / 6 | Merchant/provider ρυθμίσεις, Stripe sandbox delivery, email domain, παραστατικά/courier, τελικές πολιτικές/retention και production διάθεση | 11.2, 14 | 21, 22, 24, 25 | Αναμένει εξωτερικά στοιχεία/ρυθμίσεις· ο χρήστης επιβεβαίωσε ότι δεν υπάρχουν· TODO-PRODUCTION.md |

### 15.4 Κανόνας ολοκλήρωσης χωρίς παραλείψεις

Για κάθε απαίτηση καταγράφονται στο αντίστοιχο πακέτο: κώδικας/αρχεία, migration όπου χρειάζεται, endpoint και UI όπου απαιτούνται, test/result, τεκμηρίωση και τυχόν εξωτερική εξάρτηση. Μεγάλα πακέτα χωρίζονται σε μικρότερα items πριν ξεκινήσουν, με διατήρηση του αρχικού ID.

Καταστάσεις: εκκρεμεί → σε υλοποίηση → σε έλεγχο → ολοκληρωμένο. Εξωτερική ρύθμιση που απομένει δηλώνεται ρητά ως «αναμένει εξωτερική ρύθμιση» και δεν εξαφανίζεται από τα κριτήρια production.

Ένα πακέτο κλείνει αφού περάσουν οι σχετικοί έλεγχοι και οι αναγκαίοι regression checks της λειτουργίας που επηρεάζει. Ενημερώνονται ΕΛΕΓΧΟΙ.md, ΧΑΡΤΗΣ-ΑΡΧΕΙΩΝ.md, ΟΔΗΓΙΕΣ.md και ΣΥΝΕΧΕΙΑ-ΕΡΓΟΥ.md. Η τελική αποδοχή επανελέγχει όλα τα 26 σενάρια, όλες τις απαιτήσεις και τις εξωτερικές λειτουργίες της εμπορικής διάθεσης. Κανένα κριτήριο δεν θεωρείται καλυμμένο μόνο επειδή έγινε build.

Τεχνική ανάγκη αλλαγής του πλάνου τεκμηριώνεται με αιτία/επίπτωση πριν εφαρμοστεί. Αλλαγές στο συμφωνημένο stack, εμπορικό scope ή κόστος συζητούνται με τον χρήστη. Οι απαραίτητες routine επιλογές μέσα στο συμφωνημένο πλαίσιο γίνονται με καταγραφή της απόφασης.
