// Driver Trip Manager Module
// Handles trip lifecycle, OTP verification, and trip status management

import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

export class DriverTripManager {
    constructor(app, driverId) {
        this.db = getFirestore(app);
        this.driverId = driverId;
        this.currentRide = null;
        this.otpAttempts = 0;
        this.maxOtpAttempts = 3;
    }

    // Set current ride
    setCurrentRide(ride) {
        this.currentRide = ride;
        this.otpAttempts = 0;
    }

    // Verify entry OTP
    async verifyEntryOTP(inputOTP) {
        if (!this.currentRide) {
            throw new Error("No active ride");
        }

        try {
            // Fetch latest ride data
            const rideDoc = await getDoc(doc(this.db, "rides", this.currentRide.id));
            if (!rideDoc.exists()) {
                throw new Error("Ride not found");
            }

            const rideData = rideDoc.data();
            const storedOTP = rideData.entryOTP;

            // Verify OTP
            if (inputOTP === storedOTP) {
                // OTP correct - start trip
                await updateDoc(doc(this.db, "rides", this.currentRide.id), {
                    status: "in_progress",
                    startedAt: new Date(),
                    entryOTPVerifiedAt: new Date()
                });

                this.otpAttempts = 0;
                console.log('✅ Entry OTP verified - Trip started');
                return { success: true, message: 'Trip started successfully!' };
            } else {
                // OTP incorrect
                this.otpAttempts++;

                if (this.otpAttempts >= this.maxOtpAttempts) {
                    return {
                        success: false,
                        message: 'Maximum attempts reached. Please contact support.',
                        locked: true
                    };
                }

                return {
                    success: false,
                    message: `Incorrect OTP. ${this.maxOtpAttempts - this.otpAttempts} attempts remaining.`,
                    attemptsLeft: this.maxOtpAttempts - this.otpAttempts
                };
            }
        } catch (error) {
            console.error('Error verifying entry OTP:', error);
            throw error;
        }
    }

    // Verify exit OTP
    async verifyExitOTP(inputOTP) {
        if (!this.currentRide) {
            throw new Error("No active ride");
        }

        try {
            // Fetch latest ride data
            const rideDoc = await getDoc(doc(this.db, "rides", this.currentRide.id));
            if (!rideDoc.exists()) {
                throw new Error("Ride not found");
            }

            const rideData = rideDoc.data();
            const storedOTP = rideData.exitOTP;

            // Verify OTP
            if (inputOTP === storedOTP) {
                // OTP correct - complete trip
                await updateDoc(doc(this.db, "rides", this.currentRide.id), {
                    status: "completed",
                    completedAt: new Date(),
                    exitOTPVerifiedAt: new Date()
                });

                console.log('✅ Exit OTP verified - Trip completed');
                return { success: true, message: 'Trip completed successfully!' };
            } else {
                // OTP incorrect
                this.otpAttempts++;

                if (this.otpAttempts >= this.maxOtpAttempts) {
                    return {
                        success: false,
                        message: 'Maximum attempts reached. Please contact support.',
                        locked: true
                    };
                }

                return {
                    success: false,
                    message: `Incorrect OTP. ${this.maxOtpAttempts - this.otpAttempts} attempts remaining.`,
                    attemptsLeft: this.maxOtpAttempts - this.otpAttempts
                };
            }
        } catch (error) {
            console.error('Error verifying exit OTP:', error);
            throw error;
        }
    }

    // Update trip status
    async updateTripStatus(status) {
        if (!this.currentRide) {
            throw new Error("No active ride");
        }

        try {
            await updateDoc(doc(this.db, "rides", this.currentRide.id), {
                status: status,
                [`${status}At`]: new Date()
            });

            console.log(`✅ Trip status updated to: ${status}`);
        } catch (error) {
            console.error('Error updating trip status:', error);
            throw error;
        }
    }

    // Get current ride
    getCurrentRide() {
        return this.currentRide;
    }

    // Reset OTP attempts
    resetOTPAttempts() {
        this.otpAttempts = 0;
    }
}
