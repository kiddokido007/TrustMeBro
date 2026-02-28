// Rider Dashboard - Core Functionality Module
// Handles profile, authentication, and session management

import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

export class RiderDashboard {
    constructor(app) {
        this.auth = getAuth(app);
        this.db = getFirestore(app);
        this.storage = getStorage(app);
        this.currentUser = null;
        this.userData = null;
        this.inactivityTimer = null;
        this.inactivityTimeout = 30 * 60 * 1000; // 30 minutes
    }

    // Initialize dashboard
    async init() {
        await this.checkAuthentication();
        this.setupInactivityMonitor();
        this.setupEventListeners();
    }

    // Check authentication and load user data
    async checkAuthentication() {
        return new Promise((resolve, reject) => {
            onAuthStateChanged(this.auth, async (user) => {
                if (user) {
                    this.currentUser = user;
                    try {
                        await this.loadUserData(user.uid);
                        await this.verifyUserRole();
                        this.updateUIWithUserData();
                        resolve(true);
                    } catch (error) {
                        console.error("Error loading user data:", error);
                        reject(error);
                    }
                } else {
                    // User is signed out, redirect to login
                    window.location.href = '../public/auth.html';
                    reject(new Error("Not authenticated"));
                }
            });
        });
    }

    // Load user data from Firestore with real-time updates
    async loadUserData(uid) {
        const userDocRef = doc(this.db, "users", uid);

        // Set up real-time listener for user data
        onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                this.userData = docSnap.data();
                this.updateUIWithUserData();
            } else {
                console.error("No user document found");
                window.location.href = '../public/auth.html';
            }
        }, (error) => {
            console.error("Error listening to user data:", error);
        });

        // Also get initial data
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            this.userData = userDoc.data();
            return this.userData;
        } else {
            throw new Error("User document not found");
        }
    }

    // Verify user role and account status
    async verifyUserRole() {
        if (!this.userData) {
            throw new Error("User data not loaded");
        }

        // Check if account is suspended
        if (this.userData.accountStatus === 'suspended') {
            alert('Your account has been suspended. Please contact support.');
            await signOut(this.auth);
            window.location.href = '../public/auth.html';
            return;
        }

        // Check if user role is rider
        if (this.userData.role !== 'rider') {
            // Redirect to appropriate dashboard based on role
            window.location.href = `../dashboard/${this.userData.role}.html`;
        }
    }

    // Update UI with user data
    updateUIWithUserData() {
        if (!this.userData) return;

        // Update greeting with time-based message
        const greeting = this.getTimeBasedGreeting();
        const greetingElement = document.querySelector('.greeting');
        if (greetingElement) {
            const firstName = this.userData.firstName || 'Bro';
            greetingElement.innerHTML = `${greeting} <span>${firstName}</span> 👋 Where to?`;
        }

        // Update profile panel
        const profileName = document.querySelector('.user-profile h3');
        if (profileName) {
            profileName.textContent = `${this.userData.firstName || ''} ${this.userData.lastName || ''}`.trim() || 'Rider Name';
        }

        const profileEmail = document.querySelector('.user-profile p');
        if (profileEmail) {
            profileEmail.textContent = this.userData.email || 'rider@example.com';
        }

        // Update profile avatar
        this.updateProfileAvatar();

        // Add verification badge
        this.updateVerificationBadge();
    }

    // Get time-based greeting
    getTimeBasedGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        if (hour < 22) return 'Good evening';
        return 'Hey';
    }

    // Update profile avatar
    updateProfileAvatar() {
        const avatarElement = document.querySelector('.user-avatar');
        if (!avatarElement) return;

        if (this.userData.photoURL) {
            // Display profile photo
            avatarElement.innerHTML = `<img src="${this.userData.photoURL}" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
            // Display initials
            const initials = this.getInitials();
            avatarElement.innerHTML = `<span style="font-size: 1.5rem; font-weight: 600;">${initials}</span>`;
        }
    }

    // Get user initials
    getInitials() {
        const firstName = this.userData?.firstName || '';
        const lastName = this.userData?.lastName || '';

        if (firstName && lastName) {
            return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
        } else if (firstName) {
            return firstName.charAt(0).toUpperCase();
        } else if (this.userData?.email) {
            return this.userData.email.charAt(0).toUpperCase();
        }
        return 'R';
    }

    // Update verification badge
    updateVerificationBadge() {
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) return;

        // Remove existing badge if any
        const existingBadge = document.querySelector('.verification-badge');
        if (existingBadge) {
            existingBadge.remove();
        }

        // Add verification badge
        const isVerified = this.userData?.isVerified || this.userData?.emailVerified || this.currentUser?.emailVerified;
        const badge = document.createElement('div');
        badge.className = 'verification-badge';
        badge.style.cssText = `
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 0.4rem 0.8rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            ${isVerified
                ? 'background: #E8F5E9; color: #1B5E20;'
                : 'background: #FFF3E0; color: #E65100;'}
        `;
        badge.innerHTML = `
            <i class="fas fa-${isVerified ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${isVerified ? 'Verified' : 'Unverified'}</span>
        `;

        // Insert before notification button
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            headerRight.insertBefore(badge, notificationBtn);
        }
    }

    // Upload profile photo
    async uploadProfilePhoto(file) {
        if (!file || !this.currentUser) return;

        try {
            // Create a storage reference
            const storageRef = ref(this.storage, `profile-photos/${this.currentUser.uid}`);

            // Upload file
            await uploadBytes(storageRef, file);

            // Get download URL
            const photoURL = await getDownloadURL(storageRef);

            // Update user document
            await updateDoc(doc(this.db, "users", this.currentUser.uid), {
                photoURL: photoURL
            });

            // Update UI
            this.userData.photoURL = photoURL;
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

        // Add event listeners for user activity
        events.forEach(event => {
            document.addEventListener(event, resetTimer, true);
        });

        // Start the timer
        resetTimer();
    }

    // Handle inactivity timeout
    async handleInactivity() {
        // Show warning dialog
        const shouldLogout = confirm('You have been inactive for 30 minutes. Do you want to stay logged in?');

        if (!shouldLogout) {
            // User wants to stay logged in, reset timer
            this.setupInactivityMonitor();
        } else {
            // Logout user
            await this.logout();
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Profile button toggle
        const profileBtn = document.getElementById('profileBtn');
        const profilePanel = document.getElementById('profilePanel');
        if (profileBtn && profilePanel) {
            profileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                profilePanel.classList.toggle('active');
                // Close notifications panel
                const notificationsPanel = document.getElementById('notificationsPanel');
                if (notificationsPanel) {
                    notificationsPanel.classList.remove('active');
                }
            });
        }

        // Close panels when clicking outside
        document.addEventListener('click', (e) => {
            const profilePanel = document.getElementById('profilePanel');
            const notificationsPanel = document.getElementById('notificationsPanel');
            const profileBtn = document.getElementById('profileBtn');
            const notificationBtn = document.getElementById('notificationBtn');

            if (profilePanel && !profilePanel.contains(e.target) && e.target !== profileBtn && !profileBtn?.contains(e.target)) {
                profilePanel.classList.remove('active');
            }

            if (notificationsPanel && !notificationsPanel.contains(e.target) && e.target !== notificationBtn && !notificationBtn?.contains(e.target)) {
                notificationsPanel.classList.remove('active');
            }
        });
    }

    // Logout
    async logout() {
        try {
            // Clear timers
            if (this.inactivityTimer) {
                clearTimeout(this.inactivityTimer);
            }

            // Sign out from Firebase
            await signOut(this.auth);

            // Clear local storage
            localStorage.clear();

            // Clear session storage
            sessionStorage.clear();

            // Redirect to login
            window.location.href = '../public/auth.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        }
    }

    // Get current user data
    getUserData() {
        return this.userData;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }
}
