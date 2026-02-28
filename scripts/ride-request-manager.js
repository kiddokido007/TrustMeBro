// Ride Request Manager Module
// Handles incoming ride requests, accept/reject functionality, and OTP verification

import { getFirestore, collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc, addDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

export class RideRequestManager {
    constructor(app, driverId, dashboard) {
        this.db = getFirestore(app);
        this.driverId = driverId;
        this.dashboard = dashboard;
        this.activeRequests = [];
        this.currentRide = null;
        this.unsubscribe = null;
    }

    // Helper to get latest driver data
    get driverData() {
        return this.dashboard ? this.dashboard.getDriverData() : null;
    }

    // Initialize ride request manager
    init() {
        this.listenForRideRequests();
    }

    // Listen for incoming ride requests
    listenForRideRequests() {
        const ridesRef = collection(this.db, "rides");
        const q = query(
            ridesRef,
            where("status", "==", "searching"),
            orderBy("createdAt", "desc")
        );

        this.unsubscribe = onSnapshot(q, (snapshot) => {
            this.activeRequests = [];

            snapshot.forEach((doc) => {
                const rideData = {
                    id: doc.id,
                    ...doc.data()
                };

                // Calculate distance to pickup
                const driverData = this.driverData;
                if (driverData && driverData.currentLocation && rideData.pickupCoords) {
                    rideData.distanceToPickup = this.calculateDistance(
                        driverData.currentLocation.latitude,
                        driverData.currentLocation.longitude,
                        rideData.pickupCoords.lat,
                        rideData.pickupCoords.lng
                    );

                    // Debugging: increased radius to 5000km to ensure visibility during testing
                    console.log(`📏 Distance to request ${rideData.id}: ${rideData.distanceToPickup.toFixed(2)} km`);
                    if (rideData.distanceToPickup <= 5000) {
                        this.activeRequests.push(rideData);
                    }
                } else {
                    console.warn(`⚠️ Filter skipped for ${rideData.id}: Missing location data`, {
                        driverLoc: driverData?.currentLocation,
                        pickupCoords: rideData.pickupCoords
                    });
                    // Fallback for debugging: Show anyway if location missing
                    this.activeRequests.push(rideData);
                }
            });

            // Sort by distance (nearest first)
            this.activeRequests.sort((a, b) => a.distanceToPickup - b.distanceToPickup);

            this.updateRequestsUI();
        }, (error) => {
            console.error("Error listening to ride requests:", error);
        });
    }

    // Calculate distance using Haversine formula
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Update ride requests UI
    updateRequestsUI() {
        const requestsContainer = document.getElementById('rideRequestsContainer');
        if (!requestsContainer) return;

        if (this.activeRequests.length === 0) {
            requestsContainer.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #64748B;">
                    <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p>No ride requests nearby</p>
                    <p style="font-size: 0.85rem;">Requests will appear here when riders book</p>
                </div>
            `;
            return;
        }

        requestsContainer.innerHTML = '';

        this.activeRequests.forEach(request => {
            const requestCard = this.createRequestCard(request);
            requestsContainer.appendChild(requestCard);
        });
    }

    // Create ride request card
    createRequestCard(request) {
        const card = document.createElement('div');
        card.className = 'ride-request-card';
        card.setAttribute('data-ride-id', request.id);
        card.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 1.2rem;
            margin-bottom: 1rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-left: 4px solid var(--accent);
            animation: slideIn 0.3s ease;
        `;

        const timeAgo = this.getTimeAgo(request.createdAt);
        const fare = request.fare?.total || 0;

        // Check if driver already expressed interest
        const isInterested = request.interestedDrivers &&
            request.interestedDrivers.some(d => d.driverId === this.driverId);

        let actionButtons = '';
        if (isInterested) {
            actionButtons = `
                <div style="text-align: center; width: 100%;">
                    <div style="
                        background: #ecfdf5; 
                        color: #059669; 
                        padding: 0.5rem; 
                        border-radius: 6px; 
                        margin-bottom: 0.5rem; 
                        font-weight: 600; 
                        font-size: 0.9rem;
                    ">
                        <i class="fas fa-check-circle"></i> Interest Sent
                    </div>
                    <button class="revoke-btn" data-ride-id="${request.id}" style="
                        width: 100%;
                        padding: 0.8rem;
                        background: white;
                        color: #ef4444;
                        border: 1px solid #ef4444;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                    ">
                        Revoke Interest
                    </button>
                    <div style="font-size: 0.8rem; color: #64748B; margin-top: 0.5rem;">
                        Waiting for rider to select you...
                    </div>
                </div>
            `;
        } else {
            actionButtons = `
                <div style="display: flex; gap: 0.8rem;">
                    <button class="accept-btn" data-ride-id="${request.id}" style="
                        flex: 1;
                        padding: 0.8rem;
                        background: var(--accent);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                    ">
                        <i class="fas fa-check"></i> Accept
                    </button>
                    <button class="reject-btn" data-ride-id="${request.id}" style="
                        flex: 1;
                        padding: 0.8rem;
                        background: #f1f5f9;
                        color: #64748B;
                        border: none;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                    ">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            `;
        }

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <div style="font-size: 0.85rem; color: #64748B; margin-bottom: 0.3rem;">
                        <i class="fas fa-clock"></i> ${timeAgo}
                    </div>
                    <div style="font-size: 0.9rem; color: #64748B;">
                        <i class="fas fa-route"></i> ${request.distanceToPickup.toFixed(1)} km away
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.3rem; font-weight: 700; color: var(--accent);">
                        $${fare.toFixed(2)}
                    </div>
                    <div style="font-size: 0.75rem; color: #64748B;">
                        ${request.distance?.toFixed(1) || '0'} km trip
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 1rem;">
                <div style="display: flex; align-items: start; gap: 8px; margin-bottom: 0.5rem;">
                    <i class="fas fa-location-dot" style="color: var(--primary); margin-top: 3px;"></i>
                    <div>
                        <div style="font-size: 0.75rem; color: #64748B;">Pickup</div>
                        <div style="font-size: 0.9rem; font-weight: 500;">${request.pickupLocation}</div>
                    </div>
                </div>
                <div style="display: flex; align-items: start; gap: 8px;">
                    <i class="fas fa-flag-checkered" style="color: var(--accent); margin-top: 3px;"></i>
                    <div>
                        <div style="font-size: 0.75rem; color: #64748B;">Drop</div>
                        <div style="font-size: 0.9rem; font-weight: 500;">${request.dropLocation}</div>
                    </div>
                </div>
            </div>

            ${actionButtons}
        `;

        // Add event listeners
        if (isInterested) {
            const revokeBtn = card.querySelector('.revoke-btn');
            if (revokeBtn) revokeBtn.addEventListener('click', () => this.revokeInterest(request.id));

            // If interested, ensure we are listening for selection
            this.listenForSelection(request.id);
        } else {
            const acceptBtn = card.querySelector('.accept-btn');
            const rejectBtn = card.querySelector('.reject-btn');

            if (acceptBtn) acceptBtn.addEventListener('click', () => this.acceptRide(request.id));
            if (rejectBtn) rejectBtn.addEventListener('click', () => this.rejectRide(request.id));
        }

        return card;
    }

    async revokeInterest(rideId) {
        try {
            // We need to fetch the doc to filter out our driver info object
            // arrayRemove requires exact object match, which is brittle if offeredAt changed

            const rideDocRef = doc(this.db, "rides", rideId);
            const snapshot = await getDoc(rideDocRef);

            if (snapshot.exists()) {
                const data = snapshot.data();
                const interestedDrivers = data.interestedDrivers || [];

                // Filter out this driver
                const updatedDrivers = interestedDrivers.filter(d => d.driverId !== this.driverId);

                await updateDoc(rideDocRef, {
                    interestedDrivers: updatedDrivers
                });

                console.log('✅ Revoked interest in ride:', rideId);
                this.showNotification('Interest Revoked', 'You removed your bid.', 'info');
            }
        } catch (error) {
            console.error('Error revoking interest:', error);
            alert('Error revoking interest.');
        }
    }

    // Get time ago string
    getTimeAgo(timestamp) {
        if (!timestamp) return 'Just now';

        const now = new Date();
        const requestTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diffMs = now - requestTime;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        return `${Math.floor(diffMins / 60)} hour${Math.floor(diffMins / 60) > 1 ? 's' : ''} ago`;
    }

    // Express Interest (Bid) on ride
    async acceptRide(rideId) {
        // Prevent duplicate acceptance if already committed
        try {
            const ridesRef = collection(this.db, "rides");
            const q = query(
                ridesRef,
                where("driverId", "==", this.driverId),
                where("status", "in", ["driver_assigned", "in_progress"])
            );
            const snapshot = await import("https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js").then(mod => mod.getDocs(q));

            if (!snapshot.empty) {
                alert("You already have an active ride. Please complete it first.");
                return;
            }
        } catch (error) {
            console.error("Error checking for active driver rides:", error);
        }

        try {
            const { arrayUnion } = await import("https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js");

            const driverData = this.driverData || {};
            const driverInfo = {
                driverId: this.driverId,
                name: `${driverData.firstName || 'Driver'} ${driverData.lastName || ''}`.trim(),
                phone: driverData.phone || 'N/A',
                vehicle: driverData.vehicle || { make: 'Vehicle', model: '', licensePlate: 'N/A' },
                rating: driverData.rating || 4.5,
                distanceToPickup: this.activeRequests.find(r => r.id === rideId)?.distanceToPickup || 0,
                offeredAt: new Date()
            };

            // Add to interestedDrivers array
            await updateDoc(doc(this.db, "rides", rideId), {
                interestedDrivers: arrayUnion(driverInfo)
            });

            console.log('✅ Expressed interest in ride:', rideId);

            // Show waiting notification
            this.showNotification('Interest Sent!', 'Waiting for rider to select you...', 'success');

            // UI Update: Disable button/Show waiting state
            const btn = document.querySelector(`button[data-ride-id="${rideId}"].accept-btn`);
            if (btn) {
                btn.disabled = true;
                btn.textContent = "Waiting...";
                btn.style.background = "#94a3b8";
            }

            // Start listening for rider selection
            this.listenForSelection(rideId);

        } catch (error) {
            console.error('Error expressing interest:', error);
            alert('Error processing request. Please try again.');
        }
    }

    listenForSelection(rideId) {
        const unsub = onSnapshot(doc(this.db, "rides", rideId), (doc) => {
            const data = doc.data();
            if (data && data.status === 'driver_assigned') {
                if (data.driverId === this.driverId) {
                    // Selected!
                    this.showNotification('You were selected!', 'Starting trip...', 'success');
                    setTimeout(() => {
                        window.location.href = `live-trip.html?rideId=${rideId}`;
                    }, 1000);
                } else {
                    // Not selected
                    this.showNotification('Ride taken', 'Rider selected another driver.', 'info');
                    // Remove from list
                    this.activeRequests = this.activeRequests.filter(r => r.id !== rideId);
                    this.updateRequestsUI();
                }
                unsub(); // Stop listening
            }
        });
    }

    // Reject ride request
    async rejectRide(rideId) {
        try {
            // Just remove from UI (ride stays in searching status for other drivers)
            this.activeRequests = this.activeRequests.filter(r => r.id !== rideId);
            this.updateRequestsUI();

            console.log('⛔ Ride rejected:', rideId);

            // Optional: Log rejection for analytics
            await addDoc(collection(this.db, "ride_rejections"), {
                rideId: rideId,
                driverId: this.driverId,
                rejectedAt: new Date()
            });
        } catch (error) {
            console.error('Error rejecting ride:', error);
        }
    }

    // Show notification
    showNotification(title, message, type) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? '#E8F5E9' : '#FFEBEE'};
            color: ${type === 'success' ? '#1B5E20' : '#C62828'};
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;

        notification.innerHTML = `
            <div style="display: flex; align-items: start; gap: 10px;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}" style="font-size: 1.5rem;"></i>
                <div>
                    <strong style="display: block; margin-bottom: 0.3rem;">${title}</strong>
                    <p style="margin: 0; font-size: 0.9rem;">${message}</p>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Get current ride
    getCurrentRide() {
        return this.currentRide;
    }

    // Cleanup
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}
