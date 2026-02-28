// Admin Dashboard - Core Logic
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, doc, getDoc, updateDoc, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

export class AdminDashboard {
    constructor(app) {
        this.auth = getAuth(app);
        this.db = getFirestore(app);
        this.rtdb = getDatabase(app);
        this.currentUser = null;
        this.map = null;
        this.markers = new Map(); // rideId -> marker
        this.sosAlerts = new Map();

        // Modules (to be initialized)
        this.safetyMonitor = null;
        this.userManager = null;
    }

    async init() {
        this.checkAuth();
        this.startTimeUpdate();
        this.initializeMap();
        this.setupListeners();
    }

    checkAuth() {
        onAuthStateChanged(this.auth, async (user) => {
            if (user) {
                const userDoc = await getDoc(doc(this.db, "users", user.uid));
                if (userDoc.exists() && userDoc.data().role === 'admin') {
                    this.currentUser = user;
                    document.getElementById('admin-name').textContent = userDoc.data().firstName || 'Super Admin';
                    console.log("🛡️ Admin authenticated");
                } else {
                    alert("Unauthorized access. Admin role required.");
                    window.location.href = "../public/auth.html";
                }
            } else {
                window.location.href = "../public/auth.html";
            }
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            signOut(this.auth).then(() => window.location.href = "../public/auth.html");
        });
    }

    startTimeUpdate() {
        const timeEl = document.getElementById('current-time');
        setInterval(() => {
            timeEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
        }, 1000);
    }

    initializeMap() {
        this.map = L.map('admin-map').setView([20.5937, 78.9629], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
    }

    setupListeners() {
        // 1. KPI: Active Rides
        const activeRidesQuery = query(collection(this.db, "rides"), where("status", "in", ["searching", "driver_assigned", "in_progress"]));
        onSnapshot(activeRidesQuery, (snapshot) => {
            document.getElementById('count-active-rides').textContent = snapshot.size;
            this.updateRideMarkers(snapshot);
        });

        // 2. KPI: Online Drivers
        const onlineDriversQuery = query(collection(this.db, "users"), where("role", "==", "driver"), where("isAvailable", "==", true));
        onSnapshot(onlineDriversQuery, (snapshot) => {
            document.getElementById('count-online-drivers').textContent = snapshot.size;
        });

        // 3. KPI: SOS Alerts
        const sosQuery = query(collection(this.db, "safety_alerts"), where("status", "==", "active"));
        onSnapshot(sosQuery, (snapshot) => {
            const count = snapshot.size;
            document.getElementById('count-sos-alerts').textContent = count;
            document.getElementById('sos-active-badge').textContent = `${count} Active`;
            this.handleSOSAlerts(snapshot);
        });

        // 4. Verification Queue
        const pendingDriversQuery = query(collection(this.db, "users"), where("role", "==", "driver"), where("verificationStatus", "==", "pending"));
        onSnapshot(pendingDriversQuery, (snapshot) => {
            this.updateVerificationTable(snapshot);
        });

        // 5. Night Safety Console
        const currentRidesQuery = query(collection(this.db, "rides"), where("status", "==", "in_progress"));
        onSnapshot(currentRidesQuery, (snapshot) => {
            this.updateNightSafetyConsole(snapshot);
        });

        // 6. User Directory
        const allUsersQuery = query(collection(this.db, "users"), orderBy("createdAt", "desc"));
        onSnapshot(allUsersQuery, (snapshot) => {
            this.updateUserDirectory(snapshot);
        });
    }

    updateUserDirectory(snapshot) {
        const tbody = document.querySelector('#user-directory-table tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        snapshot.forEach(doc => {
            const user = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.firstName || 'New'} ${user.lastName || 'User'}</td>
                <td><span class="status-badge" style="background: #e2e8f0;">${user.role || 'rider'}</span></td>
                <td>${user.email || 'N/A'}</td>
                <td><span class="status-badge ${user.accountStatus === 'suspended' ? 'status-suspended' : 'status-verified'}">${user.accountStatus || 'active'}</span></td>
                <td>
                    <button onclick="toggleUserStatus('${doc.id}', '${user.accountStatus}')" class="btn-small">${user.accountStatus === 'suspended' ? 'Reactivate' : 'Suspend'}</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    updateNightSafetyConsole(snapshot) {
        const container = document.getElementById('night-rides-container');
        const now = new Date();
        const hour = now.getHours();
        const isNight = hour >= 22 || hour < 6;

        if (snapshot.empty || !isNight) {
            container.innerHTML = `<div style="text-align: center; padding: 1.5rem; background: #f8fafc; border-radius: 8px;"><p style="font-size: 0.85rem; color: #64748b;">${isNight ? 'No active night-time rides.' : 'Night safety monitoring (10PM-6AM) is currently idle.'}</p></div>`;
            return;
        }

        container.innerHTML = '';
        snapshot.forEach(doc => {
            const ride = doc.data();
            const div = document.createElement('div');
            div.style.cssText = "padding: 0.75rem; background: #f1f5f9; border-radius: 6px; margin-bottom: 0.5rem; border-left: 3px solid var(--admin-primary);";
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <strong style="font-size: 0.85rem;">Trip #${doc.id.slice(-6)}</strong>
                    <span style="font-size: 0.7rem; color: #64748b;">${new Date(ride.assignedAt?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style="font-size: 0.75rem; margin-top: 4px;">Rider: ${ride.riderName} | Driver: ${ride.driverName}</div>
            `;
            container.appendChild(div);
        });
    }

    updateRideMarkers(snapshot) {
        // Clear old markers not in snapshot
        const activeIds = new Set();
        snapshot.forEach(doc => activeIds.add(doc.id));

        for (const [id, marker] of this.markers) {
            if (!activeIds.has(id)) {
                this.map.removeLayer(marker);
                this.markers.delete(id);
            }
        }

        // Add/Update markers
        snapshot.forEach(rideDoc => {
            const data = rideDoc.data();
            if (data.status === 'in_progress' && data.driverId) {
                this.trackVehicle(rideDoc.id, data.driverId, data);
            }
        });
    }

    trackVehicle(rideId, driverId, rideData) {
        const driverLocRef = ref(this.rtdb, `driver_locations/${driverId}`);
        onValue(driverLocRef, (snapshot) => {
            const loc = snapshot.val();
            if (loc) {
                this.detectAnomalies(rideId, loc, rideData);
                if (this.markers.has(rideId)) {
                    this.markers.get(rideId).setLatLng([loc.latitude, loc.longitude]);
                } else {
                    const marker = L.marker([loc.latitude, loc.longitude], {
                        icon: L.divIcon({
                            className: 'vehicle-marker',
                            html: `
                                <div style="position: relative;">
                                    <i class="fas fa-car" style="color: var(--accent); font-size: 1.5rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"></i>
                                    ${rideData.status === 'in_progress' ? '<div style="position: absolute; top: -5px; right: -5px; width: 10px; height: 10px; background: #16a34a; border-radius: 50%; border: 2px solid white;"></div>' : ''}
                                </div>
                            `,
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        })
                    }).addTo(this.map);

                    const popupContent = `
                        <div style="font-family: 'Poppins', sans-serif; min-width: 200px;">
                            <div style="border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 8px;">
                                <strong style="color: var(--admin-primary);">Trip #${rideId.slice(-6)}</strong>
                                <span class="status-badge status-verified" style="float: right; font-size: 0.6rem;">${rideData.status}</span>
                            </div>
                            <div style="font-size: 0.85rem; margin-bottom: 4px;"><strong>Driver:</strong> ${rideData.driverName || 'N/A'}</div>
                            <div style="font-size: 0.85rem; margin-bottom: 4px;"><strong>Rider:</strong> ${rideData.riderName || 'N/A'}</div>
                            <div style="font-size: 0.85rem;"><strong>From:</strong> ${rideData.pickupAddress || 'Pickup Point'}</div>
                        </div>
                    `;
                    marker.bindPopup(popupContent);
                    this.markers.set(rideId, marker);
                }
            }
        });
    }

    detectAnomalies(rideId, loc, rideData) {
        const container = document.getElementById('anomaly-alerts');
        const alertId = `anomaly-${rideId}`;

        // Stationary anomaly (speed ~ 0 for moving trip)
        const isStationary = !loc.isMoving || (loc.speed || 0) < 0.5;

        if (isStationary && rideData.status === 'in_progress') {
            if (!document.getElementById(alertId)) {
                const div = document.createElement('div');
                div.id = alertId;
                div.className = 'anomaly-item stationary';
                div.style.cssText = "display: flex; gap: 10px; align-items: center; padding: 0.75rem; background: #fff7ed; border: 1px solid #ffedd5; border-radius: 6px; margin-bottom: 0.5rem; animation: pulse 2s infinite;";
                div.innerHTML = `
                    <i class="fas fa-pause-circle" style="color: #ea580c;"></i>
                    <div style="font-size: 0.85rem;">
                        <strong>Auto-Stop Detected:</strong> Trip #${rideId.slice(-6)}<br>
                        <small>Monitoring for rider response...</small>
                    </div>
                `;
                container.appendChild(div);
            }
        } else {
            const el = document.getElementById(alertId);
            if (el) el.remove();
        }
    }

    handleSOSAlerts(snapshot) {
        const container = document.getElementById('sos-alerts-container');
        if (snapshot.empty) {
            container.innerHTML = `<div style="text-align: center; padding: 2rem; color: #64748b;"><i class="fas fa-check-circle" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i><p>All systems normal. No active SOS alerts.</p></div>`;
            document.body.classList.remove('sos-active-mode');
            return;
        }

        document.body.classList.add('sos-active-mode');
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const alert = doc.data();
            const div = document.createElement('div');
            const isEscalation = alert.type.includes('Escalation') || alert.status === 'warning';

            div.className = `sos-alert ${isEscalation ? 'escalation' : 'emergency'}`;
            div.style.borderLeft = isEscalation ? '4px solid #f59e0b' : '4px solid #ef4444';
            div.style.background = isEscalation ? '#fffbeb' : '#fef2f2';
            div.style.padding = '1rem';
            div.style.borderRadius = '8px';
            div.style.marginBottom = '0.75rem';

            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <strong style="color: ${isEscalation ? '#d97706' : '#dc2626'}; display: flex; align-items: center; gap: 4px;">
                            <i class="fas ${isEscalation ? 'fa-exclamation-triangle' : 'fa-radiation fa-spin'}" style="font-size: 0.9rem;"></i> 
                            ${isEscalation ? 'SAFETY ESCALATION' : 'HIGH PRIORITY SOS'}
                        </strong>
                        <div style="font-size: 0.85rem; margin: 4px 0;"><strong>Reporter:</strong> ${alert.userName || alert.userId || 'Unknown'}</div>
                        <div style="font-size: 0.75rem; color: #64748b;"><strong>Event:</strong> ${alert.type || 'Emergency Detected'}</div>
                        <div style="font-size: 0.75rem; color: #64748b;"><strong>Status:</strong> ${alert.status}</div>
                    </div>
                    <button onclick="resolveSOS('${doc.id}')" style="background: white; border: 1px solid #ddd; padding: 6px 12px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">Resolve</button>
                </div>
            `;
            container.appendChild(div);
        });
    }

    updateVerificationTable(snapshot) {
        const tbody = document.querySelector('#verification-table tbody');
        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No pending verifications</td></tr>';
            return;
        }

        snapshot.forEach(userDoc => {
            const user = userDoc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${user.firstName} ${user.lastName}</td>
                <td>${user.vehicle?.make || 'N/A'} ${user.vehicle?.model || ''}</td>
                <td>${user.updatedAt?.toDate().toLocaleDateString() || 'Recently'}</td>
                <td><span class="status-badge status-pending">Pending</span></td>
                <td>
                    <button onclick="approveDriver('${userDoc.id}')" class="btn-small" style="background: #22c55e; color: white; border: none;">Approve</button>
                    <button onclick="rejectDriver('${userDoc.id}')" class="btn-small" style="background: #ef4444; color: white; border: none;">Reject</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// Global functions for inline event handlers
window.approveDriver = async (uid) => {
    if (confirm("Approve this driver?")) {
        try {
            const db = getFirestore();
            await updateDoc(doc(db, "users", uid), {
                verificationStatus: 'approved',
                isVerified: true
            });
            alert("Driver verified successfully");
        } catch (e) {
            console.error(e);
        }
    }
};

window.toggleUserStatus = async (uid, currentStatus) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    if (confirm(`Change user status to ${newStatus}?`)) {
        try {
            const db = getFirestore();
            await updateDoc(doc(db, "users", uid), {
                accountStatus: newStatus
            });
            alert(`User ${newStatus}`);
        } catch (e) {
            console.error(e);
        }
    }
};

window.rejectDriver = async (uid) => {
    if (confirm("Reject this driver's verification request?")) {
        try {
            const db = getFirestore();
            await updateDoc(doc(db, "users", uid), {
                verificationStatus: 'rejected',
                isVerified: false
            });
            alert("Driver rejected");
        } catch (e) {
            console.error(e);
        }
    }
};

window.resolveSOS = async (alertId) => {
    if (confirm("Mark this incident as resolved?")) {
        try {
            const db = getFirestore();
            await updateDoc(doc(db, "safety_alerts", alertId), {
                status: 'resolved',
                resolvedAt: new Date()
            });
        } catch (e) {
            console.error(e);
        }
    }
};

import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
const fbApp = initializeApp(firebaseConfig);
const dashboard = new AdminDashboard(fbApp);
dashboard.init();
