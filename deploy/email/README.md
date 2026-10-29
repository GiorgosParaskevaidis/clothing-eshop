# Brevo SMTP — τοπική δοκιμή email

## Παραγγελίες — 29/10/2026

Η νέα παραγγελία, είτε με κατάθεση σε Revolut είτε με αντικαταβολή, αποθηκεύει δύο προστατευμένα `background_jobs` μαζί με το SQL commit:

- `email:order:<id>:created`: επιβεβαίωση στον αγοραστή με αριθμό, προϊόντα, ποσά και αποθηκευμένες οδηγίες πληρωμής. Θέμα `thesamenot — Order confirmation`, κείμενο στα αγγλικά.
- `email:order:<id>:admin-created`: ειδοποίηση στον ενεργό, επαληθευμένο Admin με αριθμό, τρόπο/εκκρεμότητα πληρωμής, προϊόντα, ποσά, στοιχεία πελάτη/παράδοσης και σύνδεσμο `/admin/orders`. Θέμα `thesamenot — Νέα παραγγελία`, κείμενο στα ελληνικά.

Με `Auth:Enabled=true` χρησιμοποιείται το τρέχον email από `users`/`user_roles`, άρα ισχύει και επαληθευμένη αλλαγή email. Η εφαρμογή επιτρέπει bootstrap ενός admin· αν μελλοντικά προστεθούν άλλοι, επιλέγεται ο παλαιότερος ενεργός/επαληθευμένος λογαριασμός. Μόνο η ιστορική λειτουργία `Auth:Enabled=false` χρησιμοποιεί `Admin:Email`. Χωρίς έγκυρο παραλήπτη, το checkout επιστρέφει 503 πριν τη δέσμευση stock. Τα checkout retries επαναχρησιμοποιούν την ίδια παραγγελία/jobs. Δεν στέλνεται email για αποτυχημένη SQL transaction και δεν υπάρχει migration.

Η αποθήκευση στην ουρά δεν αποδεικνύει παραλαβή σε inbox. Απαιτούνται `Workers:Enabled=true`, λειτουργικό `Email:Mode=Smtp` και τα υπάρχοντα ιδιωτικά SMTP settings. Αποτυχίες επαναλαμβάνονται έως 8 προσπάθειες, μετά εμφανίζονται ως dead jobs στη διαχείριση εργασιών για έλεγχο/replay. Crash μετά από SMTP αποδοχή και πριν το SQL acknowledgment μπορεί να οδηγήσει σε επανάληψη αποστολής· διατηρείται σταθερό Message-ID, χωρίς εγγύηση ακριβώς μίας παράδοσης από εξωτερικό provider. Το προσωρινό preview έχει workers off και δεν κάνει πραγματικές αποστολές. Η νέα ροή δοκιμάζεται με `DevelopmentFile` σε τυχαία προσωρινή βάση, όχι με πραγματικό inbox. Ο κανονικός backend χρειάζεται νέο F5 για να φορτώσει τον κώδικα.

Κατάσταση 14/10/2026: ενεργοποιήθηκε Brevo SMTP στην ιδιωτική τοπική configuration. Ο ιδιοκτήτης ολοκλήρωσε εγγραφή/email/τηλέφωνο και δημιουργία SMTP key, και ενέκρινε ρητά την προσθήκη της συγκεκριμένης IP εξόδου. Ο sender είναι Verified με From name thesamenot. STARTTLS, authentication και αποστολή πέρασαν. Τα SMTP test και verification email από τον πραγματικό EmailService εμφανίστηκαν ως Delivered στα Brevo logs και ο χρήστης επιβεβαίωσε παραλαβή. Το Free plan επιβεβαιώθηκε στο UI, χωρίς κάρτα/αγορά. Απαιτείται restart του backend στο Visual Studio για να φορτώσει η ενεργή Debug διεργασία τις νέες ρυθμίσεις.

## Ρύθμιση

1. Ο ιδιοκτήτης ολοκληρώνει την εγγραφή, την επιβεβαίωση email και τυχόν onboarding στο Brevo. Επιλέγει Free, χωρίς κάρτα ή αναβάθμιση.
2. Στις ρυθμίσεις αποστολέων προστίθεται επαληθευμένη διεύθυνση και όνομα thesamenot. Η επαλήθευση ολοκληρώνεται στο inbox του ιδιοκτήτη.
3. Από την οθόνη SMTP χρησιμοποιούνται το SMTP login και SMTP key. Το API key και ο κωδικός σύνδεσης Brevo δεν είναι SMTP password.
4. Το brevo.settings.example.json δείχνει μόνο τα πεδία που συγχωνεύονται στην ενότητα Email του ιδιωτικού backend/Thesamenot.Api/appsettings.Local.json. Δεν αντικαθιστούμε όλο το αρχείο: ConnectionStrings, Store, Auth, Admin και λοιπά settings διατηρούνται. Το υπόδειγμα δεν είναι ενεργή configuration και δεν πρέπει να περιέχει πραγματικά credentials.
5. Ο υπάρχων EmailService χρησιμοποιεί smtp-relay.brevo.com, port 587 και υποχρεωτικό STARTTLS με κανονική επαλήθευση πιστοποιητικού. Δεν απενεργοποιούμε TLS validation.
6. Για φόρτωση των νέων ρυθμίσεων γίνεται restart από το Visual Studio. Δεν διακόπτουμε debug sessions του χρήστη για έλεγχο.

Αν το Brevo έχει ενεργό blocking unauthorized IP addresses for SMTP keys, προστίθεται μόνο η πραγματική IP εξόδου του backend στη λίστα Authorized IPs, με έγκριση του ιδιοκτήτη. Το SMTP 525 σημαίνει ότι ο συγκεκριμένος έλεγχος απέρριψε τη σύνδεση. Δεν απενεργοποιούμε τον έλεγχο ως λύση. Με δυναμική οικιακή IP μπορεί να απαιτηθεί νέα έγκριση όταν αλλάξει η σύνδεση.

## Δοκιμή χωρίς ιδιόκτητο domain

Το Render preview URL είναι διεύθυνση της ιστοσελίδας· δεν δίνει DNS πρόσβαση για πιστοποίηση email domain. Για τη συγκεκριμένη Gmail δοκιμή επιβεβαιώθηκε η αντικατάσταση της διεύθυνσης From με διεύθυνση brevosend.com. Το όνομα αποστολέα παραμένει thesamenot. Η επιτυχής δοκιμή δεν αποτελεί πιστοποίηση ιδιόκτητου domain για παραγωγή.

Για τοπική δοκιμή διατηρείται Store:PublicUrl=http://localhost:3000. Έτσι τα links επιβεβαίωσης λειτουργούν στο PC όπου τρέχει η εφαρμογή. Το online preview έχει ακόμη ξεχωριστή παλαιότερη demo configuration· δεν ενεργοποιούμε εκεί το νέο identity/SMTP αλλάζοντας απλώς το public URL.

## Έλεγχος αποστολής

Μετά την επαλήθευση sender και SMTP authentication στέλνεται μία δοκιμή στο εγκεκριμένο inbox του ιδιοκτήτη. Έπειτα ζητείται νέο verification email από την εφαρμογή και ελέγχονται inbox/spam, link επιβεβαίωσης και login. Τα παλιά μηνύματα DevelopmentFile δεν αποστέλλονται αυτόματα όταν αλλάξει ο provider. Κωδικοί, SMTP keys, verification tokens και ιδιωτικά μηνύματα δεν καταγράφονται σε Git ή δημόσια logs.

Το πακέτο Free που επαληθεύτηκε στις 14/10 είχε όριο 300 emails/ημέρα. Από τις φάσεις 2–5 η εφαρμογή χρησιμοποιεί μόνιμη προστατευμένη SQL ουρά με leases, retries και dead-job replay· οι παραγγελίες χρησιμοποιούν την ίδια υποδομή.

Πηγές:

- [Brevo Free όρια](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan)
- [Brevo SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP)
- [Μη πιστοποιημένο domain και Gmail From replacement](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication)
