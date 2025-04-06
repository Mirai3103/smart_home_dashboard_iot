/**
 * Dashboard Fix - Helper script to fix common issues
 * This script helps ensure proper display of device data on the dashboard
 */

// Execute immediately
(function() {
    console.log('Dashboard fix script loaded');
    
    // Permanent fix for the "no devices" message
    function permanentlyHideNoDevicesMessage() {
        // Create a style element that will always hide the message
        const style = document.createElement('style');
        style.id = 'no-devices-fix-style';
        style.textContent = `
            #no-devices-message,
            .alert.alert-info:contains("doesn't have any devices registered"),
            .no-devices-hidden {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                overflow: hidden !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
            }
            
            .dashboard-stats {
                display: flex !important;
            }
            
            .floor-container.active {
                display: block !important;
                opacity: 1 !important;
            }
        `;
        document.head.appendChild(style);
        
        // Also directly hide elements
        const noDevicesMessage = document.getElementById('no-devices-message');
        if (noDevicesMessage) {
            noDevicesMessage.style.cssText = 'display: none !important; visibility: hidden !important;';
            noDevicesMessage.classList.add('no-devices-hidden');
        }
        
        document.querySelectorAll('.alert').forEach(alert => {
            if (alert.textContent.toLowerCase().includes("doesn't have any devices registered") ||
                alert.textContent.toLowerCase().includes("no devices")) {
                alert.style.cssText = 'display: none !important; visibility: hidden !important;';
                alert.classList.add('no-devices-hidden');
            }
        });
    }
    
    // Wait for API to confirm devices exist
    function checkApiDeviceCount() {
        const apiDeviceCountEl = document.getElementById('api-device-count');
        if (apiDeviceCountEl && parseInt(apiDeviceCountEl.textContent) > 0) {
            console.log('API confirms devices exist, applying fixes');
            permanentlyHideNoDevicesMessage();
            showDeviceInterface();
            return true;
        }
        return false;
    }
    
    // Show all elements related to device display
    function showDeviceInterface() {
        // Show dashboard stats
        const dashboardStats = document.querySelector('.dashboard-stats');
        if (dashboardStats) {
            dashboardStats.style.display = 'flex';
        }
        
        // Show active floor
        const activeFloor = document.querySelector('.floor-container.active');
        if (activeFloor) {
            activeFloor.style.display = 'block';
            activeFloor.style.opacity = '1';
        } else {
            // If no active floor, make the first one active
            const firstFloor = document.querySelector('.floor-container');
            if (firstFloor) {
                firstFloor.classList.add('active');
                firstFloor.style.display = 'block';
                firstFloor.style.opacity = '1';
            }
        }
        
        // Show filter button
        const filterBtn = document.getElementById('showFilterBtn');
        if (filterBtn) {
            filterBtn.style.display = 'block';
        }
    }
    
    // Setup MutationObserver for API device count
    function setupApiObserver() {
        const apiDeviceCountEl = document.getElementById('api-device-count');
        if (!apiDeviceCountEl) return;
        
        const observer = new MutationObserver(function() {
            if (checkApiDeviceCount()) {
                observer.disconnect();
            }
        });
        
        observer.observe(apiDeviceCountEl, {
            childList: true,
            characterData: true,
            subtree: true
        });
    }
    
    // Initial check
    if (!checkApiDeviceCount()) {
        setupApiObserver();
    }
    
    // Also check on load and after a delay
    window.addEventListener('load', function() {
        checkApiDeviceCount();
        setTimeout(checkApiDeviceCount, 1000);
    });
    
    // Set up a periodic check just to be sure
    setTimeout(function() {
        if (!checkApiDeviceCount()) {
            const checkInterval = setInterval(function() {
                if (checkApiDeviceCount()) {
                    clearInterval(checkInterval);
                }
            }, 500);
            
            // Clear interval after 10 seconds regardless
            setTimeout(function() {
                clearInterval(checkInterval);
            }, 10000);
        }
    }, 1500);
})();
