// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, GoogleAuthProvider, signInWithPopup, FacebookAuthProvider } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Get URL parameters to determine role and mode
const urlParams = new URLSearchParams(window.location.search);
const role = urlParams.get('role') || 'rider';
// Auto-detect registration mode if on register.html or if extended registration fields exist
let mode = urlParams.get('mode') || 'login';
if (window.location.pathname.includes('register.html') || document.getElementById('firstName') !== null) {
    mode = 'register';
}

// DOM Elements
const roleBadge = document.getElementById('roleBadge');
const switchModeLink = document.getElementById('switchModeLink');
const authTitle = document.querySelector('.auth-title');
const form = document.getElementById('authForm') || document.getElementById('registrationForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const togglePassword = document.getElementById('togglePassword');
const rememberMeCheckbox = document.getElementById('rememberMe');

// Update UI based on role and mode (only if elements exist)
if (roleBadge) {
    roleBadge.textContent = `${capitalize(role)} ${capitalize(mode)}`;
}
if (switchModeLink) {
    switchModeLink.textContent = mode === 'login' ? 'New here? Create account' : 'Already have an account? Sign in';
}

// Update title based on mode (only if element exists)
if (authTitle) {
    authTitle.textContent = mode === 'login' ? 'Welcome Back' : 'Create Your Account';
}

// Helper function to capitalize first letter
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Toggle password visibility (only if element exists)
if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', function () {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    });
}

// Validate form inputs
function validateForm() {
    let isValid = true;

    // Only validate if elements exist
    if (emailInput && emailError) {
        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailInput.value)) {
            emailInput.classList.add('error');
            emailError.style.display = 'block';
            isValid = false;
        } else {
            emailInput.classList.remove('error');
            emailError.style.display = 'none';
        }
    }

    // Only validate if elements exist
    if (passwordInput && passwordError && submitBtn) {
        // Password validation with strength requirements
        const passwordStrength = validatePasswordStrength(passwordInput.value);
        if (!passwordStrength.isValid) {
            passwordInput.classList.add('error');
            passwordError.style.display = 'block';
            passwordError.textContent = passwordStrength.message;
            isValid = false;
        } else {
            passwordInput.classList.remove('error');
            passwordError.style.display = 'none';
        }

        // Enable/disable submit button
        if (isValid) {
            submitBtn.classList.add('enabled');
            submitBtn.disabled = false;
        } else {
            submitBtn.classList.remove('enabled');
            submitBtn.disabled = true;
        }
    }

    return isValid;
}

// Password strength validation function
function validatePasswordStrength(password) {
    if (password.length < 6) {
        return {
            isValid: false,
            message: 'Password must be at least 6 characters'
        };
    }

    // Check for at least one uppercase, lowercase, number, and special character
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
        return {
            isValid: false,
            message: 'Password must contain uppercase, lowercase, number, and special character'
        };
    }

    return {
        isValid: true,
        message: ''
    };
}

// Add event listeners for real-time validation (only if elements exist)
if (emailInput && typeof validateForm === 'function') {
    emailInput.addEventListener('input', validateForm);
}
if (passwordInput && typeof validateForm === 'function') {
    passwordInput.addEventListener('input', validateForm);
}

// Load saved credentials if "Remember Me" was previously selected
if (rememberMeCheckbox) {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedPassword = localStorage.getItem('rememberedPassword');
    const isRemembered = localStorage.getItem('rememberMe') === 'true';

    if (savedEmail && isRemembered) {
        emailInput.value = savedEmail;
        if (savedPassword) {
            passwordInput.value = savedPassword;
            rememberMeCheckbox.checked = true;
            validateForm(); // Trigger validation to enable submit button if valid
        }
    }
}

// Function to display error messages in a user-friendly way
function displayErrorMessage(message) {
    // Create or update error display element
    let errorElement = document.getElementById('auth-error-message');

    if (!errorElement) {
        // Create error element if it doesn't exist
        errorElement = document.createElement('div');
        errorElement.id = 'auth-error-message';
        errorElement.className = 'error-message-global';
        errorElement.style.cssText = `
            background: #fee;
            color: #c33;
            padding: 12px 16px;
            border-radius: 8px;
            margin: 15px 0;
            border-left: 4px solid #c33;
            display: none;
            animation: fadeIn 0.3s ease;
        `;

        // Insert after the form
        form.parentNode.insertBefore(errorElement, form.nextSibling);
    }

    errorElement.textContent = message;
    errorElement.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }, 5000);
}

// Function to show/hide loading state with spinner
function showLoadingState(show, customMessage = null) {
    if (submitBtn) {
        if (show) {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            submitBtn.disabled = true;
        } else {
            submitBtn.innerHTML = customMessage || 'Continue Securely';
            submitBtn.disabled = false;
        }
    }
}

// Social login functionality
document.addEventListener('DOMContentLoaded', function () {
    const googleLoginBtn = document.getElementById('googleLogin');
    const facebookLoginBtn = document.getElementById('facebookLogin');

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            await handleSocialLogin('google');
        });
    }

    if (facebookLoginBtn) {
        facebookLoginBtn.addEventListener('click', async function (e) {
            e.preventDefault();
            await handleSocialLogin('facebook');
        });
    }
});

// Handle social login
async function handleSocialLogin(providerName) {
    try {
        let provider;

        if (providerName === 'google') {
            provider = new GoogleAuthProvider();
        } else if (providerName === 'facebook') {
            provider = new FacebookAuthProvider();
        } else {
            throw new Error('Unsupported provider');
        }

        // Show loading state
        showLoadingState(true, `Signing in with ${providerName}...`);

        // Perform social login
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Save user info to Firestore if it doesn't exist
        await saveUserInfoToFirestore(user);

        // Fetch user document to verify role and account status
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();

            // Check if account is suspended
            if (userData.accountStatus === 'suspended') {
                showLoadingState(false);
                displayErrorMessage('Your account has been suspended. Please contact support.');
                setTimeout(() => {
                    signOut(auth); // Automatically sign out suspended users
                }, 3000);
                return;
            }

            // Redirect to dashboard based on user's actual role from Firestore
            setTimeout(() => {
                const userRole = userData.role || 'rider';
                if (userRole === 'rider') {
                    window.location.href = '../dashboard/rider-dashboard-v2.html';
                } else if (userRole === 'driver') {
                    window.location.href = '../dashboard/driver-dashboard-v2.html';
                } else if (userRole === 'admin') {
                    window.location.href = '../dashboard/admin-dashboard-v2.html';
                } else {
                    window.location.href = '../dashboard/rider-dashboard-v2.html';
                }
            }, 1000);
        } else {
            showLoadingState(false);
            displayErrorMessage('User data not found. Please contact support.');
        }
    } catch (error) {
        console.error('Social login error:', error);

        let errorMessage = 'An error occurred during social login. Please try again.';
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Login popup was closed. Please try again.';
        } else if (error.code === 'auth/cancelled-popup-request') {
            errorMessage = 'Login request was cancelled. Please try again.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage = 'Network error. Please check your connection and try again.';
        }

        showLoadingState(false);
        displayErrorMessage(errorMessage);
    }
}

// Save user info to Firestore if it doesn't exist
async function saveUserInfoToFirestore(user) {
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
            // Save basic user info to Firestore
            await setDoc(userDocRef, {
                uid: user.uid,
                displayName: user.displayName || '',
                email: user.email,
                photoURL: user.photoURL || '',
                emailVerified: user.emailVerified,
                role: role,
                createdAt: new Date(),
                provider: user.providerData[0]?.providerId || 'unknown'
            });
        }
    } catch (error) {
        console.error('Error saving user info to Firestore:', error);
    }
}

// Form submission (only if form element exists)
if (form) {
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        if (validateForm()) {
            // Show loading state
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Processing...';
            submitBtn.disabled = true;

            try {
                if (mode === 'login') {
                    // Show loading state with spinner
                    showLoadingState(true);

                    // Sign in with email and password
                    const userCredential = await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
                    const user = userCredential.user;

                    // For login, allow users to proceed even if email is not verified
                    // This addresses the issue where registered users can't log in due to verification requirement

                    // Save credentials if "Remember Me" is checked
                    if (rememberMeCheckbox && rememberMeCheckbox.checked) {
                        localStorage.setItem('rememberedEmail', emailInput.value);
                        localStorage.setItem('rememberedPassword', passwordInput.value);
                        localStorage.setItem('rememberMe', 'true');
                    } else {
                        // Clear saved credentials if "Remember Me" is not checked
                        localStorage.removeItem('rememberedEmail');
                        localStorage.removeItem('rememberedPassword');
                        localStorage.removeItem('rememberMe');
                    }

                    // Show success message before redirect
                    showLoadingState(false, 'Logging in...');

                    // Fetch user document to verify role and account status
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();

                        // Check if account is suspended
                        if (userData.accountStatus === 'suspended') {
                            showLoadingState(false);
                            displayErrorMessage('Your account has been suspended. Please contact support.');
                            setTimeout(() => {
                                signOut(auth); // Automatically sign out suspended users
                            }, 3000);
                            return;
                        }

                        // Redirect to dashboard based on user's actual role from Firestore
                        setTimeout(() => {
                            const userRole = userData.role || 'rider';
                            if (userRole === 'rider') {
                                window.location.href = '../dashboard/rider-dashboard-v2.html';
                            } else if (userRole === 'driver') {
                                window.location.href = '../dashboard/driver-dashboard-v2.html';
                            } else if (userRole === 'admin') {
                                window.location.href = '../dashboard/admin-dashboard-v2.html';
                            } else {
                                window.location.href = '../dashboard/rider-dashboard-v2.html';
                            }
                        }, 1000);
                    } else {
                        showLoadingState(false);
                        displayErrorMessage('User data not found. Please contact support.');
                    }
                } else {
                    // Check if we're on the extended registration form
                    const isExtendedRegistration = document.getElementById('firstName') !== null;
                    console.log("Is extended registration:", isExtendedRegistration);

                    if (isExtendedRegistration) {
                        console.log("Extended registration detected, collecting form data...");
                        // Handle extended registration with additional details
                        const formData = {
                            firstName: document.getElementById('firstName').value,
                            lastName: document.getElementById('lastName').value,
                            dateOfBirth: document.getElementById('dateOfBirth').value,
                            gender: document.getElementById('gender').value,
                            phone: document.getElementById('phone').value,
                            address: document.getElementById('address').value,
                            email: emailInput.value,
                            password: passwordInput.value,
                            fatherName: document.getElementById('fatherName')?.value || '',
                            motherName: document.getElementById('motherName')?.value || '',
                            spouseName: document.getElementById('spouseName')?.value || '',
                            noOfDependents: document.getElementById('noOfDependents')?.value || 0,
                            emergencyContacts: []
                        };
                        console.log("Collected form data:", formData);

                        // Collect emergency contacts
                        const emergencyForms = document.querySelectorAll('.emergency-contact-form');
                        emergencyForms.forEach((form, index) => {
                            const contact = {
                                name: document.getElementById(`emergencyContactName${index + 1}`)?.value || '',
                                relation: document.getElementById(`emergencyContactRelation${index + 1}`)?.value || '',
                                phone: document.getElementById(`emergencyContactPhone${index + 1}`)?.value || '',
                                address: document.getElementById(`emergencyContactAddress${index + 1}`)?.value || ''
                            };
                            if (contact.name && contact.phone) { // Only add if name and phone are provided
                                formData.emergencyContacts.push(contact);
                            }
                        });

                        // Show loading state during registration
                        showLoadingState(true, 'Creating account...');

                        // Create new user
                        const userCredential = await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
                        const user = userCredential.user;

                        // Store additional user data in Firestore
                        try {
                            console.log("Attempting to save user data to Firestore for user:", user.uid);
                            await setDoc(doc(db, "users", user.uid), {
                                uid: user.uid,
                                firstName: formData.firstName,
                                lastName: formData.lastName,
                                dateOfBirth: formData.dateOfBirth,
                                gender: formData.gender,
                                phone: formData.phone,
                                address: formData.address,
                                email: formData.email,
                                fatherName: formData.fatherName,
                                motherName: formData.motherName,
                                spouseName: formData.spouseName,
                                noOfDependents: parseInt(formData.noOfDependents),
                                emergencyContacts: formData.emergencyContacts,
                                role: role,
                                createdAt: new Date()
                            });

                            console.log("User data saved to Firestore successfully!", user.uid);
                        } catch (dbError) {
                            console.error("Error saving user data to Firestore:", dbError);
                            displayErrorMessage("Account created but profile data could not be saved. Please contact support.");
                        }

                        // Send email verification
                        await sendEmailVerification(user);

                        showLoadingState(false, 'Account Created!');

                        // Show success message before redirect
                        displayErrorMessage('Account created successfully! Please check your email to verify your account.');

                        // Redirect to login after a delay
                        setTimeout(() => {
                            window.location.href = `?role=${role}&mode=login`;
                        }, 2000);
                    } else {
                        // Handle basic registration (original functionality)
                        showLoadingState(true, 'Creating account...');

                        const userCredential = await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
                        const user = userCredential.user;

                        // Send email verification
                        await sendEmailVerification(user);

                        showLoadingState(false, 'Account Created!');

                        // Show success message before redirect
                        displayErrorMessage('Account created successfully! Please check your email to verify your account.');

                        // Redirect to login after a delay
                        setTimeout(() => {
                            window.location.href = `?role=${role}&mode=login`;
                        }, 2000);
                    }
                }
            } catch (error) {
                console.error('Authentication error:', error);

                // Handle specific error codes with improved messages
                let errorMessage = 'An error occurred. Please try again.';
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = 'This email is already registered. Please sign in instead.';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = 'Please enter a valid email address.';
                } else if (error.code === 'auth/wrong-password') {
                    errorMessage = 'Incorrect password. Please try again.';
                } else if (error.code === 'auth/user-not-found') {
                    errorMessage = 'No account found with this email. Please check or create an account.';
                } else if (error.code === 'auth/weak-password') {
                    errorMessage = 'Password should be at least 6 characters and contain uppercase, lowercase, number, and special character.';
                } else if (error.code === 'auth/too-many-requests') {
                    errorMessage = 'Too many failed attempts. Please try again later.';
                } else if (error.code === 'auth/network-request-failed') {
                    errorMessage = 'Network error. Please check your connection and try again.';
                } else if (error.code === 'auth/user-disabled') {
                    errorMessage = 'This account has been disabled. Please contact support.';
                }

                // Display error in a more user-friendly way
                displayErrorMessage(errorMessage);
            } finally {
                // Reset button (only if element exists)
                if (submitBtn) {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }
            }
        }
    });
}

// Switch between login and register modes (only if element exists)
if (switchModeLink) {
    switchModeLink.addEventListener('click', function (e) {
        e.preventDefault();

        // If on login mode, redirect to register page with role
        if (mode === 'login') {
            window.location.href = `../public/register.html?role=${role}`;
        } else {
            // If on register mode, go back to login
            const newUrl = `?role=${role}&mode=login`;
            window.location.href = newUrl;
        }
    });
}