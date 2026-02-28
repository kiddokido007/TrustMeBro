const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Function to send email notifications
exports.sendEmailNotification = functions.firestore
    .document('notifications/{notificationId}')
    .onCreate(async (snap, context) => {
        const notification = snap.data();
        
        // Use SendGrid or other email service to send email
        // This is a simplified example
        const mailOptions = {
            from: 'noreply@trustmebro.firebaseapp.com',
            to: notification.email,
            subject: notification.subject,
            text: notification.message,
            html: `<h3>${notification.subject}</h3><p>${notification.message}</p>`
        };
        
        // In a real implementation, you would use a service like SendGrid
        // or the Firebase Extensions for email
        console.log('Sending email notification:', mailOptions);
        
        return null;
    });

// Function to send safety alerts
exports.sendSafetyAlert = functions.firestore
    .document('safety_alerts/{alertId}')
    .onCreate(async (snap, context) => {
        const alert = snap.data();
        
        // In a real implementation, this would send SMS and email alerts
        // to emergency contacts and platform administrators
        console.log('Sending safety alert:', alert);
        
        // This could trigger:
        // - SMS to emergency contacts
        // - Push notifications to admin panel
        // - Call emergency services API
        // - Log incident for investigation
        
        return null;
    });

// Function to send trip notifications
exports.sendTripNotification = functions.firestore
    .document('trips/{tripId}')
    .onWrite(async (change, context) => {
        const trip = change.after.exists ? change.after.data() : null;
        
        if (trip) {
            // Send email notifications for trip updates
            console.log('Sending trip notification:', trip);
            
            // Email notifications for:
            // - Trip booked
            // - Driver assigned
            // - Trip completed
            // - Safety checks
            
            return null;
        }
    });

// Function to send account suspension notices
exports.sendSuspensionNotice = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change, context) => {
        const beforeData = change.before.data();
        const afterData = change.after.data();
        
        // Check if account status changed to suspended
        if (beforeData.accountStatus !== 'suspended' && afterData.accountStatus === 'suspended') {
            console.log(`Account ${afterData.email} has been suspended`);
            
            // Send email notification about suspension
            const suspensionEmail = {
                from: 'admin@trustmebro.com',
                to: afterData.email,
                subject: 'Account Suspension Notice',
                html: `
                    <h3>Account Suspended</h3>
                    <p>Your TrustMeBro account has been suspended due to policy violations.</p>
                    <p>If you believe this is an error, please contact our support team.</p>
                `
            };
            
            console.log('Sending suspension notice:', suspensionEmail);
        }
        
        return null;
    });

// Function to handle emergency contacts
exports.handleEmergencyContact = functions.firestore
    .document('safety_alerts/{alertId}')
    .onCreate(async (snap, context) => {
        const alert = snap.data();
        
        // Get user's emergency contacts from their profile
        const userDoc = await admin.firestore().collection('users').doc(alert.userId).get();
        const userData = userDoc.data();
        
        if (userData && userData.emergencyContacts && userData.emergencyContacts.length > 0) {
            // Send alerts to emergency contacts
            for (const contact of userData.emergencyContacts) {
                console.log(`Sending emergency alert to: ${contact.name} at ${contact.phone}`);
                
                // In a real app, this would send SMS or call the emergency contact
            }
        }
        
        // Notify admin panel
        await admin.firestore().collection('admin_notifications').add({
            type: 'sos_alert',
            userId: alert.userId,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            message: 'SOS alert triggered by user',
            status: 'pending'
        });
        
        return null;
    });