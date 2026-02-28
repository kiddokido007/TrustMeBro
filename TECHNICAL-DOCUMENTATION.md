# TrustMeBro Project: Comprehensive Technical Documentation

This document provides a full deep-dive into the design, functionality, and file structure of the TrustMeBro ride-sharing platform.

---

## 🏗️ 1. Core Architecture & Design Patterns

TrustMeBro is built as a **Modular Real-Time Web Application**. It uses a **reactive pattern** where the UI components observe and respond to changes in a cloud-based state (Firebase).

### Key Patterns:
- **Class-Based Modules**: Each major feature (Auth, Booking, Safety) is encapsulated in a class, ensuring clean state management and easier debugging.
- **Firebase Observer Pattern**: Uses `onSnapshot` (Firestore) and `onValue` (Realtime Database) for live updates without page refreshes.
- **Role-Based Access Control (RBAC)**: All interfaces and internal logic are branched based on user roles (`rider`, `driver`, `admin`).

---

## 🔑 2. Authentication & User Management

### [auth.js](file:///d:/Projects/Hack-A-Thon/TrustMeBro/scripts/auth.js)
**Purpose**: Handles the entire onboarding and login flow.
- **Design**: Procedural logic with helper functions for validation and UI state.
- **Key Functions**:
    - `validateForm()`: Real-time validation for email, password strength, and role selection.
    - `handleSocialLogin(provider)`: Integration for Google and Facebook OAuth.
    - `saveUserInfoToFirestore(user)`: Ensures new users have a profile document in Firestore with default values (role, accountStatus).
    - **Mode Switching**: Dynamically switches the UI between Login and Register based on URL params.

### [profile-manager.js](file:///d:/Projects/Hack-A-Thon/TrustMeBro/scripts/profile-manager.js)
**Purpose**: Manages user-specific data and account settings.
- **Key Functions**:
    - `loadProfile()`: Fetches user bio, emergency contacts, and vehicle info.
    - `updateProfile(data)`: Persists changes back to Firestore.
    - `handleAvatarUpload()`: Logic for profile photo selection and preview.

---

## 🚗 3. Ride Lifecycle & Management

### [ride-booking.js](file:///d:/Projects/Hack-A-Thon/TrustMeBro/scripts/ride-booking.js)
**Purpose**: The central engine for Riders to request and manage rides.
- **Functions**:
    - `bookRide()`: Creates a new ride document in Firestore with pickup/drop locations and fare estimates.
    - `listenForInterestedDrivers()`: Listens for "bids" from drivers in real-time.
    - `selectDriver(driver)`: Finalizes the match and generates the **Entry OTP**.
    - `updateFareEstimate()`: Calculates price based on distance, traffic, and night-time surge.

### [ride-request-manager.js](file:///d:/Projects/Hack-A-Thon/TrustMeBro/scripts/ride-request-manager.js)
**Purpose**: The Driver-side counterpart for discovering ride opportunities.
- **Functions**:
    - `listenForRideRequests()`: Multi-tenant listener that shows available rides within a certain radius.
    - `acceptRide(rideId)`: Expresses interest in a ride, notifying the rider.
    - `createRequestCard()`: Generates the UI elements for incoming requests including distance, fare, and rider rating.

### [live-trip.js](file:///d:/Projects/Hack-A-Thon/TrustMeBro/scripts/live-trip.js)
**Purpose**: Coordinates the actual journey once a ride is active.
- **Functions**:
    - `verifyOTP()`: Enforces the **Dual OTP** (Entry at start, Exit at end).
    - `monitorMovement()`: Periodically checks vehicle speed for Auto-Stop detection.
    - `processPayment()`: Handles the checkout flow, updating driver earnings atomically.

---

## 🛡️ 4. Safety & Security Systems

### [safety-system.js](file:///d:/Projects/Hack-A-Thon/TrustMeBro/scripts/safety-system.js)
**Purpose**: High-priority safety monitoring and emergency response.
- **Functions**:
    - `triggerSOS(auto)`: Instant alert trigger with location broadcasting.
    - `performSafetyCheck()`: Initiates the "Are you safe?" challenge.
    - `handleNoResponse()`: Automated escalation logic if a rider/driver doesn't respond to prompts.

### [availability-manager.js](file:///d:/Projects/Hack-A-Thon/TrustMeBro/scripts/availability-manager.js)
**Purpose**: Tracks driver online/offline status and health checks.
- **Functions**:
    - `toggleOnlineStatus()`: Updates the `isAvailable` flag in Firestore.
    - `setupPresence()`: Uses Firebase `.info/connected` to automatically mark drivers offline if they lose internet.

---

## 🔧 5. Specialized Utility Modules

- **[notifications.js](file:///d:/Projects/Hack-A-Thon/TrustMeBro/scripts/notifications.js)**: A global event bus for in-app toasts, sound alerts, and browser push notifications.
- **[location-broadcaster.js](file:///d:/Projects/Hack-A-Thon/TrustMeBro/scripts/location-broadcaster.js)**: Background service that pushes GPS coordinates to the Firebase Realtime Database.
- **[ui-enhancements.js](file:///d:/Projects/Hack-A-Thon/TrustMeBro/scripts/ui-enhancements.js)**: Shared visual logic for animations, theme switching (Dark/Light), and micro-interactions.

---

## 🖥️ 6. Dashboard Design (HTML/CSS)

### [live-trip.html](file:///d:/Projects/Hack-A-Thon/TrustMeBro/dashboard/live-trip.html)
- **Visual Design**: Uses a heavy focus on the Map (Leaflet) with a functional "Bottom Sheet" overlay for contextual info.
- **Security Visibility**: The **SOS Button** is a fixed-position floating element (`z-index: 9999`) for zero-friction access.

### [admin-dashboard-v2.html](file:///d:/Projects/Hack-A-Thon/TrustMeBro/dashboard/admin-dashboard-v2.html)
- **Design Goal**: "Situational Awareness at a glance".
- **Componets**:
    - **KPI Cards**: Instant stats on system health (Active Rides, Online Drivers).
    - **Anomaly Feed**: A prioritized list of vehicles that are stationary or in SOS mode.
    - **Verification Table**: A dedicated workflow area for reviewing driver identity documents.

### [rider-dashboard-v2.html](file:///d:/Projects/Hack-A-Thon/TrustMeBro/dashboard/rider-dashboard-v2.html) & [driver-dashboard-v2.html](file:///d:/Projects/Hack-A-Thon/TrustMeBro/dashboard/driver-dashboard-v2.html)
- **Contextual UIs**: Both dashboards dynamically change layout based on state. For example, if a ride is active, they show a "View Active Trip" shortcut.

---

## ☁️ 7. Backend Logic (Firebase Functions)

### [functions/index.js](file:///d:/Projects/Hack-A-Thon/TrustMeBro/functions/index.js)
- **Purpose**: Server-side triggers for security-sensitive operations.
- **Key Triggers**:
    - `onRideCreated`: Automatically cleans up stale requests.
    - `onSOSAlert`: Can be expanded to trigger external webhooks (e.g., local police API).
    - `calculateDailyEarnings`: Scheduled function that aggregates driver revenue.
