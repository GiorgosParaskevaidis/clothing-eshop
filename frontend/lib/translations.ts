export type Language = 'el' | 'en';
export const LANGUAGE_COOKIE = 'tsn_language';
export const resolveLanguage = (value?: string): Language => (value === 'en' ? 'en' : 'el');
export const languageLocale = (language: Language) => (language === 'el' ? 'el-GR' : 'en-IE');

export const greek: Record<string, string> = {
  'Payment settings': 'Ρυθμίσεις πληρωμών',
  'Confirm your password': 'Κωδικός πρόσβασης διαχειριστή',
  'Fresh authenticator or recovery code': 'Νέος κωδικός εφαρμογής επαλήθευσης ή ανάκτησης',
  'Saving…': 'Αποθήκευση…',
  'Invalid or expired verification.': 'Η επαλήθευση δεν είναι έγκυρη ή έχει λήξει.',
  'Invalid verification.': 'Μη έγκυρη επαλήθευση.',
  'Manage the Revolut account used for new bank transfer orders. Cash on delivery remains available.':
    'Ρύθμισε τον λογαριασμό Revolut για τις νέες παραγγελίες με τραπεζική κατάθεση. Η αντικαταβολή παραμένει διαθέσιμη.',
  'Saved changes apply immediately to new orders. Existing orders keep their original payment instructions.':
    'Οι αλλαγές εφαρμόζονται αμέσως στις νέες παραγγελίες. Οι υπάρχουσες παραγγελίες διατηρούν τις αρχικές οδηγίες πληρωμής τους.',
  'Reload saved settings': 'Φόρτωση αποθηκευμένων ρυθμίσεων',
  'Enable bank transfer': 'Ενεργοποίηση τραπεζικής κατάθεσης',
  'Account holder': 'Δικαιούχος λογαριασμού',
  'BIC (optional)': 'BIC (προαιρετικό)',
  'To enable bank transfer, enter an account holder and a valid IBAN. BIC is optional.':
    'Για να ενεργοποιηθεί η κατάθεση, συμπλήρωσε δικαιούχο και έγκυρο IBAN. Το BIC είναι προαιρετικό.',
  'Verify password to save settings': 'Επαλήθευση κωδικού για αποθήκευση',
  'Payment settings saved. New orders use these details; existing orders keep their original instructions.':
    'Οι ρυθμίσεις πληρωμών αποθηκεύτηκαν. Οι νέες παραγγελίες χρησιμοποιούν αυτά τα στοιχεία· οι υπάρχουσες κρατούν τις αρχικές οδηγίες τους.',
  'Review the account details above, then enter a fresh authenticator or recovery code to save.':
    'Έλεγξε τα στοιχεία λογαριασμού παραπάνω και συμπλήρωσε νέο κωδικό εφαρμογής επαλήθευσης ή ανάκτησης για αποθήκευση.',
  'Bank transfer after saving:': 'Τραπεζική κατάθεση μετά την αποθήκευση:',
  Enabled: 'Ενεργή',
  Disabled: 'Ανενεργή',
  'Save payment settings': 'Αποθήκευση ρυθμίσεων πληρωμών',
  'Edit details before saving': 'Επεξεργασία στοιχείων πριν την αποθήκευση',
  'Check the payment settings and their lengths.':
    'Έλεγξε τα πεδία των ρυθμίσεων πληρωμών και το μήκος τους.',
  'Enter the account holder (up to 140 characters, without line breaks).':
    'Συμπλήρωσε δικαιούχο έως 140 χαρακτήρες, χωρίς αλλαγές γραμμής.',
  'Enter a valid IBAN.': 'Συμπλήρωσε έγκυρο IBAN.',
  'Enter a valid BIC (8 or 11 characters), or leave it empty.':
    'Συμπλήρωσε έγκυρο BIC με 8 ή 11 χαρακτήρες ή άφησέ το κενό.',
  'Enter the account holder and a valid IBAN before enabling bank transfer.':
    'Συμπλήρωσε δικαιούχο και έγκυρο IBAN πριν ενεργοποιήσεις την τραπεζική κατάθεση.',
  'Payment settings changed. Reload the saved settings and try again.':
    'Οι ρυθμίσεις πληρωμών άλλαξαν. Φόρτωσε τις αποθηκευμένες ρυθμίσεις και δοκίμασε ξανά.',
  'A fresh password and MFA verification is required to change payment settings.':
    'Για αλλαγή ρυθμίσεων πληρωμών απαιτούνται νέα επαλήθευση κωδικού πρόσβασης και MFA.',
  'Bank transfer is currently unavailable. Please choose cash on delivery.':
    'Η τραπεζική κατάθεση δεν είναι διαθέσιμη αυτή τη στιγμή. Επίλεξε αντικαταβολή.',
  '— unavailable': '— μη διαθέσιμη',
  'Limited edition sweatshirts. Numbered pieces. Not the same. Not for everyone.':
    'Φούτερ περιορισμένης έκδοσης. Αριθμημένα κομμάτια. Διαφορετικά. Όχι για όλους.',
  'Limited edition sweatshirts. Numbered pieces. Never restocked.':
    'Φούτερ περιορισμένης έκδοσης. Αριθμημένα κομμάτια. Χωρίς επανακυκλοφορία.',
  'Browse the thesamenot clothing collection.': 'Δες τη συλλογή ρούχων thesamenot.',
  'Page not found.': 'Η σελίδα δεν βρέθηκε.',
  'This page does not exist.': 'Αυτή η σελίδα δεν υπάρχει.',
  'Payment instructions': 'Οδηγίες πληρωμής',
  'Checkout reservation created.': 'Η παραγγελία καταχωρίστηκε και το απόθεμα δεσμεύτηκε.',
  'Payment confirmed.': 'Η πληρωμή επιβεβαιώθηκε.',
  'Reservation released.': 'Η δέσμευση αποθέματος αποδεσμεύτηκε.',
  'Payment received after stock was released. Fulfillment is blocked pending review/refund.':
    'Η πληρωμή ελήφθη μετά την αποδέσμευση του αποθέματος. Η αποστολή αναστέλλεται μέχρι τον έλεγχο ή την επιστροφή χρημάτων.',
  'Payment dispute update received. Review it in the payment provider.':
    'Ελήφθη ενημέρωση αμφισβήτησης πληρωμής. Απαιτείται έλεγχος στον πάροχο πληρωμής.',
  'Withdrawal request received.': 'Το αίτημα υπαναχώρησης καταχωρίστηκε.',
  'Return request received.': 'Το αίτημα επιστροφής καταχωρίστηκε.',
  'Returned units inspected. Restock was recorded separately from any refund.':
    'Τα επιστραφέντα προϊόντα ελέγχθηκαν. Η επαναφορά στο απόθεμα καταγράφηκε ξεχωριστά από την επιστροφή χρημάτων.',
  Checkout: 'Ολοκλήρωση παραγγελίας',
  'Bank transfer to Revolut': 'Τραπεζική κατάθεση σε Revolut',
  'Cash on delivery': 'Αντικαταβολή',
  '. Change your email in security settings.': '. Άλλαξε το email σου στις ρυθμίσεις ασφάλειας.',
  '. Refund and physical stock inspection are handled separately.':
    '. Η επιστροφή χρημάτων και ο έλεγχος των προϊόντων γίνονται ξεχωριστά.',
  AVAILABLE: 'ΔΙΑΘΕΣΙΜΑ',
  'About this piece': 'Σχετικά με το προϊόν',
  'Access a guest order by email': 'Πρόσβαση σε παραγγελία επισκέπτη μέσω email',
  Account: 'Λογαριασμός',
  'Account security': 'Ασφάλεια λογαριασμού',
  'Accounts are not enabled in this preview. You can still shop as a guest.':
    'Οι λογαριασμοί δεν είναι ενεργοί σε αυτή την προεπισκόπηση. Μπορείς να παραγγείλεις ως επισκέπτης.',
  'Accounts are temporarily unavailable.': 'Οι λογαριασμοί δεν είναι προσωρινά διαθέσιμοι.',
  Action: 'Ενέργεια',
  'Add an address': 'Προσθήκη διεύθυνσης',
  'Add to cart': 'Προσθήκη στο καλάθι',
  'Address label': 'Όνομα διεύθυνσης',
  'Address removed.': 'Η διεύθυνση διαγράφηκε.',
  'Address saved.': 'Η διεύθυνση αποθηκεύτηκε.',
  Addresses: 'Διευθύνσεις',
  'After replacing the authenticator, sign in again to set up the new one.':
    'Μετά την αντικατάσταση, συνδέσου ξανά για να ρυθμίσεις τη νέα εφαρμογή επαλήθευσης.',
  'All pieces': 'Όλα τα προϊόντα',
  'Apply filters': 'Εφαρμογή φίλτρων',
  'Authenticator and recovery': 'Επαλήθευση και ανάκτηση',
  Back: 'Πίσω',
  'Back to the drop': 'Επιστροφή στη συλλογή',
  'Bank transfer will be available once our Revolut account details have been added.':
    'Η τραπεζική κατάθεση θα είναι διαθέσιμη μόλις προστεθούν τα στοιχεία του λογαριασμού μας στη Revolut.',
  'Browse all pieces →': 'Δες όλα τα προϊόντα →',
  'CORE COLLECTION': 'ΒΑΣΙΚΗ ΣΥΛΛΟΓΗ',
  'Calculating your checkout total…': 'Υπολογισμός του συνόλου της παραγγελίας…',
  'Calculating…': 'Υπολογισμός…',
  'Cancel editing': 'Ακύρωση επεξεργασίας',
  Care: 'Φροντίδα',
  Cart: 'Καλάθι',
  'Cart (': 'Καλάθι (',
  'Catalog pages': 'Σελίδες καταλόγου',
  Categories: 'Κατηγορίες',
  'Change email': 'Αλλαγή email',
  'Change password': 'Αλλαγή κωδικού',
  'Changing your password signs you out on every device.':
    'Η αλλαγή κωδικού σε αποσυνδέει από όλες τις συσκευές.',
  'Check your filters': 'Έλεγξε τα φίλτρα σου',
  'Check your new email address for a confirmation link.':
    'Έλεγξε το νέο σου email για τον σύνδεσμο επιβεβαίωσης.',
  'Checkout as a guest, or': 'Παράγγειλε ως επισκέπτης ή',
  'Checkout failed': 'Η υποβολή της παραγγελίας δεν ολοκληρώθηκε.',
  'Checkout is temporarily unavailable.': 'Η υποβολή παραγγελίας δεν είναι προσωρινά διαθέσιμη.',
  'Choose a piece.': 'Διάλεξε ένα προϊόν.',
  'Choose valid prices, filters and a page number.':
    'Επίλεξε έγκυρες τιμές, φίλτρα και αριθμό σελίδας.',
  City: 'Πόλη',
  'Claim a guest order': 'Σύνδεση παραγγελίας επισκέπτη',
  'Clear filters': 'Καθαρισμός φίλτρων',
  Close: 'Κλείσιμο',
  Color: 'Χρώμα',
  'Completing…': 'Ολοκλήρωση…',
  'Confirm email': 'Επιβεβαίωση email',
  'Confirm subscription': 'Επιβεβαίωση εγγραφής',
  'Continue shopping': 'Συνέχεια αγορών',
  'Could not load order': 'Δεν ήταν δυνατή η φόρτωση της παραγγελίας.',
  'Could not update your settings.': 'Δεν ήταν δυνατή η ενημέρωση των ρυθμίσεών σου.',
  Country: 'Χώρα',
  'Country: Greece': 'Χώρα: Ελλάδα',
  'Create an account': 'Δημιουργία λογαριασμού',
  Crew: 'Η παρέα',
  'Current password': 'Τρέχων κωδικός',
  'DROP 01  /  LIMITED RUN  /  NUMBERED PIECES  /  NEVER RESTOCKED':
    'DROP 01  /  ΠΕΡΙΟΡΙΣΜΕΝΗ ΣΥΛΛΟΓΗ  /  ΑΡΙΘΜΗΜΕΝΑ ΚΟΜΜΑΤΙΑ  /  ΧΩΡΙΣ ΕΠΑΝΑΚΥΚΛΟΦΟΡΙΑ',
  'Details pending for this demo piece.':
    'Οι λεπτομέρειες για αυτό το δοκιμαστικό προϊόν εκκρεμούν.',
  Drop: 'Drop',
  'Drop 01': 'Drop 01',
  'Drop is live': 'Η συλλογή είναι διαθέσιμη',
  'Drop updates': 'Νέα συλλογών',
  Edit: 'Επεξεργασία',
  'Edit address': 'Επεξεργασία διεύθυνσης',
  Email: 'Email',
  'Email:': 'Email:',
  'Enter a different address': 'Συμπλήρωσε διαφορετική διεύθυνση',
  'Every drop has a fixed quantity. When it sells out, it does not come back.':
    'Κάθε συλλογή έχει συγκεκριμένη ποσότητα. Όταν εξαντληθεί, δεν επανακυκλοφορεί.',
  'Forgot password?': 'Ξέχασες τον κωδικό σου;',
  Front: 'Μπροστά',
  'Full name': 'Ονοματεπώνυμο',
  'Generate new recovery codes': 'Δημιουργία νέων κωδικών ανάκτησης',
  'Get drop news before everyone else. After the drop, send us a photo of your piece and you could be on the wall.':
    'Μάθε πρώτος τα νέα των συλλογών. Μετά την κυκλοφορία, στείλε μας μια φωτογραφία με το κομμάτι σου και μπορεί να εμφανιστείς στον τοίχο μας.',
  'Guest order access': 'Παραγγελία επισκέπτη',
  'Heavyweight fabric, boxy fit, made to last many winters.':
    'Βαρύ ύφασμα, άνετη γραμμή, φτιαγμένα για πολλούς χειμώνες.',
  'Home, work…': 'Σπίτι, εργασία…',
  'I accept the': 'Αποδέχομαι τους',
  'I agree to receive drop updates.': 'Συμφωνώ να λαμβάνω νέα για τις συλλογές.',
  'I saved my codes': 'Αποθήκευσα τους κωδικούς μου',
  'If the details match a guest order, a one-time link will be emailed. Check your inbox and spam folder.':
    'Αν τα στοιχεία αντιστοιχούν σε παραγγελία επισκέπτη, θα σταλεί σύνδεσμος μίας χρήσης στο email σου. Έλεγξε και τα ανεπιθύμητα.',
  'If this address can receive the message, a confirmation link will be sent. Confirm your email before signing in.':
    'Αν αυτή η διεύθυνση μπορεί να λάβει το μήνυμα, θα σταλεί σύνδεσμος επιβεβαίωσης. Επιβεβαίωσε το email σου πριν συνδεθείς.',
  'If this address can receive the message, reset instructions will be sent.':
    'Αν αυτή η διεύθυνση μπορεί να λάβει το μήνυμα, θα σταλούν οδηγίες επαναφοράς.',
  'If verification is needed, a new link will be sent.':
    'Αν απαιτείται επιβεβαίωση, θα σταλεί νέος σύνδεσμος.',
  'If you are not signed in, sign in first and then reopen the link from your email.':
    'Αν δεν έχεις συνδεθεί, συνδέσου πρώτα και άνοιξε ξανά τον σύνδεσμο από το email σου.',
  'In stock only': 'Μόνο διαθέσιμα',
  Instagram: 'Instagram',
  Join: 'Εγγραφή',
  'Join the list': 'Μπες στη λίστα',
  'Keep the request reference from the confirmation.':
    'Κράτησε τον αριθμό αναφοράς από την επιβεβαίωση του αιτήματος.',
  'Link it to my verified account': 'Σύνδεση με τον επιβεβαιωμένο λογαριασμό μου',
  'Link order to my account': 'Σύνδεση παραγγελίας με τον λογαριασμό μου',
  'Link this guest order to the signed-in account with the same verified email.':
    'Σύνδεσε αυτή την παραγγελία επισκέπτη με τον λογαριασμό που έχει το ίδιο επιβεβαιωμένο email.',
  'Loading order…': 'Φόρτωση παραγγελίας…',
  'Loading your basket…': 'Φόρτωση καλαθιού…',
  'Loading…': 'Φόρτωση…',
  'Main menu': 'Κύριο μενού',
  Material: 'Σύνθεση',
  'Maximum price (€)': 'Μέγιστη τιμή (€)',
  'Minimum price (€)': 'Ελάχιστη τιμή (€)',
  'My orders': 'Οι παραγγελίες μου',
  Name: 'Όνομα',
  'Need a new confirmation link?': 'Χρειάζεσαι νέο σύνδεσμο επιβεβαίωσης;',
  'New email': 'Νέο email',
  'New password': 'Νέος κωδικός',
  Newest: 'Νεότερα',
  Next: 'Επόμενη',
  'No orders are linked to your account yet. Guest orders can be claimed with a separate email link.':
    'Δεν υπάρχουν ακόμη παραγγελίες στον λογαριασμό σου. Οι παραγγελίες επισκέπτη συνδέονται μέσω ξεχωριστού συνδέσμου στο email.',
  'No pieces match these filters.': 'Δεν βρέθηκαν προϊόντα με αυτά τα φίλτρα.',
  'No saved addresses yet.': 'Δεν υπάρχουν αποθηκευμένες διευθύνσεις.',
  'Not for everyone.': 'Όχι για όλους.',
  'Not the same  /  Not for everyone  /  Limited  /  Not the same  /  Not for everyone  /  Limited':
    'Όχι το ίδιο  /  Όχι για όλους  /  Περιορισμένα  /  Όχι το ίδιο  /  Όχι για όλους  /  Περιορισμένα',
  'Not the same.': 'Όχι το ίδιο.',
  'Notes (optional)': 'Σημειώσεις (προαιρετικά)',
  'Open order': 'Προβολή παραγγελίας',
  'Open the link from your email to continue. Links expire and work once.':
    'Άνοιξε τον σύνδεσμο από το email σου για να συνεχίσεις. Οι σύνδεσμοι λήγουν και λειτουργούν μία φορά.',
  'Open the order details using this single-use email link.':
    'Δες τα στοιχεία της παραγγελίας με αυτόν τον σύνδεσμο μίας χρήσης.',
  'Open your order and choose “Request a return or withdrawal”.':
    'Άνοιξε την παραγγελία σου και επίλεξε «Αίτημα επιστροφής ή υπαναχώρησης».',
  Order: 'Παραγγελία',
  'Order details': 'Στοιχεία παραγγελίας',
  'Order email': 'Email παραγγελίας',
  'Order not found.': 'Η παραγγελία δεν βρέθηκε.',
  'Order number': 'Αριθμός παραγγελίας',
  'Order pages': 'Σελίδες παραγγελιών',
  'Order status': 'Κατάσταση παραγγελίας',
  'Order updates': 'Ενημερώσεις παραγγελίας',
  Orders: 'Παραγγελίες',
  'Orders in my account': 'Παραγγελίες του λογαριασμού μου',
  'Our own artwork': 'Δικά μας σχέδια',
  Page: 'Σελίδα',
  Password: 'Κωδικός πρόσβασης',
  'Pay the order total to the courier on delivery.':
    'Πληρώνεις το συνολικό ποσό στον courier κατά την παράδοση.',
  'Payment method': 'Τρόπος πληρωμής',
  'Payment method:': 'Τρόπος πληρωμής:',
  'Payment:': 'Πληρωμή:',
  Pieces: 'Προϊόντα',
  'Place order': 'Υποβολή παραγγελίας',
  'Placing order…': 'Υποβολή παραγγελίας…',
  'Please retry.': 'Δοκίμασε ξανά.',
  'Please try again': 'Δοκίμασε ξανά',
  'Please try again.': 'Δοκίμασε ξανά.',
  'Please wait…': 'Περίμενε…',
  'Policies recorded with this order': 'Πολιτικές που καταγράφηκαν με την παραγγελία',
  'Postal code': 'Ταχυδρομικός κώδικας',
  'Premium sweats': 'Ποιοτικά φούτερ',
  'Preview only. Do not send a bank transfer. No real order will be dispatched.':
    'Μόνο δοκιμαστική προβολή. Μην κάνεις τραπεζική κατάθεση. Δεν θα αποσταλεί πραγματική παραγγελία.',
  'Preview policy — final merchant terms have not been provided.':
    'Δοκιμαστική πολιτική — δεν έχουν δοθεί οι τελικοί όροι του καταστήματος.',
  'Preview store · Test orders only · Do not send a bank transfer':
    'Δοκιμαστικό κατάστημα · Μόνο δοκιμαστικές παραγγελίες · Μην κάνεις τραπεζική κατάθεση',
  Previous: 'Προηγούμενη',
  'Price: high to low': 'Τιμή: φθίνουσα',
  'Price: low to high': 'Τιμή: αύξουσα',
  Privacy: 'Απόρρητο',
  Profile: 'Προφίλ',
  'Profile & security': 'Προφίλ και ασφάλεια',
  'Profile saved.': 'Το προφίλ αποθηκεύτηκε.',
  'Read the return policy.': 'Διάβασε την πολιτική επιστροφών.',
  'Recovery codes': 'Κωδικοί ανάκτησης',
  Refund: 'Επιστροφή χρημάτων',
  Remove: 'Αφαίρεση',
  'Replace authenticator and sign out': 'Αντικατάσταση εφαρμογής επαλήθευσης και αποσύνδεση',
  'Request a return or withdrawal': 'Αίτημα επιστροφής ή υπαναχώρησης',
  'Request received. The store will review it and send instructions.':
    'Το αίτημα καταχωρίστηκε. Το κατάστημα θα το εξετάσει και θα στείλει οδηγίες.',
  'Request type': 'Τύπος αιτήματος',
  'Resend confirmation': 'Νέα αποστολή επιβεβαίωσης',
  Retry: 'Επανάληψη',
  Return: 'Επιστροφή',
  'Return policy': 'Πολιτική επιστροφών',
  Returns: 'Επιστροφές',
  'Returns & withdrawal': 'Επιστροφές και υπαναχώρηση',
  'Save address': 'Αποθήκευση διεύθυνσης',
  'Save profile': 'Αποθήκευση προφίλ',
  'Save your new codes. Your previous recovery codes no longer work.':
    'Αποθήκευσε τους νέους κωδικούς. Οι προηγούμενοι κωδικοί ανάκτησης δεν λειτουργούν πλέον.',
  'Saved addresses': 'Αποθηκευμένες διευθύνσεις',
  'Saved shipping address': 'Αποθηκευμένη διεύθυνση αποστολής',
  Search: 'Αναζήτηση',
  'See the pieces': 'Δες τα προϊόντα',
  'Send confirmation': 'Αποστολή επιβεβαίωσης',
  'Send order link': 'Αποστολή συνδέσμου παραγγελίας',
  'Send reset link': 'Αποστολή συνδέσμου επαναφοράς',
  Shipping: 'Μεταφορικά',
  'Shipping:': 'Μεταφορικά:',
  Shop: 'Κατάστημα',
  'Shopping cart': 'Καλάθι αγορών',
  'Sign in': 'Σύνδεση',
  'Sign out': 'Αποσύνδεση',
  'Simulate successful payment': 'Προσομοίωση επιτυχούς πληρωμής',
  Size: 'Μέγεθος',
  'Size guide': 'Οδηγός μεγεθών',
  'Skip to content': 'Μετάβαση στο περιεχόμενο',
  'Sold out': 'Εξαντλήθηκε',
  'Some quantities are no longer available. Update your basket before continuing.':
    'Κάποιες ποσότητες δεν είναι πλέον διαθέσιμες. Ενημέρωσε το καλάθι σου πριν συνεχίσεις.',
  Sort: 'Ταξινόμηση',
  'Start a new attempt': 'Νέα προσπάθεια',
  'Status:': 'Κατάσταση:',
  'Store unavailable': 'Το κατάστημα δεν είναι διαθέσιμο.',
  'Street address': 'Οδός και αριθμός',
  'Submit request': 'Υποβολή αιτήματος',
  'Submitting this form records your request.': 'Με αυτή τη φόρμα καταγράφεται το αίτημά σου.',
  Subtotal: 'Υποσύνολο',
  'TSN-…': 'TSN-…',
  'Tax included in total:': 'Φόρος που περιλαμβάνεται στο σύνολο:',
  Telephone: 'Τηλέφωνο',
  Terms: 'Όροι',
  'Test checkout': 'Δοκιμαστική παραγγελία',
  'Test payment failed': 'Η δοκιμαστική πληρωμή δεν ολοκληρώθηκε.',
  'The brand': 'Η ταυτότητά μας',
  'The character, the tag and the logo belong to the brand. Screen printed.':
    'Ο χαρακτήρας, το tag και το λογότυπο ανήκουν στο brand. Τυπωμένα με μεταξοτυπία.',
  'The crew': 'Η παρέα',
  'The drop is not open for orders yet.': 'Η συλλογή δεν είναι ακόμη ανοιχτή για παραγγελίες.',
  'The pieces': 'Τα προϊόντα',
  'The pieces are temporarily unavailable. Please try again shortly.':
    'Τα προϊόντα δεν είναι προσωρινά διαθέσιμα. Δοκίμασε ξανά σε λίγο.',
  'The store could not load this page. Your saved basket is still in this browser.':
    'Δεν ήταν δυνατή η φόρτωση της σελίδας. Το καλάθι σου παραμένει αποθηκευμένο σε αυτόν τον browser.',
  'The thesamenot ghost smoking a cigar': 'Το φάντασμα του thesamenot με ένα πούρο',
  'This checkout expired. Your reservation has been released.':
    'Αυτή η προσπάθεια παραγγελίας έληξε. Το δεσμευμένο απόθεμα αποδεσμεύτηκε.',
  'This is a test order. No payment has been taken.':
    'Αυτή είναι δοκιμαστική παραγγελία. Δεν έχει γίνει πληρωμή.',
  'This order was cancelled and its stock released.':
    'Η παραγγελία ακυρώθηκε και το απόθεμά της αποδεσμεύτηκε.',
  Total: 'Σύνολο',
  'Track shipment': 'Παρακολούθηση αποστολής',
  'Try the flow.': 'Δοκίμασε τη διαδικασία.',
  'Two pieces. Very few of them. When they are gone, they are gone.':
    'Δύο σχέδια. Ελάχιστα κομμάτια. Όταν εξαντληθούν, τελείωσε.',
  'Unavailable piece': 'Μη διαθέσιμο προϊόν',
  Unsubscribe: 'Διαγραφή από τη λίστα',
  'Update recovery': 'Ενημέρωση ανάκτησης',
  'Use as default shipping address': 'Χρήση ως προεπιλεγμένη διεύθυνση αποστολής',
  'Use the order number from your receipt and the email used at checkout. Guest orders are never linked automatically just because an email matches.':
    'Χρησιμοποίησε τον αριθμό παραγγελίας και το email της αγοράς. Οι παραγγελίες επισκέπτη δεν συνδέονται αυτόματα μόνο επειδή ταιριάζει το email.',
  'Use your order number as the payment reference. We dispatch after confirming the deposit.':
    'Χρησιμοποίησε τον αριθμό παραγγελίας ως αιτιολογία κατάθεσης. Η αποστολή γίνεται μετά την επιβεβαίωση της κατάθεσης.',
  'Verification code': 'Κωδικός επαλήθευσης',
  'Version:': 'Έκδοση:',
  'Very few pieces': 'Ελάχιστα κομμάτια',
  'View a guest order': 'Προβολή παραγγελίας επισκέπτη',
  'Wall — fills up after the drop': 'Ο τοίχος — γεμίζει μετά την κυκλοφορία',
  'We are waiting for payment confirmation. This page will update automatically.':
    'Περιμένουμε την επιβεβαίωση πληρωμής. Η σελίδα θα ενημερωθεί αυτόματα.',
  'What would you like to do?': 'Τι θα ήθελες να κάνεις;',
  "Winter '26 — Limited edition": "Χειμώνας '26 — Περιορισμένη έκδοση",
  Withdrawal: 'Υπαναχώρηση',
  'You are signed out.': 'Έχεις αποσυνδεθεί.',
  'You got it.': 'Η παραγγελία σου καταχωρίστηκε.',
  'You have been unsubscribed.': 'Διαγράφηκες από τη λίστα ενημερώσεων.',
  'Your account': 'Ο λογαριασμός σου',
  'Your addresses': 'Οι διευθύνσεις σου',
  'Your cart': 'Το καλάθι σου',
  'Your cart is empty.': 'Το καλάθι σου είναι άδειο.',
  'Your cart is empty. Pick a piece and a size below.':
    'Το καλάθι σου είναι άδειο. Διάλεξε ένα προϊόν και μέγεθος παρακάτω.',
  'Your details': 'Τα στοιχεία σου',
  'Your email': 'Το email σου',
  'Your email is confirmed. Sign in to continue.':
    'Το email σου επιβεβαιώθηκε. Συνδέσου για να συνεχίσεις.',
  'Your order': 'Η παραγγελία σου',
  'Your order has been received. It will be dispatched after we confirm your deposit.':
    'Η παραγγελία σου καταχωρίστηκε. Θα αποσταλεί μετά την επιβεβαίωση της κατάθεσής σου.',
  'Your order has been received. Payment will be collected by the courier on delivery.':
    'Η παραγγελία σου καταχωρίστηκε. Θα πληρώσεις στον courier κατά την παράδοση.',
  'Your order will appear in your account.': 'Η παραγγελία θα εμφανίζεται στον λογαριασμό σου.',
  'Your orders': 'Οι παραγγελίες σου',
  'Your password changed. Sign in using your new password.':
    'Ο κωδικός σου άλλαξε. Συνδέσου με τον νέο σου κωδικό.',
  'Your pieces': 'Τα προϊόντα σου',
  'Your subscription is confirmed.': 'Η εγγραφή σου στη λίστα επιβεβαιώθηκε.',
  and: 'και την',
  'email@example.com': 'email@example.com',
  pieces: 'προϊόντα',
  'pieces /': 'προϊόντα /',
  'privacy policy': 'πολιτική απορρήτου',
  'sign in': 'συνδέσου',
  terms: 'όρους',
  'thesamenot / account': 'thesamenot / λογαριασμός',
  'thesamenot logo': 'λογότυπο thesamenot',
  'to keep your order in your account.': 'για να αποθηκευτεί η παραγγελία στον λογαριασμό σου.',
  'units each': 'τεμάχια ανά σχέδιο',
  '© 2026 thesamenot': '© 2026 thesamenot',
  '· Default': '· Προεπιλογή',
  '· Fulfillment:': '· Αποστολή:',
  '· Payment:': '· Πληρωμή:',
  '· Quantity': '· Ποσότητα',
  '· Reference': '· Αναφορά',
  '· Total:': '· Σύνολο:',
  '— available soon': '— σύντομα διαθέσιμη',
  '— quantity to return': '— ποσότητα προς επιστροφή',
  '← All pieces': '← Όλα τα προϊόντα',
  '← Back to the pieces': '← Επιστροφή στα προϊόντα',
  Greece: 'Ελλάδα',
  Free: 'Δωρεάν',
  'Delivery in Greece': 'Παράδοση στην Ελλάδα',
  Days: 'Ημέρες',
  Hours: 'Ώρες',
  Minutes: 'Λεπτά',
  Secs: 'Δευτ.',
  'LIMITED /': 'ΠΕΡΙΟΡΙΣΜΕΝΑ /',
  Opens: 'Ανοίγει',
  Athens: 'Αθήνα',
  size: 'μέγεθος',
  'sold out': 'εξαντλήθηκε',
  front: 'μπροστά',
  back: 'πίσω',
  Decrease: 'Μείωση',
  Increase: 'Αύξηση',
  'Sign in to continue.': 'Συνδέσου για να συνεχίσεις.',
  'Reset your password': 'Επαναφορά κωδικού',
  'Confirm your email': 'Επιβεβαίωση email',
  'Choose a new password': 'Διάλεξε νέο κωδικό',
  'Use 8–128 characters with an uppercase letter, a lowercase letter, a number and a symbol. Avoid common passwords.':
    'Χρησιμοποίησε 8–128 χαρακτήρες, με κεφαλαίο, μικρό, αριθμό και σύμβολο. Απόφυγε συνηθισμένους κωδικούς.',
  'Quote valid for 10 minutes. If prices change, you will review the new total before payment.':
    'Η προσφορά ισχύει για 10 λεπτά. Αν αλλάξουν οι τιμές, θα ελέγξεις το νέο σύνολο πριν από την υποβολή.',
  'Cash on delivery. Pay the total to the courier when your order is delivered.':
    'Αντικαταβολή. Πλήρωσε το συνολικό ποσό στον courier κατά την παράδοση της παραγγελίας σου.',
  'Dispatch follows confirmation of the deposit by the store.':
    'Η αποστολή γίνεται μετά την επιβεβαίωση της κατάθεσης από το κατάστημα.',
  pending: 'Σε αναμονή',
  awaiting_payment: 'Αναμονή κατάθεσης',
  confirmed: 'Επιβεβαιωμένη',
  paid: 'Πληρωμένη',
  fulfilled: 'Απεσταλμένη',
  cancelled: 'Ακυρωμένη',
  expired: 'Έληξε',
  succeeded: 'Ολοκληρώθηκε',
  unpaid: 'Ανεξόφλητη',
  partially_refunded: 'Μερική επιστροφή χρημάτων',
  refunded: 'Επιστροφή χρημάτων',
  payment_exception: 'Απαιτείται έλεγχος πληρωμής',
  unfulfilled: 'Δεν έχει αποσταλεί',
  shipped: 'Απεσταλμένη',
  requested: 'Καταχωρίστηκε',
  approved: 'Εγκρίθηκε',
  rejected: 'Απορρίφθηκε',
  received: 'Παραλήφθηκε',
  closed: 'Ολοκληρώθηκε',
  submitted: 'Υποβλήθηκε',
  failed: 'Απέτυχε',
  canceled: 'Ακυρώθηκε',
  return: 'Επιστροφή',
  withdrawal: 'Υπαναχώρηση',
  'Could not verify this request. Please retry.':
    'Δεν ήταν δυνατή η επαλήθευση του αιτήματος. Δοκίμασε ξανά.',
  'Please sign in.': 'Συνδέσου στον λογαριασμό σου.',
  'Too many requests. Please try again shortly.':
    'Έγιναν πολλές προσπάθειες. Δοκίμασε ξανά σε λίγο.',
  'Too many requests. Please retry later.': 'Έγιναν πολλές προσπάθειες. Δοκίμασε ξανά αργότερα.',
  'The store is temporarily unavailable.': 'Το κατάστημα δεν είναι προσωρινά διαθέσιμο.',
  'Failed to fetch': 'Δεν ήταν δυνατή η σύνδεση. Έλεγξε το δίκτυό σου και δοκίμασε ξανά.',
  'NetworkError when attempting to fetch resource.': 'Δεν ήταν δυνατή η σύνδεση. Δοκίμασε ξανά.',
  'Check your contact details, shipping address, terms and basket quantities.':
    'Έλεγξε τα στοιχεία επικοινωνίας, τη διεύθυνση, την αποδοχή των όρων και τις ποσότητες στο καλάθι.',
  'Choose bank transfer to Revolut or cash on delivery.':
    'Επίλεξε τραπεζική κατάθεση σε Revolut ή αντικαταβολή.',
  'The drop is not open yet.': 'Η συλλογή δεν είναι ακόμη ανοιχτή για παραγγελίες.',
  'Checkout is temporarily unavailable. Please try again later.':
    'Η υποβολή παραγγελίας δεν είναι προσωρινά διαθέσιμη. Δοκίμασε ξανά αργότερα.',
  'Bank transfer will be available once the Revolut account details have been added. Please choose cash on delivery.':
    'Η κατάθεση θα είναι διαθέσιμη μόλις προστεθούν τα στοιχεία Revolut. Επίλεξε αντικαταβολή.',
  'This checkout attempt changed. Start a new checkout.':
    'Τα στοιχεία της προσπάθειας άλλαξαν. Ξεκίνα νέα προσπάθεια παραγγελίας.',
  'This checkout has already finished. Start a new checkout.':
    'Αυτή η προσπάθεια έχει ολοκληρωθεί. Ξεκίνα νέα προσπάθεια παραγγελίας.',
  'Your checkout quote changed or expired. Review the new total and confirm again.':
    'Η προσφορά άλλαξε ή έληξε. Έλεγξε το νέο σύνολο και επιβεβαίωσε ξανά.',
  'Prices changed. Review the new total and confirm again.':
    'Οι τιμές άλλαξαν. Έλεγξε το νέο σύνολο και επιβεβαίωσε ξανά.',
  'A selected piece is no longer available.': 'Ένα από τα προϊόντα δεν είναι πλέον διαθέσιμο.',
  'Request a new order access link.': 'Ζήτησε νέο σύνδεσμο πρόσβασης στην παραγγελία.',
  'Order access expired. Request a new link.':
    'Η πρόσβαση στην παραγγελία έληξε. Ζήτησε νέο σύνδεσμο.',
  'Check your email to confirm your subscription.':
    'Έλεγξε το email σου για να επιβεβαιώσεις την εγγραφή σου.',
  'Seller details and final terms will be published before real sales open. This preview accepts test orders only.':
    'Τα στοιχεία του καταστήματος και οι τελικοί όροι θα δημοσιευτούν πριν ανοίξουν οι πραγματικές πωλήσεις. Αυτή η προεπισκόπηση δέχεται μόνο δοκιμαστικές παραγγελίες.',
  'Accounts, orders and newsletter consent are stored for the requested functions. The final privacy notice and retention policy have not been supplied.':
    'Τα στοιχεία λογαριασμών, παραγγελιών και συγκατάθεσης newsletter αποθηκεύονται για τις αντίστοιχες λειτουργίες. Η τελική πολιτική απορρήτου και διατήρησης δεδομένων δεν έχει ακόμη δοθεί.',
  'Final return instructions and merchant contact details have not been supplied. This preview records test return/withdrawal requests.':
    'Δεν έχουν δοθεί οι τελικές οδηγίες επιστροφής και τα στοιχεία επικοινωνίας του καταστήματος. Εδώ καταγράφονται μόνο δοκιμαστικά αιτήματα επιστροφής ή υπαναχώρησης.',
  'Final courier, dispatch times and shipping policy have not been supplied.':
    'Δεν έχουν δοθεί ο τελικός courier, οι χρόνοι αποστολής και η πολιτική αποστολών.',
  'Black hoodie. The S over the heart, the whole back is his.':
    'Μαύρο φούτερ με κουκούλα. Το S πάνω από την καρδιά, ολόκληρη η πλάτη δική του.',
  'White crewneck. The goblin over the heart, the tag running down the spine.':
    'Λευκό φούτερ χωρίς κουκούλα. Ο goblin πάνω από την καρδιά, το tag κατά μήκος της πλάτης.',
  'Invalid email, password or verification.': 'Μη έγκυρο email, κωδικός πρόσβασης ή επαλήθευση.',
  'Invalid or expired link.': 'Ο σύνδεσμος δεν είναι έγκυρος ή έχει λήξει.',
  'Invalid or expired verification code.': 'Ο κωδικός επαλήθευσης δεν είναι έγκυρος ή έχει λήξει.',
  'Invalid, expired or already used verification code.':
    'Ο κωδικός επαλήθευσης δεν είναι έγκυρος, έχει λήξει ή έχει ήδη χρησιμοποιηθεί.',
  'Enter a valid email address.': 'Συμπλήρωσε έγκυρη διεύθυνση email.',
  'Enter your name (up to 120 characters).': 'Συμπλήρωσε το όνομά σου (έως 120 χαρακτήρες).',
  'Invalid password input.': 'Ο κωδικός δεν είναι έγκυρος.',
  'Account changed. Please retry.': 'Τα στοιχεία του λογαριασμού άλλαξαν. Δοκίμασε ξανά.',
  'Account changed. Retry sign in.': 'Τα στοιχεία του λογαριασμού άλλαξαν. Συνδέσου ξανά.',
  'Customer accounts are not enabled in this demo.':
    'Οι λογαριασμοί πελατών δεν είναι ενεργοί σε αυτή τη δοκιμαστική έκδοση.',
  'Invalid profile version.': 'Το προφίλ άλλαξε. Ανανέωσε τη σελίδα.',
  'Check the address, country and telephone.': 'Έλεγξε τη διεύθυνση, τη χώρα και το τηλέφωνο.',
  'Invalid page or page size.': 'Ο αριθμός σελίδας ή το πλήθος αποτελεσμάτων δεν είναι έγκυρο.',
  'Check the required fields and their lengths.': 'Έλεγξε τα υποχρεωτικά πεδία και το μήκος τους.',
  'Check the basket and shipping country.': 'Έλεγξε το καλάθι και τη χώρα αποστολής.',
  'Shipping is temporarily unavailable.': 'Η αποστολή δεν είναι προσωρινά διαθέσιμη.',
  'Some pieces are no longer available. Review your basket.':
    'Κάποια προϊόντα δεν είναι πλέον διαθέσιμα. Έλεγξε το καλάθι σου.',
  'Check the return request and quantities.': 'Έλεγξε το αίτημα επιστροφής και τις ποσότητες.',
  'A return request requires a confirmed order.':
    'Για αίτημα επιστροφής απαιτείται επιβεβαιωμένη παραγγελία.',
  'A return item does not belong to this order.':
    'Ένα από τα προϊόντα προς επιστροφή δεν ανήκει σε αυτή την παραγγελία.',
  'Return quantity exceeds the remaining purchased quantity.':
    'Η ποσότητα επιστροφής υπερβαίνει την υπολειπόμενη αγορασμένη ποσότητα.',
  'This return request changed. Use a new request.':
    'Το αίτημα επιστροφής άλλαξε. Χρησιμοποίησε νέο αίτημα.',
};

export function translate(language: Language, text: string): string {
  if (language === 'en' || !text) return text;
  const key = text.trim();
  const value = Object.hasOwn(greek, key) ? greek[key] : undefined;
  if (value !== undefined)
    return (
      text.slice(0, text.length - text.trimStart().length) +
      value +
      text.slice(text.trimEnd().length)
    );
  // Translate system labels without altering the stored payee, IBAN, amount or reference.
  if (
    key.startsWith('Bank transfer to Revolut\n') ||
    key.startsWith('Cash on delivery. Pay the total to the courier when your order is delivered.\n')
  ) {
    const labels: Record<string, string> = {
      'Account holder: ': 'Δικαιούχος: ',
      'IBAN: ': 'IBAN: ',
      'BIC: ': 'BIC: ',
      'Amount: ': 'Ποσό: ',
      'Payment reference: ': 'Αιτιολογία κατάθεσης: ',
    };
    return text
      .split('\n')
      .map((line) => {
        for (const [label, translatedLabel] of Object.entries(labels)) {
          if (line.startsWith(label)) return translatedLabel + line.slice(label.length);
        }
        return translate(language, line);
      })
      .join('\n');
  }
  if (key.startsWith('Not enough stock for '))
    return (
      'Δεν υπάρχει αρκετό απόθεμα για ' +
      key.slice('Not enough stock for '.length).replace(', size ', ', μέγεθος ')
    );
  const receipt =
    /^(Receipt confirmed|Manual refund recorded): (\d+) cents\. Reference: ([\s\S]*)$/.exec(key);
  if (receipt)
    return `${receipt[1] === 'Receipt confirmed' ? 'Επιβεβαιωμένη είσπραξη' : 'Καταγεγραμμένη επιστροφή χρημάτων'}: ${receipt[2]} λεπτά του ευρώ. Αναφορά: ${receipt[3]}`;
  const refund = /^Refund (requested|pending|succeeded|failed): (\d+) cents\.$/.exec(key);
  if (refund)
    return `Επιστροφή χρημάτων (${translate(language, refund[1])}): ${refund[2]} λεπτά του ευρώ.`;
  const shipment = /^Shipped with (.+)\. Tracking: ([\s\S]*)$/.exec(key);
  if (shipment) return `Αποστολή με ${shipment[1]}. Αριθμός αποστολής: ${shipment[2]}`;
  if (key.startsWith('Order cancelled: '))
    return 'Ακύρωση παραγγελίας: ' + key.slice('Order cancelled: '.length);
  const returned = /^Return request (approved|rejected|received)\. ([\s\S]*)$/.exec(key);
  if (returned) return `Αίτημα επιστροφής (${translate(language, returned[1])}). ${returned[2]}`;
  return text;
}
