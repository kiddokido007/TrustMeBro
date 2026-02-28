// Profile Manager Module
// Handles user profile updates and verification flow

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let userData = null;

// Initialize Profile Page
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        setupRealtimeUpdates(user.uid);
    } else {
        window.location.href = '../public/auth.html';
    }
});

function setupRealtimeUpdates(uid) {
    onSnapshot(doc(db, "users", uid), (docSnap) => {
        if (docSnap.exists()) {
            userData = docSnap.data();
            updateUI(userData);
            // Save role for the back button
            localStorage.setItem('userRole', userData.role || 'rider');
        }
    });
}

function updateUI(data) {
    // Basic Info
    // Basic Info
    const profileName = document.getElementById('profileName');
    if (profileName) profileName.textContent = `${data.firstName || ''} ${data.lastName || ''}`;

    const profileRoleBadge = document.getElementById('profileRoleBadge');
    if (profileRoleBadge) profileRoleBadge.textContent = data.role === 'driver' ? 'Driver Profile' : 'Rider Profile';

    const valFirstName = document.getElementById('val-firstName');
    if (valFirstName) valFirstName.textContent = data.firstName || '-';

    const valLastName = document.getElementById('val-lastName');
    if (valLastName) valLastName.textContent = data.lastName || '-';

    const valEmail = document.getElementById('val-email');
    if (valEmail) valEmail.textContent = data.email || '-';

    const valPhone = document.getElementById('val-phone');
    if (valPhone) valPhone.textContent = data.phone || '-';

    // Inputs for edit mode
    const inputFirstName = document.getElementById('input-firstName');
    if (inputFirstName) inputFirstName.value = data.firstName || '';

    const inputLastName = document.getElementById('input-lastName');
    if (inputLastName) inputLastName.value = data.lastName || '';

    const inputPhone = document.getElementById('input-phone');
    if (inputPhone) inputPhone.value = data.phone || '';

    // Driver specific fields
    if (data.role === 'driver') {
        const driverFields = document.getElementById('driverSpecificFields');
        if (driverFields) driverFields.style.display = 'block';

        const valVehicleModel = document.getElementById('val-vehicleModel');
        if (valVehicleModel) valVehicleModel.textContent = data.vehicle?.make ? `${data.vehicle.make} ${data.vehicle.model}` : '-';

        const valLicensePlate = document.getElementById('val-licensePlate');
        if (valLicensePlate) valLicensePlate.textContent = data.vehicle?.licensePlate || '-';

        const inputVehicleModel = document.getElementById('input-vehicleModel');
        if (inputVehicleModel) inputVehicleModel.value = data.vehicle?.make ? `${data.vehicle.make} ${data.vehicle.model}` : '';

        const inputLicensePlate = document.getElementById('input-licensePlate');
        if (inputLicensePlate) inputLicensePlate.value = data.vehicle?.licensePlate || '';
    }

    // Avatar
    const avatar = document.getElementById('profileAvatar');
    if (avatar) {
        if (data.photoURL) {
            avatar.innerHTML = `<img src="${data.photoURL}" alt="Profile">`;
        } else {
            avatar.innerHTML = `<i class="fas fa-user"></i>`;
        }
    }

    // Verification Status
    const statusBanner = document.getElementById('statusBanner');
    const statusTitle = document.getElementById('statusTitle');
    const statusDesc = document.getElementById('statusDesc');
    const verifyBtn = document.getElementById('verifyNowBtn');
    const headerBadge = document.getElementById('headerVerifyBadge');
    const fastTrackBtn = document.getElementById('fastTrackBtn');

    if (statusBanner && statusTitle && statusDesc) {
        if (data.isVerified && data.verificationStatus === 'approved') {
            statusBanner.className = 'status-banner status-verified';
            statusTitle.textContent = 'Account Verified ✓';
            statusDesc.textContent = 'Your identity is confirmed. You have full access to the platform.';
            if (verifyBtn) verifyBtn.style.display = 'none';
            if (headerBadge) headerBadge.style.display = 'flex';
            if (fastTrackBtn) fastTrackBtn.style.display = 'none';
        } else if (data.verificationStatus === 'pending') {
            statusBanner.className = 'status-banner status-pending';
            statusTitle.textContent = 'Verification Pending';
            statusDesc.textContent = 'Our team is reviewing your documents. This usually takes 24 hours.';
            if (verifyBtn) verifyBtn.style.display = 'none';
            if (headerBadge) headerBadge.style.display = 'none';
            if (fastTrackBtn) fastTrackBtn.style.display = 'block';
        } else {
            statusBanner.className = 'status-banner status-unverified';
            statusTitle.textContent = 'Account Unverified';
            statusDesc.textContent = 'You cannot start or accept rides until you are verified.';
            if (verifyBtn) verifyBtn.style.display = 'block';
            if (headerBadge) headerBadge.style.display = 'none';
            if (fastTrackBtn) fastTrackBtn.style.display = 'block';
        }
    }
}

// Global functions for buttons
window.toggleEdit = (editMode) => {
    const values = document.querySelectorAll('.value');
    const inputs = document.querySelectorAll('.edit-input');
    const editBtn = document.getElementById('editBtn');
    const saveBtn = document.getElementById('saveBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    values.forEach(v => v.style.display = editMode ? 'none' : 'block');
    inputs.forEach(i => i.style.display = editMode ? 'block' : 'none');

    editBtn.style.display = editMode ? 'none' : 'flex';
    saveBtn.style.display = editMode ? 'flex' : 'none';
    cancelBtn.style.display = editMode ? 'flex' : 'none';
};

window.saveProfile = async () => {
    const updateData = {
        firstName: document.getElementById('input-firstName').value,
        lastName: document.getElementById('input-lastName').value,
        phone: document.getElementById('input-phone').value
    };

    if (userData.role === 'driver') {
        const vehicleParts = document.getElementById('input-vehicleModel').value.split(' ');
        updateData.vehicle = {
            ...userData.vehicle,
            make: vehicleParts[0] || '',
            model: vehicleParts.slice(1).join(' ') || '',
            licensePlate: document.getElementById('input-licensePlate').value
        };
    }

    try {
        await updateDoc(doc(db, "users", currentUser.uid), updateData);
        alert('Profile updated successfully!');
        window.toggleEdit(false);
    } catch (err) {
        console.error(err);
        alert('Failed to update profile.');
    }
};

window.requestVerification = async () => {
    try {
        await updateDoc(doc(db, "users", currentUser.uid), {
            verificationStatus: 'pending'
        });
        alert('Verification request submitted!');
    } catch (err) {
        alert('Error submitting request.');
    }
};

window.fastTrackVerify = async () => {
    try {
        await updateDoc(doc(db, "users", currentUser.uid), {
            isVerified: true,
            verificationStatus: 'approved'
        });
        alert('Hack-A-Thon Hack: You are now verified! ✓');
    } catch (err) {
        alert('Error fast-tracking verification.');
    }
};
