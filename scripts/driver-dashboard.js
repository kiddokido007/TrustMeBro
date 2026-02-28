// Driver Dashboard - Core Module
// Handles driver authentication, profile, verification status, and session management

import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

export class DriverDashboard {
    constructor(app) {
        this.auth = getAuth(app);
        this.db = getFirestore(app);
        this.storage = getStorage(app);
        this.currentUser = null;
        this.driverData = null;
        this.inactivityTimer = null;
        this.inactivityTimeout = 30 * 60 * 1000; // 30 minutes
    }

    // Initialize dashboard
    async init() {
        await this.checkAuthentication();
        this.setupInactivityMonitor();
        this.setupEventListeners();
    }

    // Check authentication and load driver data
    async checkAuthentication() {
        return new Promise((resolve, reject) => {
            onAuthStateChanged(this.auth, async (user) => {
                if (user) {
                    this.currentUser = user;
                    try {
                        await this.loadDriverData(user.uid);
                        await this.verifyDriverRole();
                        this.updateUIWithDriverData();
                        resolve(true);
                    } catch (error) {
                        console.error("Error loading driver data:", error);
                        reject(error);
                    }
                } else {
                    // User is signed out, redirect to login
                    window.location.href = '../public/auth.html?role=driver';
                    reject(new Error("Not authenticated"));
                }
            });
        });
    }

    // Load driver data from Firestore with real-time updates
    async loadDriverData(uid) {
        const driverDocRef = doc(this.db, "users", uid);

        // Set up real-time listener for driver data
        onSnapshot(driverDocRef, (docSnap) => {
            if (docSnap.exists()) {
                this.driverData = docSnap.data();
                this.updateUIWithDriverData();
            } else {
                console.error("No driver document found");
                window.location.href = '../public/auth.html?role=driver';
            }
        }, (error) => {
            console.error("Error listening to driver data:", error);
        });

        // Also get initial data
        const driverDoc = await getDoc(driverDocRef);
        if (driverDoc.exists()) {
            this.driverData = driverDoc.data();
            return this.driverData;
        } else {
            throw new Error("Driver document not found");
        }
    }

    // Verify driver role and account status
    async verifyDriverRole() {
        if (!this.driverData) {
            throw new Error("Driver data not loaded");
        }

        // Check if account is suspended
        if (this.driverData.accountStatus === 'suspended') {
            alert('Your account has been suspended. Please contact support.');
            await signOut(this.auth);
            window.location.href = '../public/auth.html?role=driver';
            return;
        }

        // Check if user role is driver
        if (this.driverData.role !== 'driver') {
            // Redirect to appropriate dashboard based on role
            window.location.href = `../dashboard/${this.driverData.role}-dashboard-v2.html`;
        }
    }

    // Update UI with driver data
    updateUIWithDriverData() {
        if (!this.driverData) return;

        // Update greeting
        const greeting = this.getTimeBasedGreeting();
        const greetingElement = document.querySelector('.greeting');
        if (greetingElement) {
            const firstName = this.driverData.firstName || 'Driver';
            greetingElement.innerHTML = `${greeting} <span>${firstName}</span> 🚗`;
        }

        // Update driver info
        const driverName = document.querySelector('.driver-name');
        if (driverName) {
            driverName.textContent = `${this.driverData.firstName || ''} ${this.driverData.lastName || ''}`.trim();
        }

        const driverEmail = document.querySelector('.driver-email');
        if (driverEmail) {
            driverEmail.textContent = this.driverData.email || '';
        }

        // Update vehicle info
        this.updateVehicleInfo();

        // Update profile avatar
        this.updateProfileAvatar();

        // Update verification badge
        this.updateVerificationBadge();

        // Update earnings
        this.updateEarningsDisplay();
    }

    // Get time-based greeting
    getTimeBasedGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        if (hour < 22) return 'Good evening';
        return 'Hey';
    }

    // Update vehicle info
    updateVehicleInfo() {
        const vehicleInfo = document.querySelector('.vehicle-info');
        if (!vehicleInfo || !this.driverData.vehicle) return;

        const vehicle = this.driverData.vehicle;
        vehicleInfo.innerHTML = `
            <div style="font-size: 0.9rem; color: #64748B;">
                <div><strong>Vehicle:</strong> ${vehicle.make || 'N/A'} ${vehicle.model || ''}</div>
                <div><strong>License:</strong> ${vehicle.licensePlate || 'N/A'}</div>
                <div><strong>Color:</strong> ${vehicle.color || 'N/A'}</div>
            </div>
        `;
    }

    // Update profile avatar
    updateProfileAvatar() {
        const avatarElement = document.querySelector('.driver-avatar');
        if (!avatarElement) return;

        if (this.driverData.photoURL) {
            avatarElement.innerHTML = `<img src="${this.driverData.photoURL}" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
            const initials = this.getInitials();
            avatarElement.innerHTML = `<span style="font-size: 1.5rem; font-weight: 600;">${initials}</span>`;
        }
    }

    // Get driver initials
    getInitials() {
        const firstName = this.driverData?.firstName || '';
        const lastName = this.driverData?.lastName || '';

        if (firstName && lastName) {
            return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
        } else if (firstName) {
            return firstName.charAt(0).toUpperCase();
        } else if (this.driverData?.email) {
            return this.driverData.email.charAt(0).toUpperCase();
        }
        return 'D';
    }

    // Update verification badge
    updateVerificationBadge() {
        const badgeContainer = document.querySelector('.verification-badge-container');
        if (!badgeContainer) return;

        const status = this.driverData?.verificationStatus || 'pending';
        const isVerified = this.driverData?.isVerified || false;

        let badgeColor, badgeText, badgeIcon;

        if (status === 'approved' && isVerified) {
            badgeColor = '#E8F5E9';
            badgeText = 'Verified Driver';
            badgeIcon = 'check-circle';
        } else if (status === 'pending') {
            badgeColor = '#FFF3E0';
            badgeText = 'Verification Pending';
            badgeIcon = 'clock';
        } else if (status === 'rejected') {
            badgeColor = '#FFEBEE';
            badgeText = 'Verification Rejected';
            badgeIcon = 'times-circle';
        } else {
            badgeColor = '#F5F5F5';
            badgeText = 'Not Verified';
            badgeIcon = 'exclamation-circle';
        }

        badgeContainer.innerHTML = `
            <div style="
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 0.5rem 1rem;
                border-radius: 20px;
                font-size: 0.85rem;
                font-weight: 600;
                background: ${badgeColor};
                color: ${status === 'approved' ? '#1B5E20' : status === 'pending' ? '#E65100' : '#C62828'};
            ">
                <i class="fas fa-${badgeIcon}"></i>
                <span>${badgeText}</span>
            </div>
        `;
    }

    // Update earnings display
    updateEarningsDisplay() {
        const rawEarnings = this.driverData?.earnings || {};
        const earnings = {
            daily: rawEarnings.today || rawEarnings.daily || 0, // Handle both naming conventions
            weekly: rawEarnings.weekly || 0,
            monthly: rawEarnings.monthly || 0,
            total: rawEarnings.total || 0
        };

        const dailyEarnings = document.getElementById('dailyEarnings');
        const weeklyEarnings = document.getElementById('weeklyEarnings');
        const monthlyEarnings = document.getElementById('monthlyEarnings');
        const totalEarnings = document.getElementById('totalEarnings');

        if (dailyEarnings) dailyEarnings.textContent = `$${earnings.daily.toFixed(2)}`;
        if (weeklyEarnings) weeklyEarnings.textContent = `$${earnings.weekly.toFixed(2)}`;
        if (monthlyEarnings) monthlyEarnings.textContent = `$${earnings.monthly.toFixed(2)}`;
        if (totalEarnings) totalEarnings.textContent = `$${earnings.total.toFixed(2)}`;
    }

    // Upload profile photo
    async uploadProfilePhoto(file) {
        if (!file || !this.currentUser) return;

        try {
            const storageRef = ref(this.storage, `driver-photos/${this.currentUser.uid}`);
            await uploadBytes(storageRef, file);
            const photoURL = await getDownloadURL(storageRef);

            await updateDoc(doc(this.db, "users", this.currentUser.uid), {
                photoURL: photoURL
            });

            this.driverData.photoURL = photoURL;
            this.updateProfileAvatar();

            return photoURL;
        } catch (error) {
            console.error("Error uploading profile photo:", error);
            throw error;
        }
    }

    // Setup inactivity monitor
    setupInactivityMonitor() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

        const resetTimer = () => {
            clearTimeout(this.inactivityTimer);
            this.inactivityTimer = setTimeout(() => {
                this.handleInactivity();
            }, this.inactivityTimeout);
        };

        events.forEach(event => {
            document.addEventListener(event, resetTimer, true);
        });

        resetTimer();
    }

    // Handle inactivity timeout
    async handleInactivity() {
        const shouldLogout = confirm('You have been inactive for 30 minutes. Do you want to stay logged in?');

        if (!shouldLogout) {
            this.setupInactivityMonitor();
        } else {
            await this.logout();
        }
    }

    // Setup event listeners
    setupEventListeners() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        const profileBtn = document.getElementById('profileBtn');
        const profilePanel = document.getElementById('profilePanel');
        if (profileBtn && profilePanel) {
            profileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                profilePanel.classList.toggle('active');
            });
        }

        document.addEventListener('click', (e) => {
            const profilePanel = document.getElementById('profilePanel');
            const profileBtn = document.getElementById('profileBtn');

            if (profilePanel && !profilePanel.contains(e.target) && e.target !== profileBtn && !profileBtn?.contains(e.target)) {
                profilePanel.classList.remove('active');
            }
        });
    }

    // Logout
    async logout() {
        try {
            if (this.inactivityTimer) {
                clearTimeout(this.inactivityTimer);
            }

            // Set driver offline before logout
            if (this.currentUser) {
                await updateDoc(doc(this.db, "users", this.currentUser.uid), {
                    isAvailable: false,
                    lastOnlineAt: new Date()
                });
            }

            await signOut(this.auth);
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '../public/auth.html?role=driver';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        }
    }

    // Get current driver data
    getDriverData() {
        return this.driverData;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Check if driver can go online
    canGoOnline() {
        return this.driverData?.verificationStatus === 'approved' &&
            this.driverData?.isVerified === true &&
            this.driverData?.accountStatus !== 'suspended';
    }
}
