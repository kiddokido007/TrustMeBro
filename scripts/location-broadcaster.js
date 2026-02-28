// Driver Location Broadcaster Module
// Handles real-time location tracking and broadcasting to Firebase Realtime Database

import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

export class LocationBroadcaster {
    constructor(app, driverId) {
        this.rtdb = getDatabase(app);
        this.db = getFirestore(app);
        this.driverId = driverId;
        this.watchId = null;
        this.lastPosition = null;
        this.isTracking = false;
        this.updateInterval = 5000; // 5 seconds
    }

    // Start location tracking
    startTracking() {
        if (this.isTracking) {
            console.log('Location tracking already active');
            return;
        }

        if (!navigator.geolocation) {
            console.error('Geolocation not supported');
            return;
        }

        this.isTracking = true;

        // Watch position with high accuracy
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.handlePositionUpdate(position);
            },
            (error) => {
                console.error('Location tracking error:', error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 5000,
                timeout: 10000
            }
        );

        console.log('📍 Location tracking started');
    }

    // Stop location tracking
    stopTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        this.isTracking = false;
        console.log('⏹️ Location tracking stopped');
    }

    // Handle position update
    async handlePositionUpdate(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        const speed = position.coords.speed || 0; // m/s

        // Calculate if moving (speed > 1 km/h = 0.28 m/s)
        const isMoving = speed > 0.28;

        // Update Firebase Realtime Database
        try {
            await set(ref(this.rtdb, `driver_locations/${this.driverId}`), {
                latitude: lat,
                longitude: lng,
                accuracy: accuracy,
                speed: speed,
                isMoving: isMoving,
                timestamp: Date.now()
            });

            this.lastPosition = { lat, lng, isMoving };

            // Sync to Firestore for driver matching
            await updateDoc(doc(this.db, "users", this.driverId), {
                currentLocation: {
                    latitude: lat,
                    longitude: lng,
                    timestamp: Date.now()
                }
            });

            // Log for debugging
            console.log(`📍 Location updated: ${lat.toFixed(6)}, ${lng.toFixed(6)} | Moving: ${isMoving}`);
        } catch (error) {
            console.error('Error updating location:', error);
        }
    }

    // Get current position
    getCurrentPosition() {
        return this.lastPosition;
    }

    // Check if moving
    isDriverMoving() {
        return this.lastPosition?.isMoving || false;
    }
}
