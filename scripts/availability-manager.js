// Availability Manager Module
// Handles driver online/offline status and availability management

import { getFirestore, doc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

export class AvailabilityManager {
    constructor(app, driverId, driverDashboard, locationBroadcaster) {
        this.db = getFirestore(app);
        this.driverId = driverId;
        this.driverDashboard = driverDashboard;
        this.locationBroadcaster = locationBroadcaster;
        this.isOnline = false;
    }

    // Initialize availability manager
    init() {
        this.setupToggleSwitch();
        this.listenToAvailabilityChanges();
    }

    // Setup online/offline toggle switch
    setupToggleSwitch() {
        const toggleSwitch = document.getElementById('availabilityToggle');
        if (!toggleSwitch) return;

        toggleSwitch.addEventListener('change', async (e) => {
            const shouldGoOnline = e.target.checked;

            if (shouldGoOnline) {
                await this.goOnline();
            } else {
                await this.goOffline();
            }
        });
    }

    // Listen to availability changes (real-time sync)
    listenToAvailabilityChanges() {
        const driverDocRef = doc(this.db, "users", this.driverId);

        onSnapshot(driverDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const previouslyOnline = this.isOnline;
                this.isOnline = data.isAvailable || false;
                this.updateUI();

                // Start/Stop tracking based on remote status change
                if (this.isOnline && !previouslyOnline) {
                    if (this.locationBroadcaster) this.locationBroadcaster.startTracking();
                } else if (!this.isOnline && previouslyOnline) {
                    if (this.locationBroadcaster) this.locationBroadcaster.stopTracking();
                }
            }
        });
    }

    // Go online
    async goOnline() {
        try {
            // Check if driver can go online
            if (!this.driverDashboard.canGoOnline()) {
                alert('You must be verified before going online. Please complete verification process.');
                const toggleSwitch = document.getElementById('availabilityToggle');
                if (toggleSwitch) toggleSwitch.checked = false;
                return;
            }

            // Update Firestore
            await updateDoc(doc(this.db, "users", this.driverId), {
                isAvailable: true,
                lastOnlineAt: new Date()
            });

            this.isOnline = true;
            this.updateUI();

            // Start location broadcasting
            if (this.locationBroadcaster) {
                this.locationBroadcaster.startTracking();
            }

            console.log('✅ Driver is now ONLINE');
            this.showNotification('You are now online', 'You will start receiving ride requests', 'success');
        } catch (error) {
            console.error('Error going online:', error);
            alert('Error going online. Please try again.');
            const toggleSwitch = document.getElementById('availabilityToggle');
            if (toggleSwitch) toggleSwitch.checked = false;
        }
    }

    // Go offline
    async goOffline() {
        try {
            // Update Firestore
            await updateDoc(doc(this.db, "users", this.driverId), {
                isAvailable: false,
                lastOfflineAt: new Date()
            });

            this.isOnline = false;
            this.updateUI();

            // Stop location broadcasting
            if (this.locationBroadcaster) {
                this.locationBroadcaster.stopTracking();
            }

            console.log('⭕ Driver is now OFFLINE');
            this.showNotification('You are now offline', 'You will not receive ride requests', 'info');
        } catch (error) {
            console.error('Error going offline:', error);
            alert('Error going offline. Please try again.');
        }
    }

    // Update UI based on availability status
    updateUI() {
        const toggleSwitch = document.getElementById('availabilityToggle');
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');

        if (toggleSwitch) {
            toggleSwitch.checked = this.isOnline;
        }

        if (statusIndicator) {
            statusIndicator.style.background = this.isOnline ? '#2ED573' : '#94a3b8';
        }

        if (statusText) {
            statusText.textContent = this.isOnline ? "You're Online" : "You're Offline";
            statusText.style.color = this.isOnline ? '#2ED573' : '#64748B';
        }

        // Update ride requests visibility
        const rideRequestsPanel = document.getElementById('rideRequestsPanel');
        if (rideRequestsPanel) {
            if (this.isOnline) {
                rideRequestsPanel.style.display = 'block';
            } else {
                rideRequestsPanel.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: #64748B;">
                        <i class="fas fa-power-off" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <p>You're offline. Go online to receive ride requests.</p>
                    </div>
                `;
            }
        }
    }

    // Show notification
    showNotification(title, message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? '#E8F5E9' : '#E3F2FD'};
            color: ${type === 'success' ? '#1B5E20' : '#0D47A1'};
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;

        notification.innerHTML = `
            <div style="display: flex; align-items: start; gap: 10px;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}" style="font-size: 1.5rem;"></i>
                <div>
                    <strong style="display: block; margin-bottom: 0.3rem;">${title}</strong>
                    <p style="margin: 0; font-size: 0.9rem;">${message}</p>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Get current availability status
    getStatus() {
        return this.isOnline;
    }
}
