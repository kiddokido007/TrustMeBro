# TrustMeBro Rider Dashboard - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Firebase project configured (already set up in code)
- Modern web browser with JavaScript enabled
- Local web server (Firebase Hosting, Python HTTP server, or similar)

### Installation

1. **Clone/Navigate to Project**
   ```bash
   cd d:\Projects\Hack-A-Thon\TrustMeBro
   ```

2. **Start Local Server**
   ```bash
   # Option 1: Firebase Hosting
   firebase serve

   # Option 2: Python HTTP Server
   python -m http.server 8000

   # Option 3: Node.js HTTP Server
   npx http-server
   ```

3. **Access Dashboard**
   ```
   http://localhost:8000/dashboard/rider-dashboard-v2.html
   ```

## 📱 Using the Dashboard

### First Time Setup

1. **Create Account**
   - Go to `http://localhost:8000/public/register.html?role=rider`
   - Fill in registration form
   - Verify email (check console for verification link)

2. **Login**
   - Go to `http://localhost:8000/public/auth.html?role=rider`
   - Enter credentials
   - Auto-redirected to dashboard

### Booking a Ride

1. **Set Locations**
   - Pickup: Auto-detected (or enter manually)
   - Drop: Enter destination address

2. **View Fare**
   - Fare automatically calculated
   - Night surcharge applied if 10 PM - 6 AM

3. **Book Ride**
   - Click "Book Ride" button
   - Wait for driver assignment (~30-60 seconds)

4. **Start Trip**
   - Share entry OTP with driver
   - Click "Start Trip" when ready

5. **Complete Trip**
   - Share exit OTP at destination
   - Click "End Trip"
   - Rate driver (1-5 stars)

## 🔒 Security Features

### OTP System
- **Entry OTP:** 6-digit code to start ride
- **Exit OTP:** 6-digit code to complete ride
- Both required for trip verification

### Emergency SOS
- Red button always visible
- One-tap activation
- Alerts admin + emergency contacts
- Shares current GPS location

### Night Safety Checks
- Active 10 PM - 6 AM
- Periodic "Are you safe?" prompts
- Auto-escalates if no response
- Triggers SOS after 3 minutes

## 📁 File Structure

```
TrustMeBro/
├── dashboard/
│   └── rider-dashboard-v2.html ← Main dashboard
├── scripts/
│   ├── rider-dashboard.js ← Auth & profile
│   ├── notifications.js ← Real-time notifications
│   ├── safety-system.js ← SOS & night checks
│   └── ride-booking.js ← Booking & OTP
├── styles/
│   ├── main.css ← Global styles
│   └── rider-dashboard.css ← Dashboard styles
└── public/
    ├── auth.html ← Login page
    └── register.html ← Registration page
```

## 🧪 Testing

### Create Test Data

1. **Test Rider Account**
   ```
   Email: rider@test.com
   Password: Test@123
   ```

2. **Test Driver Account** (create in Firestore)
   ```javascript
   {
     role: "driver",
     isVerified: true,
     isAvailable: true,
     firstName: "John",
     lastName: "Doe",
     rating: 4.8,
     vehicle: {
       make: "Honda",
       model: "Civic",
       licensePlate: "ABC 123"
     },
     currentLocation: {
       latitude: 13.0827,
       longitude: 80.2750
     }
   }
   ```

### Test Scenarios

1. **Day Ride**
   - Book ride during 6 AM - 10 PM
   - Verify no night surcharge
   - No safety checks

2. **Night Ride**
   - Book ride during 10 PM - 6 AM
   - Verify 25% night surcharge
   - Safety checks every 10 minutes
   - Test auto-SOS escalation

3. **Emergency SOS**
   - Click SOS button during trip
   - Verify alert sent
   - Check Firestore for SOS document

## 🐛 Troubleshooting

### Dashboard Not Loading
- Check browser console for errors
- Verify Firebase config is correct
- Ensure local server is running

### Location Not Detected
- Allow location permissions in browser
- Check HTTPS (required for geolocation)
- Fallback: Enter location manually

### Driver Not Found
- Create test driver in Firestore
- Set `isAvailable: true` and `isVerified: true`
- Add `currentLocation` coordinates

### OTP Not Showing
- Check ride document in Firestore
- Verify `entryOTP` and `exitOTP` fields
- Refresh dashboard

## 📚 Documentation

- **Implementation Plan:** `implementation_plan.md`
- **Walkthrough:** `walkthrough.md`
- **Task Breakdown:** `task.md`

## 🔗 Useful Links

- [Firebase Console](https://console.firebase.google.com/)
- [Leaflet Documentation](https://leafletjs.com/)
- [OpenStreetMap](https://www.openstreetmap.org/)

## 💡 Tips

1. **Use Chrome DevTools** for debugging
2. **Check Firestore** for data verification
3. **Monitor Console** for real-time logs
4. **Test on Mobile** for responsive design
5. **Clear Cache** if changes not reflecting

## 🎯 Next Steps

1. Test all features thoroughly
2. Add Google Maps API key for production
3. Integrate SMS notifications (Twilio)
4. Add payment gateway (Stripe)
5. Deploy to Firebase Hosting

## 📞 Support

For issues or questions:
1. Check browser console for errors
2. Review Firestore security rules
3. Verify Firebase configuration
4. Test with different browsers

---

**Happy Riding! 🚕**
