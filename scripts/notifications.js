// Notifications System Module
// Handles real-time notifications for rider dashboard

import { getFirestore, collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

export class NotificationSystem {
    constructor(app, userId) {
        this.db = getFirestore(app);
        this.userId = userId;
        this.notifications = [];
        this.unreadCount = 0;
        this.unsubscribe = null;
    }

    // Initialize notification system
    init() {
        this.setupRealtimeListener();
        this.setupEventListeners();
    }

    // Setup real-time listener for notifications
    setupRealtimeListener() {
        const notificationsRef = collection(this.db, "notifications");
        const q = query(
            notificationsRef,
            where("userId", "==", this.userId),
            orderBy("timestamp", "desc")
        );

        this.unsubscribe = onSnapshot(q, (snapshot) => {
            this.notifications = [];
            this.unreadCount = 0;

            snapshot.forEach((doc) => {
                const notification = {
                    id: doc.id,
                    ...doc.data()
                };
                this.notifications.push(notification);

                if (!notification.read) {
                    this.unreadCount++;
                }
            });

            this.updateUI();
        }, (error) => {
            console.error("Error listening to notifications:", error);
        });
    }

    // Update UI with notifications
    updateUI() {
        this.updateBadge();
        this.updatePanel();
    }

    // Update notification badge
    updateBadge() {
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // Update notification panel
    updatePanel() {
        const panel = document.getElementById('notificationsPanel');
        if (!panel) return;

        // Clear existing notifications
        panel.innerHTML = '';

        if (this.notifications.length === 0) {
            panel.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: #64748B;">
                    <i class="fas fa-bell-slash" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                    <p>No notifications</p>
                </div>
            `;
            return;
        }

        // Add header with clear all button
        const header = document.createElement('div');
        header.style.cssText = 'padding: 1rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;';
        header.innerHTML = `
            <strong>Notifications</strong>
            <button id="clearAllNotifications" style="background: none; border: none; color: var(--accent); cursor: pointer; font-size: 0.85rem;">
                Clear All
            </button>
        `;
        panel.appendChild(header);

        // Add notifications
        this.notifications.forEach(notification => {
            const item = this.createNotificationItem(notification);
            panel.appendChild(item);
        });

        // Setup clear all button
        const clearAllBtn = document.getElementById('clearAllNotifications');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => this.clearAllNotifications());
        }
    }

    // Create notification item element
    createNotificationItem(notification) {
        const item = document.createElement('div');
        item.className = `notification-item ${!notification.read ? 'unread' : ''}`;
        item.style.cssText = `
            padding: 1rem;
            border-bottom: 1px solid #eee;
            cursor: pointer;
            transition: background 0.2s;
            ${!notification.read ? 'background: #f8fafc;' : ''}
        `;

        const icon = this.getNotificationIcon(notification.type);
        const timeAgo = this.getTimeAgo(notification.timestamp);

        item.innerHTML = `
            <div style="display: flex; gap: 0.8rem; align-items: start;">
                <div style="font-size: 1.2rem; color: ${this.getNotificationColor(notification.type)};">
                    ${icon}
                </div>
                <div style="flex: 1;">
                    <strong style="display: block; margin-bottom: 0.3rem;">${notification.title}</strong>
                    <p style="margin: 0; font-size: 0.9rem; color: #64748B;">${notification.message}</p>
                    <span style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.3rem; display: block;">${timeAgo}</span>
                </div>
                ${!notification.read ? '<div style="width: 8px; height: 8px; background: var(--accent); border-radius: 50%;"></div>' : ''}
            </div>
        `;

        // Mark as read when clicked
        item.addEventListener('click', () => this.markAsRead(notification.id));

        // Add hover effect
        item.addEventListener('mouseenter', () => {
            item.style.background = '#f1f5f9';
        });
        item.addEventListener('mouseleave', () => {
            item.style.background = !notification.read ? '#f8fafc' : 'white';
        });

        return item;
    }

    // Get notification icon based on type
    getNotificationIcon(type) {
        const icons = {
            'driver_assigned': '<i class="fas fa-user-check"></i>',
            'driver_arriving': '<i class="fas fa-car"></i>',
            'trip_started': '<i class="fas fa-play-circle"></i>',
            'trip_completed': '<i class="fas fa-check-circle"></i>',
            'safety_check': '<i class="fas fa-shield-alt"></i>',
            'sos_triggered': '<i class="fas fa-exclamation-triangle"></i>',
            'emergency_resolved': '<i class="fas fa-check-double"></i>',
            'account_verified': '<i class="fas fa-badge-check"></i>',
            'payment_processed': '<i class="fas fa-credit-card"></i>',
            'rating_reminder': '<i class="fas fa-star"></i>',
            'system_message': '<i class="fas fa-info-circle"></i>'
        };
        return icons[type] || '<i class="fas fa-bell"></i>';
    }

    // Get notification color based on type
    getNotificationColor(type) {
        const colors = {
            'driver_assigned': '#2ED573',
            'driver_arriving': '#FF8C00',
            'trip_started': '#002D62',
            'trip_completed': '#2ED573',
            'safety_check': '#FF8C00',
            'sos_triggered': '#FF4757',
            'emergency_resolved': '#2ED573',
            'account_verified': '#2ED573',
            'payment_processed': '#002D62',
            'rating_reminder': '#FFD700',
            'system_message': '#64748B'
        };
        return colors[type] || '#64748B';
    }

    // Get time ago string
    getTimeAgo(timestamp) {
        if (!timestamp) return 'Just now';

        const now = new Date();
        const notificationTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diffMs = now - notificationTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

        return notificationTime.toLocaleDateString();
    }

    // Mark notification as read
    async markAsRead(notificationId) {
        try {
            await updateDoc(doc(this.db, "notifications", notificationId), {
                read: true
            });
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    }

    // Clear all notifications
    async clearAllNotifications() {
        if (!confirm('Are you sure you want to clear all notifications?')) {
            return;
        }

        try {
            const deletePromises = this.notifications.map(notification =>
                deleteDoc(doc(this.db, "notifications", notification.id))
            );
            await Promise.all(deletePromises);
        } catch (error) {
            console.error("Error clearing notifications:", error);
            alert('Error clearing notifications. Please try again.');
        }
    }

    // Setup event listeners
    setupEventListeners() {
        const notificationBtn = document.getElementById('notificationBtn');
        const notificationsPanel = document.getElementById('notificationsPanel');

        if (notificationBtn && notificationsPanel) {
            notificationBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                notificationsPanel.classList.toggle('active');

                // Close profile panel
                const profilePanel = document.getElementById('profilePanel');
                if (profilePanel) {
                    profilePanel.classList.remove('active');
                }
            });
        }
    }

    // Send notification (helper method)
    async sendNotification(type, title, message) {
        try {
            await addDoc(collection(this.db, "notifications"), {
                userId: this.userId,
                type: type,
                title: title,
                message: message,
                timestamp: new Date(),
                read: false
            });
        } catch (error) {
            console.error("Error sending notification:", error);
        }
    }

    // Cleanup
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}
