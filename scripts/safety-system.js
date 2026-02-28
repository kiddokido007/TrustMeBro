// Safety System Module
// Handles SOS alerts and night safety checks

import { getFirestore, collection, addDoc, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

export class SafetySystem {
    constructor(app, userId, notificationSystem) {
        this.db = getFirestore(app);
        this.rtdb = getDatabase(app);
        this.userId = userId;
        this.notificationSystem = notificationSystem;
        this.safetyCheckInterval = null;
        this.safetyCheckTimeout = null;
        this.isNightTime = false;
        this.tripActive = false;
        this.safetyCheckCount = 0;
    }

    // Initialize safety system
    init() {
        this.setupSOSButton();
        this.checkNightTime();
    }

    // Setup SOS button
    setupSOSButton() {
        const sosButton = document.getElementById('sosButton');
        if (sosButton) {
            sosButton.addEventListener('click', () => this.triggerSOS());
        }
    }

    // Trigger SOS emergency alert
    async triggerSOS(autoTriggered = false) {
        try {
            // Log for immediate feedback
            console.log('🚨 SOS Triggered!');

            // Immediate record creation (no waiting for confirmation)
            const location = await this.getCurrentLocation();
            const sosData = {
                userId: this.userId,
                timestamp: new Date(),
                location: location,
                autoTriggered: autoTriggered,
                status: 'active',
                type: 'sos_alert',
                priority: 'high'
            };

            // Save to Firestore & Realtime DB
            const sosRef = await addDoc(collection(this.db, "sos_alerts"), sosData);
            await set(ref(this.rtdb, `sos_alerts/${sosRef.id}`), {
                ...sosData,
                timestamp: new Date().toISOString()
            });

            // Trigger in-app alert/sound (simulated)
            this.showSOSConfirmation();

            // Notify emergency contacts & Admin
            await this.alertEmergencyContacts(location);

            // Also notify the general safety_alerts collection used by admin
            await addDoc(collection(this.db, "safety_alerts"), {
                userId: this.userId,
                type: autoTriggered ? 'Auto-Stop Escalation' : 'Manual SOS',
                status: 'active',
                timestamp: new Date(),
                location: location
            });

            if (this.notificationSystem) {
                await this.notificationSystem.sendNotification(
                    'sos_triggered',
                    'SOS Alert Sent',
                    'High-priority alert sent to Admin and Contacts.'
                );
            }

            return sosRef.id;
        } catch (error) {
            console.error('Error triggering SOS:', error);
        }
    }

    // Get current location
    getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        resolve({
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            accuracy: position.coords.accuracy
                        });
                    },
                    (error) => {
                        console.error('Error getting location:', error);
                        resolve({ latitude: null, longitude: null, accuracy: null });
                    },
                    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                );
            } else {
                resolve({ latitude: null, longitude: null, accuracy: null });
            }
        });
    }

    // Show SOS confirmation
    showSOSConfirmation() {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            padding: 2rem;
            border-radius: 20px;
            text-align: center;
            max-width: 400px;
            animation: slideUp 0.3s ease;
        `;

        modal.innerHTML = `
            <div style="font-size: 4rem; color: #FF4757; margin-bottom: 1rem;">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h2 style="color: #FF4757; margin-bottom: 1rem;">SOS Alert Sent!</h2>
            <p style="color: #64748B; margin-bottom: 1.5rem;">
                Emergency services and your contacts have been notified.<br>
                <strong>Help is on the way!</strong>
            </p>
            <p style="font-size: 0.9rem; color: #94a3b8;">
                Your current location has been shared.<br>
                Stay calm and stay safe.
            </p>
            <button id="closeSOSModal" style="
                margin-top: 1.5rem;
                padding: 0.8rem 2rem;
                background: var(--primary);
                color: white;
                border: none;
                border-radius: 12px;
                font-weight: 600;
                cursor: pointer;
            ">Understood</button>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close modal
        document.getElementById('closeSOSModal').addEventListener('click', () => {
            overlay.remove();
        });

        // Auto-close after 10 seconds
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.remove();
            }
        }, 10000);
    }

    // Alert emergency contacts
    async alertEmergencyContacts(location) {
        try {
            // Get user data with emergency contacts
            const userDoc = await getDoc(doc(this.db, "users", this.userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const emergencyContacts = userData.emergencyContacts || [];

                // In a real app, this would send SMS/push notifications
                // For now, we'll log the contacts that would be alerted
                console.log('Emergency contacts to be alerted:', emergencyContacts);

                // Create alert record for each contact
                for (const contact of emergencyContacts) {
                    await addDoc(collection(this.db, "emergency_alerts"), {
                        userId: this.userId,
                        contactName: contact.name,
                        contactPhone: contact.phone,
                        location: location,
                        timestamp: new Date(),
                        status: 'sent'
                    });
                }
            }
        } catch (error) {
            console.error('Error alerting emergency contacts:', error);
        }
    }

    // Check if it's night time
    checkNightTime() {
        const hour = new Date().getHours();
        this.isNightTime = hour >= 22 || hour < 6;

        // Update safety status indicator
        this.updateSafetyStatus();

        // Check again every minute
        setInterval(() => {
            const newHour = new Date().getHours();
            const wasNightTime = this.isNightTime;
            this.isNightTime = newHour >= 22 || newHour < 6;

            if (wasNightTime !== this.isNightTime) {
                this.updateSafetyStatus();
            }
        }, 60000);
    }

    // Update safety status indicator
    updateSafetyStatus() {
        const safetyStatus = document.querySelector('.safety-status');
        if (safetyStatus) {
            if (this.isNightTime) {
                safetyStatus.innerHTML = `
                    <i class="fas fa-moon"></i>
                    <span>Night Safety Mode Active</span>
                `;
                safetyStatus.style.color = '#FF8C00';
            } else {
                safetyStatus.innerHTML = `
                    <i class="fas fa-shield-alt"></i>
                    <span>All systems secure</span>
                `;
                safetyStatus.style.color = '#2ED573';
            }
        }
    }

    // Start night safety checks
    startNightSafetyChecks() {
        if (!this.isNightTime) {
            console.log('Not night time, safety checks not needed');
            return;
        }

        this.tripActive = true;
        this.safetyCheckCount = 0;

        // First check after 5 minutes
        setTimeout(() => {
            if (this.tripActive) {
                this.performSafetyCheck();
            }
        }, 5 * 60 * 1000); // 5 minutes

        // Subsequent checks every 10 minutes
        this.safetyCheckInterval = setInterval(() => {
            if (this.tripActive) {
                this.performSafetyCheck();
            }
        }, 10 * 60 * 1000); // 10 minutes
    }

    // Perform safety check
    performSafetyCheck() {
        this.safetyCheckCount++;

        // Show safety check modal
        this.showSafetyCheckModal();

        // Set timeout for response (2 minutes)
        this.safetyCheckTimeout = setTimeout(() => {
            this.handleNoResponse();
        }, 2 * 60 * 1000); // 2 minutes
    }

    // Show safety check modal
    showSafetyCheckModal() {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'safetyCheckModal';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            padding: 2.5rem;
            border-radius: 20px;
            text-align: center;
            max-width: 400px;
            animation: slideUp 0.3s ease;
        `;

        modal.innerHTML = `
            <div style="font-size: 4rem; color: #FF8C00; margin-bottom: 1rem;">
                <i class="fas fa-shield-alt"></i>
            </div>
            <h2 style="color: var(--primary); margin-bottom: 1rem;">Safety Check</h2>
            <p style="color: #64748B; margin-bottom: 2rem; font-size: 1.1rem;">
                Are you safe?<br>
                Please confirm your status.
            </p>
            <button id="confirmSafetyBtn" style="
                width: 100%;
                padding: 1rem;
                background: #2ED573;
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 1.1rem;
                font-weight: 600;
                cursor: pointer;
                margin-bottom: 0.8rem;
            ">I'm Safe ✓</button>
            <button id="needHelpBtn" style="
                width: 100%;
                padding: 1rem;
                background: #FF4757;
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 1.1rem;
                font-weight: 600;
                cursor: pointer;
            ">I Need Help!</button>
            <p style="font-size: 0.8rem; color: #94a3b8; margin-top: 1rem;">
                No response in 2 minutes will trigger SOS
            </p>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Setup button listeners
        document.getElementById('confirmSafetyBtn').addEventListener('click', () => {
            this.handleSafetyConfirmed();
            overlay.remove();
        });

        document.getElementById('needHelpBtn').addEventListener('click', () => {
            overlay.remove();
            this.triggerSOS(false);
        });
    }

    // Handle safety confirmed
    handleSafetyConfirmed() {
        // Clear timeout
        if (this.safetyCheckTimeout) {
            clearTimeout(this.safetyCheckTimeout);
            this.safetyCheckTimeout = null;
        }

        // Log response
        console.log('Safety check confirmed');

        // Send notification
        if (this.notificationSystem) {
            this.notificationSystem.sendNotification(
                'safety_check',
                'Safety Check Confirmed',
                'Thank you for confirming your safety.'
            );
        }
    }

    // Handle no response to safety check
    handleNoResponse() {
        console.log('No response to safety check - escalating');

        // Show warning
        this.showWarningNotification();

        // Send intermediate alert to admin dashboard (Potential Emergency)
        addDoc(collection(this.db, "safety_alerts"), {
            userId: this.userId,
            type: 'Unresponsive Rider (Stationary)',
            status: 'warning',
            timestamp: new Date()
        });

        // Set final timeout (1 more minute)
        setTimeout(() => {
            // Check if modal still exists (user hasn't responded)
            const modal = document.getElementById('safetyCheckModal');
            if (modal) {
                // Auto-trigger SOS & Automated Notification Sequence
                modal.remove();
                this.triggerSOS(true);
                this.triggerAutomatedSequence();
            }
        }, 1 * 60 * 1000); // 1 minute
    }

    // Simulate automated call and message
    triggerAutomatedSequence() {
        console.log("📞 Initiating Automated Call Trigger...");
        console.log("📱 Sending Automated SMS Alert...");

        if (this.notificationSystem) {
            this.notificationSystem.sendNotification(
                'safety_escalated',
                'Escalation Initiated',
                'Automated call and message sent to your registered number.'
            );
        }
    }

    // Show warning notification
    showWarningNotification() {
        const warning = document.createElement('div');
        warning.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: #FF4757;
            color: white;
            padding: 1rem 2rem;
            border-radius: 12px;
            z-index: 10001;
            font-weight: 600;
            box-shadow: 0 10px 30px rgba(255, 71, 87, 0.3);
            animation: shake 0.5s ease;
        `;
        warning.textContent = '⚠️ No response! SOS will trigger in 1 minute!';
        document.body.appendChild(warning);

        setTimeout(() => {
            warning.remove();
        }, 5000);
    }

    // Stop night safety checks
    stopNightSafetyChecks() {
        this.tripActive = false;

        if (this.safetyCheckInterval) {
            clearInterval(this.safetyCheckInterval);
            this.safetyCheckInterval = null;
        }

        if (this.safetyCheckTimeout) {
            clearTimeout(this.safetyCheckTimeout);
            this.safetyCheckTimeout = null;
        }

        // Remove any active safety check modal
        const modal = document.getElementById('safetyCheckModal');
        if (modal) {
            modal.remove();
        }
    }

    // Cleanup
    destroy() {
        this.stopNightSafetyChecks();
    }
}
