import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);

class LiveTripManager {
    constructor() {
        this.rideId = new URLSearchParams(window.location.search).get('rideId');
        this.user = null;
        this.role = null; // 'rider' or 'driver'
        this.rideData = null;
        this.map = null;
        this.driverMarker = null;
        this.routeControl = null;
        this.isNightMode = false;

        // Safety Monitoring
        this.lastMovementTime = Date.now();
        this.locationHistory = [];
        this.stationaryThreshold = 3 * 60 * 1000; // 3 minutes
    }

    async init() {
        if (!this.rideId) {
            alert("No trip ID found!");
            window.location.href = '../index.html';
            return;
        }

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.user = user;
                await this.determineRole();

                // Initialize Safety System
                this.safetySystem = new SafetySystem(app, user.uid, {
                    sendNotification: (type, title, msg) => this.showNotification(msg, type === 'sos_triggered' ? 'error' : 'warning')
                });
                this.safetySystem.init();

                this.initializeMap();
                this.setupRideListener();
                this.setupSafetyFeatures();
            } else {
                window.location.href = '../public/auth.html';
            }
        });

        this.setupUIListeners();
    }

    async determineRole() {
        const docRef = doc(db, "users", this.user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            this.role = docSnap.data().role;
            console.log(`👤 User Verified: ${this.role}`);
        }
    }

    initializeMap() {
        this.map = L.map('live-map', { zoomControl: false }).setView([20.5937, 78.9629], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
    }

    setupRideListener() {
        onSnapshot(doc(db, "rides", this.rideId), (doc) => {
            if (doc.exists()) {
                this.rideData = doc.data();
                this.updateUI(this.rideData);
                this.handleMapUpdates(this.rideData);
            }
        });
    }

    updateUI(data) {
        // 1. Status Banner
        this.updateStatusBanner(data.status);

        // 2. Info Panel
        const isRider = this.role === 'rider';
        const otherName = isRider ? data.driverName : data.riderName;
        const otherRating = isRider ? data.driverRating : 5.0; // Mock rider rating

        document.getElementById('other-user-name').textContent = otherName;
        document.getElementById('other-user-rating').textContent = (otherRating || 4.5).toFixed(1);
        document.getElementById('vehicle-info').textContent = isRider
            ? `${data.driverVehicle?.model || 'Car'} • ${data.driverVehicle?.licensePlate || ''}`
            : 'Premium Rider';

        document.getElementById('pickup-address').textContent = data.pickupLocation;
        document.getElementById('drop-address').textContent = data.dropLocation;

        // 3. OTP Logic
        this.handleOTPUI(data);

        // 4. Night Mode
        if (data.isNightRide) {
            this.isNightMode = true;
            document.getElementById('night-safety-badge').style.display = 'flex';
        }

        // 5. Trip Completed
        if (data.status === 'completed' || data.status === 'stopped') {
            this.showTripSummary(data);
        }

        // 6. Stop Ride Button (Mid-trip)
        const actionsContainer = document.getElementById('trip-actions');
        if (data.status === 'in_progress' && actionsContainer) {
            actionsContainer.innerHTML = `
                <button id="stop-ride-btn" class="secondary-btn" style="
                    background: #f1f5f9; 
                    color: #ef4444; 
                    border: 1px solid #ef4444; 
                    margin-top: 1rem; 
                    width: 100%;
                ">
                    <i class="fas fa-stop-circle"></i> Stop Ride
                </button>
            `;
            document.getElementById('stop-ride-btn').addEventListener('click', () => this.confirmStopRide());
        } else if (actionsContainer) {
            actionsContainer.innerHTML = '';
        }
    }

    async confirmStopRide() {
        if (confirm("Are you sure you want to stop the ride immediately?")) {
            await updateDoc(doc(db, "rides", this.rideId), {
                status: 'stopped',
                completedAt: new Date(),
                endedBy: this.user.uid,
                endedMethod: 'forced_stop'
            });
        }
    }

    updateStatusBanner(status) {
        const banner = document.getElementById('trip-status-banner');
        const icon = document.getElementById('status-icon');
        const text = document.getElementById('status-text');

        banner.className = 'status-banner'; // Reset

        switch (status) {
            case 'driver_assigned':
                banner.classList.add('status-on-way');
                icon.className = 'fas fa-car-side';
                text.textContent = this.role === 'rider' ? 'Driver is on the way' : 'Go to Pickup Location';
                break;
            case 'in_progress':
                banner.classList.add('status-in-trip');
                icon.className = 'fas fa-route';
                text.textContent = 'Trip in Progress';
                break;
            case 'completed':
                banner.classList.add('status-completed');
                icon.className = 'fas fa-flag-checkered';
                text.textContent = 'Arrived at Destination';
                break;
            default:
                banner.classList.add('status-searching');
                text.textContent = 'Connecting...';
        }
    }

    handleOTPUI(data) {
        const otpDisplayContainer = document.getElementById('otp-display-container');
        const otpInputContainer = document.getElementById('otp-input-container');
        const otpDisplay = document.getElementById('otp-display');

        // Reset
        otpDisplayContainer.style.display = 'none';
        otpInputContainer.style.display = 'none';

        if (data.status === 'driver_assigned') {
            // Entry OTP Phase
            if (this.role === 'rider') {
                otpDisplayContainer.style.display = 'block';
                document.querySelector('#otp-display-container .otp-label').textContent = "Share this OTP with Driver";
                otpDisplay.textContent = data.entryOTP;
            } else {
                otpInputContainer.style.display = 'block';
                document.querySelector('#otp-input-container .otp-label').textContent = "Enter Rider's Entry OTP";
                this.currentOTPTarget = data.entryOTP;
                this.otpType = 'entry';
            }
        } else if (data.status === 'in_progress') {
            // Exit OTP Phase
            if (this.role === 'rider') {
                otpDisplayContainer.style.display = 'block';
                document.querySelector('#otp-display-container .otp-label').textContent = "Share this OTP to End Trip";
                otpDisplay.textContent = data.exitOTP;
            } else {
                otpInputContainer.style.display = 'block';
                document.querySelector('#otp-input-container .otp-label').textContent = "Enter Rider's Exit OTP";
                this.currentOTPTarget = data.exitOTP;
                this.otpType = 'exit';
            }
        }
    }

    handleMapUpdates(data) {
        // Draw route if not exists
        if (!this.routeControl && data.pickupCoords && data.dropCoords) {
            this.routeControl = L.Routing.control({
                waypoints: [
                    L.latLng(data.pickupCoords.lat, data.pickupCoords.lng),
                    L.latLng(data.dropCoords.lat, data.dropCoords.lng)
                ],
                routeWhileDragging: false,
                show: false,
                addWaypoints: false,
                createMarker: () => null,
                lineOptions: { styles: [{ color: '#3B82F6', weight: 6 }] }
            }).addTo(this.map);
        }

        // Track Driver
        if (data.driverId) {
            const driverLocRef = ref(rtdb, `driver_locations/${data.driverId}`);
            onValue(driverLocRef, (snapshot) => {
                const loc = snapshot.val();
                if (loc) {
                    const latLng = [loc.latitude, loc.longitude];
                    if (this.driverMarker) {
                        this.driverMarker.setLatLng(latLng);
                    } else {
                        const iconHtml = `<div style="font-size: 24px; color: #3B82F6; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));"><i class="fas fa-car-side"></i></div>`;
                        this.driverMarker = L.marker(latLng, {
                            icon: L.divIcon({ html: iconHtml, className: 'driver-icon', iconSize: [30, 30] })
                        }).addTo(this.map);
                    }

                    // Center map on driver if needed
                    // this.map.panTo(latLng);

                    // Safety Check: Movement
                    this.monitorMovement(loc);
                }
            });
        }
    }

    setupUIListeners() {
        // OTP Inputs
        const inputs = document.querySelectorAll('.otp-digit');
        inputs.forEach((input, index) => {
            input.addEventListener('keyup', (e) => {
                if (e.key >= 0 && e.key <= 9) {
                    if (index < inputs.length - 1) inputs[index + 1].focus();
                } else if (e.key === 'Backspace') {
                    if (index > 0) inputs[index - 1].focus();
                }
            });
        });

        document.getElementById('verify-otp-btn').addEventListener('click', () => this.verifyOTP());
        document.getElementById('sos-button').addEventListener('click', () => this.triggerSOS());
        document.getElementById('cancel-sos-btn').addEventListener('click', () => this.cancelSOS());

        // Feedback
        document.getElementById('submit-feedback-btn').addEventListener('click', async () => {
            const feedback = document.getElementById('feedback-text').value;
            // Save logic here
            alert("Thank you for your feedback!");
            window.location.href = this.role === 'driver' ? 'driver-dashboard-v2.html' : 'rider-dashboard-v2.html';
        });
    }

    verifyOTP() {
        const inputs = document.querySelectorAll('.otp-digit');
        const enteredOTP = Array.from(inputs).map(i => i.value).join('');

        if (enteredOTP === this.currentOTPTarget) {
            if (this.otpType === 'entry') {
                this.startTrip();
            } else {
                this.endTrip();
            }
        } else {
            alert("Incorrect OTP! Please check with the rider.");
            inputs.forEach(i => i.value = '');
            inputs[0].focus();
        }
    }

    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    async startTrip() {
        const exitOTP = this.generateOTP();
        await updateDoc(doc(db, "rides", this.rideId), {
            status: 'in_progress',
            startedAt: new Date(),
            exitOTP: exitOTP
        });
        alert("Trip Started!");
    }

    async endTrip() {
        await updateDoc(doc(db, "rides", this.rideId), {
            status: 'completed',
            completedAt: new Date()
        });
    }

    monitorMovement(loc) {
        if (this.role === 'driver') return; // Monitoring mainly for rider/admin

        const speed = loc.speed || 0;

        if (speed < 0.5) { // Stationary threshold
            const timeStationary = Date.now() - this.lastMovementTime;

            if (timeStationary > this.stationaryThreshold) {
                // Trigger Safety Check from SafetySystem
                if (!this.safetySystem.safetyCheckTimeout && !document.getElementById('safetyCheckModal')) {
                    this.showNotification("Safety Warning: Vehicle stationary. Initiating safety check...", "warning");
                    this.safetySystem.performSafetyCheck();
                }
            }
        } else {
            this.lastMovementTime = Date.now();
            // If movement resumes, we could potentially clear some states, 
            // but the SafetySystem handles its own modal/timeout.
        }
    }

    setupSafetyFeatures() {
        // Periodic check for night safety
        if (this.rideData?.isNightRide) {
            this.safetySystem.startNightSafetyChecks();
        }
    }

    triggerSOS() {
        // One-tap, no confirmation needed for the action
        this.safetySystem.triggerSOS(false);
    }

    cancelSOS() {
        // Remove SOS related UI if any (the SafetySystem handles the modal)
        const modal = document.querySelector('.danger-modal');
        if (modal) modal.classList.remove('active');
    }

    async sendSOSAlert() {
        try {
            const { addDoc, collection } = await import("https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js");

            await addDoc(collection(db, "safety_alerts"), {
                rideId: this.rideId,
                riderId: this.rideData?.riderId || 'unknown',
                driverId: this.rideData?.driverId || 'unknown',
                reportedBy: this.user.uid,
                userName: (this.role === 'rider' ? this.rideData?.riderName : this.rideData?.driverName) || 'Unknown User',
                type: 'SOS Button Triggered',
                status: 'active',
                timestamp: new Date(),
                location: this.lastKnownLocation || null
            });
            console.log("✅ SOS Alert sent to Firestore");
        } catch (error) {
            console.error("Error sending SOS alert:", error);
        }
    }

    showTripSummary(data) {
        document.getElementById('trip-summary-modal').classList.add('active');
        document.getElementById('summary-distance').textContent = `${data.distance?.toFixed(1) || 0} km`;
        document.getElementById('summary-fare').textContent = `$${data.fare?.total?.toFixed(2) || 0}`;

        const paymentSection = document.getElementById('payment-section');
        const feedbackSection = document.getElementById('feedback-section');
        const driverWaitingMsg = document.getElementById('driver-payment-waiting');

        // Check if already paid
        if (data.paymentStatus === 'paid') {
            paymentSection.style.display = 'none';
            if (driverWaitingMsg) driverWaitingMsg.style.display = 'none';

            feedbackSection.style.display = 'block';

            // Allow feedback submission
            const feedbackBtn = document.getElementById('submit-feedback-btn');
            // Remove old listeners
            const newBtn = feedbackBtn.cloneNode(true);
            feedbackBtn.parentNode.replaceChild(newBtn, feedbackBtn);

            newBtn.addEventListener('click', async () => {
                alert("Thank you for your feedback!");
                window.location.href = this.role === 'driver' ? 'driver-dashboard-v2.html' : 'rider-dashboard-v2.html';
            });

            return;
        }

        // Hide feedback initially
        feedbackSection.style.display = 'none';

        if (this.role === 'rider') {
            // RIDER VIEW: Show Payment Options
            paymentSection.style.display = 'block';

            // Payment Logic
            const paymentBtn = document.getElementById('process-payment-btn');
            const amountDisplay = document.getElementById('payment-amount');
            amountDisplay.textContent = `$${data.fare?.total?.toFixed(2) || 0}`;

            // Handle Payment Method Selection
            document.querySelectorAll('.payment-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    opt.querySelector('input').checked = true;
                });
            });

            // Pay Now Listener (ensure single listener)
            if (paymentBtn) {
                const newBtn = paymentBtn.cloneNode(true);
                paymentBtn.parentNode.replaceChild(newBtn, paymentBtn);
                newBtn.addEventListener('click', () => this.processPayment(data));
            }
        } else {
            // DRIVER VIEW: Show Waiting Message
            paymentSection.style.display = 'none';

            // Create or show waiting message
            let waitingMsg = document.getElementById('driver-payment-waiting');
            if (!waitingMsg) {
                waitingMsg = document.createElement('div');
                waitingMsg.id = 'driver-payment-waiting';
                waitingMsg.style.textAlign = 'center';
                waitingMsg.style.padding = '2rem';
                waitingMsg.innerHTML = `
                    <div class="loader" style="margin: 0 auto 1rem;"></div>
                    <h3>Waiting for Payment</h3>
                    <p>Rider is completing payment...</p>
                `;
                paymentSection.parentNode.insertBefore(waitingMsg, paymentSection);
            }
            waitingMsg.style.display = 'block';

            // Driver just listens (already setup within onSnapshot elsewhere for payment completion)
        }

    }

    async processPayment(rideData) {
        const method = document.querySelector('input[name="paymentMethod"]:checked').value;
        const amount = rideData.fare?.total || 0;
        const driverId = rideData.driverId;

        try {
            // 1. Create Payment Record
            const { addDoc, collection, doc, updateDoc, increment } = await import("https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js");

            const paymentRef = await addDoc(collection(db, "payments"), {
                rideId: this.rideId,
                riderId: this.user.uid,
                driverId: driverId,
                amount: amount,
                method: method,
                status: 'success', // Simulated success
                timestamp: new Date()
            });

            // 2. Update Ride Record
            await updateDoc(doc(db, "rides", this.rideId), {
                paymentStatus: 'paid',
                paymentId: paymentRef.id,
                paymentMethod: method
            });

            // 3. Update Driver Earnings (Atomic Increment)
            const driverRef = doc(db, "users", driverId);
            await updateDoc(driverRef, {
                "earnings.total": increment(amount),
                "earnings.today": increment(amount) // Simplification for demo
            });

            // 4. Show Success UI
            document.getElementById('payment-section').style.display = 'none';
            document.getElementById('feedback-section').style.display = 'block';
            this.showNotification("Payment Successful!", "success");

        } catch (error) {
            console.error("Payment Error:", error);
            alert("Payment failed. Please try again.");
        }
    }

    showNotification(msg, type = 'info') {
        const container = document.getElementById('notification-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

const tripManager = new LiveTripManager();
window.addEventListener('DOMContentLoaded', () => tripManager.init());
