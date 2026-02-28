// Ride Booking System Module
// Handles ride booking, driver matching, OTP generation, and trip management

import { getFirestore, collection, addDoc, doc, updateDoc, getDoc, query, where, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

export class RideBookingSystem {
    constructor(app, userId, notificationSystem) {
        this.db = getFirestore(app);
        this.rtdb = getDatabase(app);
        this.userId = userId;
        this.notificationSystem = notificationSystem;
        this.currentRide = null;
        this.pickupLocation = null;
        this.dropLocation = null;
        this.pickupCoords = null;
        this.dropCoords = null;
        this.routeDistance = 0;
        this.routeDuration = 0;
        this.entryOTP = null;
        this.exitOTP = null;
    }

    // Initialize ride booking system
    async init() {
        this.setupLocationInputs();
        this.setupBookingButton();
        await this.loadUserData();
    }

    // Load user data to check verification status
    async loadUserData() {
        const userDocRef = doc(this.db, "users", this.userId);

        // Real-time updates
        onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                this.userData = docSnap.data();
                this.validateBookingButton();
            }
        });

        // Initial load
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            this.userData = userDoc.data();
            this.validateBookingButton();
        }
    }

    // Setup location inputs
    setupLocationInputs() {
        const pickupInput = document.getElementById('pickupInput');
        const dropInput = document.getElementById('dropInput');

        if (pickupInput) {
            pickupInput.addEventListener('change', async () => {
                await this.handlePickupChange(pickupInput.value);
            });
        }

        if (dropInput) {
            dropInput.addEventListener('change', async () => {
                await this.handleDropChange(dropInput.value);
            });
        }
    }

    // Handle pickup location change
    async handlePickupChange(location) {
        this.pickupLocation = location;
        // Geocoding will be handled by the map module
        this.validateBookingButton();
    }

    // Handle drop location change
    async handleDropChange(location) {
        this.dropLocation = location;
        // Geocoding will be handled by the map module
        this.validateBookingButton();
    }

    // Set pickup coordinates (called from map module)
    setPickupCoords(coords, locationName = 'Current Location') {
        this.pickupCoords = coords;
        if (!this.pickupLocation) this.pickupLocation = locationName;
        this.validateBookingButton();
        this.updateFareEstimate();
    }

    // Set drop coordinates (called from map module)
    setDropCoords(coords, locationName) {
        this.dropCoords = coords;
        if (locationName) this.dropLocation = locationName;
        this.validateBookingButton();
        this.updateFareEstimate();
    }

    // Set route details (called from map module)
    setRouteDetails(distance, duration) {
        this.routeDistance = distance;
        this.routeDuration = duration;
        this.updateFareEstimate();
    }

    // Validate booking button
    validateBookingButton() {
        const bookRideBtn = document.getElementById('bookRideBtn');
        const fareEstimate = document.getElementById('fareEstimate');
        if (bookRideBtn) {
            const isVerified = this.userData?.isVerified || false;
            const hasLocations = this.pickupLocation && this.dropLocation &&
                this.pickupCoords && this.dropCoords;

            if (!isVerified) {
                bookRideBtn.disabled = true;
                bookRideBtn.style.opacity = '0.5';
                bookRideBtn.style.cursor = 'not-allowed';
                bookRideBtn.innerHTML = '<i class="fas fa-lock"></i> Verification Required';
                if (fareEstimate && hasLocations) {
                    fareEstimate.innerHTML = '<span style="color: var(--danger); font-size: 0.85rem;"><i class="fas fa-exclamation-triangle"></i> Please verify your profile to book a ride.</span>';
                }
            } else if (hasLocations) {
                bookRideBtn.disabled = false;
                bookRideBtn.style.opacity = '1';
                bookRideBtn.style.cursor = 'pointer';
                bookRideBtn.textContent = 'Book Ride';
            } else {
                bookRideBtn.disabled = true;
                bookRideBtn.style.opacity = '0.5';
                bookRideBtn.style.cursor = 'not-allowed';
                bookRideBtn.textContent = 'Book Ride';
            }
        }
    }

    // Update fare estimate
    updateFareEstimate() {
        const fareEstimate = document.getElementById('fareEstimate');
        if (!fareEstimate) return;

        if (!this.pickupCoords || !this.dropCoords) {
            fareEstimate.textContent = 'Enter locations to see estimate';
            return;
        }

        // Calculate distance if not provided by route
        let distance = this.routeDistance;
        if (!distance && this.pickupCoords && this.dropCoords) {
            distance = this.calculateHaversineDistance(
                this.pickupCoords.lat, this.pickupCoords.lng,
                this.dropCoords.lat, this.dropCoords.lng
            );
        }

        // Calculate fare
        const fare = this.calculateFare(distance);

        fareEstimate.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>Estimated fare:</span>
                <strong style="font-size: 1.2rem; color: var(--accent);">$${fare.total.toFixed(2)}</strong>
            </div>
            <div style="font-size: 0.85rem; color: #64748B; margin-top: 0.5rem;">
                ${distance.toFixed(1)} km • ${this.isNightTime() ? 'Night surcharge applied' : 'Day rate'}
            </div>
        `;
    }

    // Calculate fare
    calculateFare(distanceKm) {
        const baseFare = 2.50;
        const perKmRate = 2.50;
        const nightSurchargePercent = 0.25; // 25%

        let fare = baseFare + (distanceKm * perKmRate);
        let nightSurcharge = 0;

        // Apply night surcharge (10 PM - 6 AM)
        if (this.isNightTime()) {
            nightSurcharge = fare * nightSurchargePercent;
            fare += nightSurcharge;
        }

        return {
            base: baseFare,
            distance: distanceKm * perKmRate,
            nightSurcharge: nightSurcharge,
            total: fare
        };
    }

    // Check if it's night time
    isNightTime() {
        const hour = new Date().getHours();
        return hour >= 22 || hour < 6;
    }

    // Calculate Haversine distance
    calculateHaversineDistance(lat1, lon1, lat2, lon2) {
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

    // Setup booking button
    setupBookingButton() {
        const bookRideBtn = document.getElementById('bookRideBtn');
        if (bookRideBtn) {
            bookRideBtn.addEventListener('click', () => this.bookRide());
        }

        const startTripBtn = document.getElementById('startTripBtn');
        if (startTripBtn) {
            startTripBtn.addEventListener('click', () => this.startTrip());
        }

        const endTripBtn = document.getElementById('endTripBtn');
        if (endTripBtn) {
            endTripBtn.addEventListener('click', () => this.endTrip());
        }
    }

    // Book ride
    async bookRide() {
        if (!this.pickupCoords || !this.dropCoords) {
            alert('Please select both pickup and drop locations');
            return;
        }

        // Check for existing active rides (Prevent Duplicates)
        try {
            console.log(`🔍 Checking for active rides for user: ${this.userId}`);
            const ridesRef = collection(this.db, "rides");
            const q = query(
                ridesRef,
                where("riderId", "==", this.userId),
                where("status", "in", ["searching", "driver_assigned", "in_progress"])
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const existingRide = snapshot.docs[0].data();
                const existingRideId = snapshot.docs[0].id;
                console.warn("⚠️ Found existing active ride:", existingRideId, existingRide);

                // If ride is just "searching", allow user to cancel it easily
                if (existingRide.status === 'searching') {
                    const action = prompt(
                        `You have an active ride request searching for drivers.\n\nRide: ${existingRide.pickupLocation} -> ${existingRide.dropLocation}\n\nType "cancel" to delete it and start new, or "view" to see it.`
                    );

                    if (action && action.toLowerCase() === 'cancel') {
                        await updateDoc(doc(this.db, "rides", existingRideId), { status: 'cancelled' });
                        alert("Previous request cancelled. Please click Book again.");
                        return; // User has to click book again, but at least it's unblocked
                    } else if (action && action.toLowerCase() === 'view') {
                        // Resume searching state
                        this.currentRide = { id: existingRideId, ...existingRide };
                        this.showState('state-searching-driver');
                        this.listenForInterestedDrivers();
                        return;
                    } else {
                        return; // Do nothing
                    }
                }

                const proceed = confirm(
                    `Active Ride Found!\n\nRide ID: ${existingRideId}\nStatus: ${existingRide.status}\n\nDo you want to continue this ride?`
                );

                if (proceed) {
                    window.location.href = `live-trip.html?rideId=${existingRideId}`;
                } else {
                    // Optional: Allow force cancel via console or UI in future
                    console.log("User chose not to continue active ride.");
                }
                return;
            } else {
                console.log("✅ No active rides found. Proceeding.");
            }
        } catch (error) {
            console.error("Error checking for duplicate rides:", error);
            // Decide whether to block or allow based on error (safe to block usually)
        }

        try {
            // Show searching state
            this.showState('state-searching-driver');

            // Calculate fare
            const distance = this.routeDistance || this.calculateHaversineDistance(
                this.pickupCoords.lat, this.pickupCoords.lng,
                this.dropCoords.lat, this.dropCoords.lng
            );
            const fareDetails = this.calculateFare(distance);

            // Create ride document
            const rideData = {
                riderId: this.userId,
                pickupLocation: this.pickupLocation,
                dropLocation: this.dropLocation,
                pickupCoords: this.pickupCoords,
                dropCoords: this.dropCoords,
                distance: distance,
                fare: fareDetails,
                status: 'searching',
                createdAt: new Date(),
                isNightRide: this.isNightTime()
            };

            const rideRef = await addDoc(collection(this.db, "rides"), rideData);
            this.currentRide = { id: rideRef.id, ...rideData };

            // Find and assign driver - REMOVED for Selection Flow
            // await this.findDriver();

            // Listen for interested drivers
            this.listenForInterestedDrivers();

        } catch (error) {
            console.error('Error booking ride:', error);
            alert('Error booking ride. Please try again.');
            this.showState('state-before-booking');
        }
    }

    // Listen for interested drivers (Real-time)
    listenForInterestedDrivers() {
        const waitingContainer = document.querySelector('#state-searching-driver .searching-content'); // Assuming this exists or I will target the container
        // I should probably clear the container first or ensure it has a specific ID for the list

        // Let's modify the UI for state-searching-driver dynamically
        const stateContainer = document.getElementById('state-searching-driver');
        stateContainer.innerHTML = `
            <div style="text-align: center;">
                <div class="loader" style="margin: 0 auto 1rem;"></div>
                <h3>Contacting Drivers...</h3>
                <p>Waiting for drivers to accept your request</p>
                <div id="interestedDriversList" style="
                    margin-top: 1.5rem;
                    text-align: left;
                    max-height: 300px;
                    overflow-y: auto;
                "></div>
                <button id="cancelRequestBtn" style="
                    margin-top: 1rem;
                    padding: 0.8rem 1.5rem;
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    width: 100%;
                ">Cancel Request</button>
            </div>
        `;

        document.getElementById('cancelRequestBtn').addEventListener('click', () => this.cancelRide());

        // Snapshot listener
        this.rideUnsubscribe = onSnapshot(doc(this.db, "rides", this.currentRide.id), (docSnapshot) => {
            const data = docSnapshot.data();
            if (!data) return;

            // Check if trip handled elsewhere (e.g. cancelled)
            if (data.status === 'cancelled') {
                alert('Ride request was cancelled.');
                this.resetBooking();
                return;
            }

            // Check for interested drivers
            if (data.interestedDrivers && data.interestedDrivers.length > 0) {
                this.updateDriverListUI(data.interestedDrivers);
            }
        });
    }

    updateDriverListUI(drivers) {
        const listContainer = document.getElementById('interestedDriversList');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        drivers.forEach(driver => {
            const card = document.createElement('div');
            card.style.cssText = `
                background: white;
                padding: 1rem;
                border-radius: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                margin-bottom: 0.8rem;
                border: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;

            card.innerHTML = `
                <div>
                    <strong style="display: block; font-size: 1rem; color: #1e293b;">${driver.name}</strong>
                    <div style="font-size: 0.85rem; color: #64748B;">
                        <span>⭐ ${driver.rating}</span> • 
                        <span>${driver.vehicle.make} ${driver.vehicle.model}</span>
                    </div>
                </div>
                <button class="select-driver-btn" style="
                    background: var(--accent);
                    color: white;
                    border: none;
                    padding: 0.6rem 1rem;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                ">Select</button>
            `;

            card.querySelector('.select-driver-btn').addEventListener('click', () => this.selectDriver(driver));
            listContainer.appendChild(card);
        });

        // Update header test to show count
        const header = document.querySelector('#state-searching-driver h3');
        if (header) header.textContent = `${drivers.length} Driver${drivers.length > 1 ? 's' : ''} Interested`;
    }

    async cancelRide() {
        if (!this.currentRide) return;
        try {
            await updateDoc(doc(this.db, "rides", this.currentRide.id), {
                status: 'cancelled'
            });
            if (this.rideUnsubscribe) this.rideUnsubscribe();
            this.resetBooking();
        } catch (error) {
            console.error("Error cancelling ride:", error);
        }
    }

    // Select a driver (User Action)
    async selectDriver(driver) {
        try {
            if (this.rideUnsubscribe) this.rideUnsubscribe();

            // Generate entry OTP
            this.entryOTP = this.generateOTP();

            // Update ride document
            await updateDoc(doc(this.db, "rides", this.currentRide.id), {
                driverId: driver.driverId,
                driverName: driver.name,
                driverPhone: driver.phone,
                driverVehicle: driver.vehicle || {},
                driverRating: driver.rating || 4.5,
                entryOTP: this.entryOTP,
                status: 'driver_assigned',
                assignedAt: new Date()
            });

            // Update current ride object
            this.currentRide.driverId = driver.driverId;
            this.currentRide.driverName = driver.name;
            this.currentRide.driverRating = driver.rating;
            this.currentRide.driverVehicle = driver.vehicle;

            // Show driver assigned state
            this.showDriverAssigned({
                firstName: driver.name.split(' ')[0],
                lastName: driver.name.split(' ')[1] || '',
                rating: driver.rating,
                vehicle: driver.vehicle,
                distanceToPickup: driver.distanceToPickup || 5 // fallback
            });

            // Send notification
            if (this.notificationSystem) {
                await this.notificationSystem.sendNotification(
                    'driver_assigned',
                    'Driver Confirmed!',
                    `${driver.name} is on the way to pick you up.`
                );
            }

            // Redirect will happen via the same logic as before or explicitly here
            setTimeout(() => {
                window.location.href = `live-trip.html?rideId=${this.currentRide.id}`;
            }, 1000);

        } catch (error) {
            console.error('Error selecting driver:', error);
            alert('Error selecting driver. Please try again.');
        }
    }

    // Show driver assigned state
    showDriverAssigned(driver) {
        this.showState('state-driver-assigned');

        // Update driver info
        const driverInfo = document.querySelector('#state-driver-assigned .driver-info');
        if (driverInfo) {
            const eta = Math.ceil(driver.distanceToPickup * 3); // Rough estimate: 3 min per km
            driverInfo.innerHTML = `
                <h4>${driver.firstName} ${driver.lastName.charAt(0)}. (⭐ ${(driver.rating || 4.5).toFixed(1)})</h4>
                <p>${driver.vehicle?.make || 'Vehicle'} ${driver.vehicle?.model || ''} • ${driver.vehicle?.licensePlate || 'ABC 123'}</p>
                <p>Arriving in ${eta} mins</p>
            `;
        }

        // Update entry OTP
        const entryOtpElement = document.getElementById('entryOtp');
        if (entryOtpElement) {
            entryOtpElement.textContent = this.entryOTP;
        }
    }

    // Generate OTP
    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Start trip
    async startTrip() {
        try {
            // Generate exit OTP
            this.exitOTP = this.generateOTP();

            // Update ride document
            await updateDoc(doc(this.db, "rides", this.currentRide.id), {
                exitOTP: this.exitOTP,
                status: 'in_progress',
                startedAt: new Date()
            });

            // Show trip active state
            this.showState('state-trip-active');

            // Update exit OTP
            const exitOtpElement = document.getElementById('exitOtp');
            if (exitOtpElement) {
                exitOtpElement.textContent = this.exitOTP;
            }

            // Send notification
            if (this.notificationSystem) {
                await this.notificationSystem.sendNotification(
                    'trip_started',
                    'Trip Started',
                    'Your trip is now in progress. Have a safe journey!'
                );
            }

            // Return trip started event for safety system
            return { started: true, isNightRide: this.currentRide.isNightRide };

        } catch (error) {
            console.error('Error starting trip:', error);
            alert('Error starting trip. Please try again.');
        }
    }

    // End trip
    async endTrip() {
        try {
            // Update ride document
            await updateDoc(doc(this.db, "rides", this.currentRide.id), {
                status: 'completed',
                completedAt: new Date()
            });

            // Send notification
            if (this.notificationSystem) {
                await this.notificationSystem.sendNotification(
                    'trip_completed',
                    'Trip Completed',
                    'Your trip has been completed successfully. Please rate your driver.'
                );
            }

            // Show rating modal
            this.showRatingModal();

            // Reset to initial state
            setTimeout(() => {
                this.resetBooking();
            }, 1000);

            // Return trip ended event for safety system
            return { ended: true };

        } catch (error) {
            console.error('Error ending trip:', error);
            alert('Error ending trip. Please try again.');
        }
    }

    // Show rating modal
    showRatingModal() {
        const overlay = document.createElement('div');
        overlay.id = 'ratingModal';
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
            width: 90%;
        `;

        modal.innerHTML = `
            <h2 style="color: var(--primary); margin-bottom: 1rem;">Rate Your Driver</h2>
            <p style="color: #64748B; margin-bottom: 1.5rem;">How was your experience with ${this.currentRide?.driverName || 'your driver'}?</p>
            <div id="starRating" style="font-size: 2.5rem; margin-bottom: 1.5rem; cursor: pointer;">
                <i class="far fa-star" data-rating="1"></i>
                <i class="far fa-star" data-rating="2"></i>
                <i class="far fa-star" data-rating="3"></i>
                <i class="far fa-star" data-rating="4"></i>
                <i class="far fa-star" data-rating="5"></i>
            </div>
            <textarea id="feedbackText" placeholder="Optional feedback..." style="
                width: 100%;
                padding: 0.8rem;
                border: 2px solid #e2e8f0;
                border-radius: 12px;
                resize: vertical;
                min-height: 80px;
                margin-bottom: 1rem;
            "></textarea>
            <button id="submitRating" style="
                width: 100%;
                padding: 1rem;
                background: var(--accent);
                color: white;
                border: none;
                border-radius: 12px;
                font-weight: 600;
                cursor: pointer;
                margin-bottom: 0.5rem;
            ">Submit Rating</button>
            <button id="skipRating" style="
                width: 100%;
                padding: 0.8rem;
                background: transparent;
                color: #64748B;
                border: none;
                cursor: pointer;
            ">Skip for now</button>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Setup star rating
        let selectedRating = 0;
        const stars = modal.querySelectorAll('#starRating i');
        stars.forEach(star => {
            star.addEventListener('click', () => {
                selectedRating = parseInt(star.dataset.rating);
                stars.forEach((s, index) => {
                    if (index < selectedRating) {
                        s.classList.remove('far');
                        s.classList.add('fas');
                        s.style.color = '#FFD700';
                    } else {
                        s.classList.remove('fas');
                        s.classList.add('far');
                        s.style.color = '#94a3b8';
                    }
                });
            });
        });

        // Submit rating
        document.getElementById('submitRating').addEventListener('click', async () => {
            if (selectedRating === 0) {
                alert('Please select a rating');
                return;
            }

            const feedback = document.getElementById('feedbackText').value;
            await this.submitRating(selectedRating, feedback);
            overlay.remove();
        });

        // Skip rating
        document.getElementById('skipRating').addEventListener('click', () => {
            overlay.remove();
        });
    }

    // Submit rating
    async submitRating(rating, feedback) {
        try {
            // Update ride document with rating
            await updateDoc(doc(this.db, "rides", this.currentRide.id), {
                rating: rating,
                feedback: feedback,
                ratedAt: new Date()
            });

            // Update driver's average rating
            // In a real app, this would be done via Cloud Function
            console.log(`Rating submitted: ${rating} stars`);

        } catch (error) {
            console.error('Error submitting rating:', error);
        }
    }

    // Reset booking
    resetBooking() {
        this.showState('state-before-booking');
        this.currentRide = null;
        this.pickupLocation = null;
        this.dropLocation = null;
        this.pickupCoords = null;
        this.dropCoords = null;
        this.entryOTP = null;
        this.exitOTP = null;

        // Clear inputs
        const pickupInput = document.getElementById('pickupInput');
        const dropInput = document.getElementById('dropInput');
        if (pickupInput) pickupInput.value = '';
        if (dropInput) dropInput.value = '';

        // Reset fare estimate
        const fareEstimate = document.getElementById('fareEstimate');
        if (fareEstimate) {
            fareEstimate.textContent = 'Enter locations to see estimate';
        }
    }

    // Show specific state
    showState(stateId) {
        const states = document.querySelectorAll('.ride-state');
        states.forEach(state => state.classList.remove('active'));

        const targetState = document.getElementById(stateId);
        if (targetState) {
            targetState.classList.add('active');
        }
    }

    // Get current ride
    getCurrentRide() {
        return this.currentRide;
    }
}
