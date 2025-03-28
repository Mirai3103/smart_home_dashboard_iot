/**
 * Home Access Fix - A utility to diagnose and fix issues with 
 * device visibility in the Smart Home Dashboard
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Home Access Fix loaded');
    setTimeout(checkDeviceVisibility, 1000);
});

function checkDeviceVisibility() {
    // Get device counts from different sources
    const domDeviceCount = document.querySelectorAll('.device-card').length;
    const template = getTemplateDeviceCount();
    
    console.log(`Device count - DOM: ${domDeviceCount}, Template: ${template}`);
    
    // Check if there's a mismatch between template and DOM
    if (template > 0 && domDeviceCount === 0) {
        console.warn('Device count mismatch detected. Attempting to fix...');
        
        // Find rooms that might have devices but aren't showing them
        const rooms = document.querySelectorAll('.card-header:has(h5)');
        let roomCount = 0;
        
        rooms.forEach(roomHeader => {
            const roomName = roomHeader.querySelector('h5').textContent.trim();
            const roomCard = roomHeader.closest('.card');
            if (!roomCard) return;
            
            const roomBody = roomCard.querySelector('.card-body');
            if (!roomBody) return;
            
            roomCount++;
            
            // Check if this room has "No devices found in this room" message
            const noDevicesMsg = roomBody.querySelector('.alert.alert-info');
            if (noDevicesMsg && noDevicesMsg.textContent.includes('No devices found in this room')) {
                console.log(`Room "${roomName}" shows no devices message`);
            }
        });
        
        console.log(`Found ${roomCount} rooms in the UI`);
        
        // Check home access
        checkHomeAccess();
        
        // Force a refresh of the page after 5 seconds if fixes don't work
        if (roomCount === 0) {
            console.warn('No rooms found! Will attempt to refresh page in 5 seconds...');
            setTimeout(() => {
                refreshDashboard();
            }, 5000);
        }
    }
}

function getTemplateDeviceCount() {
    // Try to get the total_devices variable from the page
    try {
        // Look for it in console logs
        const logs = [];
        const originalConsoleLog = console.log;
        console.log = function() {
            logs.push(Array.from(arguments).join(' '));
            originalConsoleLog.apply(console, arguments);
        };
        
        // Restore original console.log after brief timeout
        setTimeout(() => {
            console.log = originalConsoleLog;
        }, 100);
        
        // Check for debug info in scripts
        const deviceCountMatches = [];
        document.querySelectorAll('script').forEach(script => {
            const content = script.textContent;
            const match = content.match(/total_devices.*?(\d+)/);
            if (match && match[1]) {
                deviceCountMatches.push(parseInt(match[1]));
            }
        });
        
        if (deviceCountMatches.length > 0) {
            return Math.max(...deviceCountMatches);
        }
        
        // Look for it in the stat-card
        const statCard = document.querySelector('.stat-card-value');
        if (statCard) {
            const count = parseInt(statCard.textContent);
            if (!isNaN(count)) {
                return count;
            }
        }
        
        return 0;
    } catch (e) {
        console.error('Error getting template device count:', e);
        return 0;
    }
}

function checkHomeAccess() {
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const homeId = urlParams.get('home_id');
    
    console.log(`Checking home access. Current home_id: ${homeId || 'None (using default)'}`);
    
    // Verify if current_home exists in the page
    const homeInfo = document.querySelector('.card-header:has(h5)');
    if (homeInfo) {
        const homeName = homeInfo.querySelector('h5').textContent.trim();
        console.log(`Current home in UI: ${homeName}`);
    } else {
        console.warn('Home info not found in UI!');
    }
    
    // Check if we need to redirect to select a specific home
    const selectHomeLinks = document.querySelectorAll('.dropdown-item');
    if (selectHomeLinks.length > 0 && !homeId) {
        console.log('Multiple homes available. Should select a specific one:');
        selectHomeLinks.forEach(link => {
            console.log(`- ${link.textContent.trim()}: ${link.href}`);
        });
        
        // If we have exactly one home, automatically redirect
        if (selectHomeLinks.length === 1) {
            const onlyHomeLink = selectHomeLinks[0];
            console.log(`Auto-selecting only available home: ${onlyHomeLink.textContent.trim()}`);
            
            // Redirect to the only home
            window.location.href = onlyHomeLink.href;
        }
    }
}

function refreshDashboard() {
    // Add a parameter to force reload and avoid cache
    const url = new URL(window.location);
    url.searchParams.set('refresh', Date.now());
    window.location.href = url.toString();
}

// Add these functions to global namespace for console debugging
window.homeAccessFix = {
    checkDeviceVisibility,
    getTemplateDeviceCount,
    checkHomeAccess,
    refreshDashboard
};
