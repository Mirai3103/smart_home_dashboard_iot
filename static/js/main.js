/**
 * Main JavaScript file for Smart Home Dashboard
 * Contains global utilities and initialization logic
 */

// Use IIFE to avoid global namespace pollution
(function() {
    // Global variables
    
    // Use the global deviceData store
    window.smartHome = window.smartHome || {};
    // Ensure we don't override existing deviceData if socket_handler.js already ran
    window.smartHome.deviceData = window.smartHome.deviceData || {};
    
    // Initialize when the document is ready
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Main script initialized');
        
        // Initialize components based on page
        initPageComponents();
    });
    
    // Initialize different components based on current page
    function initPageComponents() {
        // Check which page we're on based on body classes or URL
        const path = window.location.pathname;
        
        if (path === '/' || path.includes('dashboard')) {
            console.log('Dashboard page detected');
            // Dashboard specific initializations
        } else if (path.includes('devices')) {
            console.log('Devices page detected');
            // Devices page specific initializations
        } else if (path.includes('history')) {
            console.log('History page detected');
            // History page specific initializations
        }
    }
    
    // Expose functions to global scope (safely)
    window.smartHome = window.smartHome || {};
    window.smartHome.getDeviceData = (deviceId) => deviceId ? 
        window.smartHome.deviceData[deviceId] || [] : 
        window.smartHome.deviceData;
})();