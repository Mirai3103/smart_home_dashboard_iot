/**
 * Debug Helper for Smart Home Dashboard
 * This script provides debugging tools for identifying issues with device display
 */

// Create a global debug namespace
window.smartHomeDebug = {};

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Debug helper loaded');
    initDebugTools();
});

function initDebugTools() {
    // Add a debug button to the page
    addDebugButton();
    
    // Capture any template rendering errors
    checkForTemplateErrors();
    
    // Check device counts from different sources
    validateDeviceCounts();
}

function addDebugButton() {
    // Only add for admin users
    if (!document.body.classList.contains('is-admin') && 
        !document.querySelector('.badge.bg-success')) {
        return;
    }
    
    const debugButton = document.createElement('button');
    debugButton.className = 'btn btn-sm btn-warning position-fixed';
    debugButton.style.bottom = '20px';
    debugButton.style.left = '20px';
    debugButton.style.zIndex = '1000';
    debugButton.innerHTML = '<i class="fas fa-bug"></i> Debug';
    debugButton.onclick = showDebugPanel;
    
    document.body.appendChild(debugButton);
}

function showDebugPanel() {
    // Create modal with debug information
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'debugModal';
    modal.setAttribute('tabindex', '-1');
    
    const debugInfo = collectDebugInfo();
    
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header bg-warning">
                    <h5 class="modal-title">Dashboard Debug Information</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <h6>Device Counts</h6>
                    <ul>
                        <li>Total devices in DOM: ${debugInfo.deviceCount}</li>
                        <li>Floors: ${debugInfo.floorCount}</li>
                        <li>Rooms: ${debugInfo.roomCount}</li>
                    </ul>
                    
                    <h6>Template Variables</h6>
                    <div class="alert alert-secondary">
                        <pre>${JSON.stringify(debugInfo.templateVars, null, 2)}</pre>
                    </div>
                    
                    <h6>Actions</h6>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" id="refreshDashboard">Refresh Dashboard</button>
                        <button class="btn btn-sm btn-secondary" id="toggleNoDevicesMsg">Toggle No Devices Message</button>
                        <button class="btn btn-sm btn-info" id="countDevicesBtn">Count Devices</button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Initialize Bootstrap modal
    const modalInstance = new bootstrap.Modal(document.getElementById('debugModal'));
    modalInstance.show();
    
    // Add event listeners for debug actions
    document.getElementById('refreshDashboard').addEventListener('click', () => {
        window.location.reload();
    });
    
    document.getElementById('toggleNoDevicesMsg').addEventListener('click', () => {
        const noDevicesMsg = document.querySelector('.alert.alert-info');
        if (noDevicesMsg) {
            noDevicesMsg.style.display = noDevicesMsg.style.display === 'none' ? 'block' : 'none';
        }
    });
    
    document.getElementById('countDevicesBtn').addEventListener('click', () => {
        const result = validateDeviceCounts(true);
        alert(`Found ${result.deviceCount} devices in DOM\nExpected: 29 devices`);
    });
}

function collectDebugInfo() {
    const deviceCards = document.querySelectorAll('.device-card');
    const floors = document.querySelectorAll('.floor-container');
    const rooms = document.querySelectorAll('.card-header h5:contains("Room")');
    
    // Try to extract template variables
    const templateVars = {};
    try {
        // Look for any debug info in comments
        const comments = [];
        const commentIterator = document.createNodeIterator(
            document.body,
            NodeFilter.SHOW_COMMENT
        );
        let comment;
        while (comment = commentIterator.nextNode()) {
            if (comment.textContent.includes('debug') || 
                comment.textContent.includes('template')) {
                comments.push(comment.textContent);
            }
        }
        templateVars.comments = comments;
        
        // Check for unrendered templates
        const bodyHTML = document.body.innerHTML;
        const unrenderedTemplates = bodyHTML.match(/\{%.*?%\}/g) || [];
        templateVars.unrenderedTemplates = unrenderedTemplates;
        
    } catch (e) {
        templateVars.error = e.message;
    }
    
    return {
        deviceCount: deviceCards.length,
        floorCount: floors.length,
        roomCount: rooms.length,
        templateVars: templateVars
    };
}

function checkForTemplateErrors() {
    // Check for unrendered Jinja templates
    const bodyContent = document.body.innerHTML;
    const jinjaPattern = /\{%\s*.*?\s*%\}/g;
    const matches = bodyContent.match(jinjaPattern);
    
    if (matches && matches.length > 0) {
        console.error('Found unrendered Jinja templates:', matches);
        if (window.showToast) {
            window.showToast('Template rendering error detected: Some template code was not properly processed.', 'danger');
        }
    }
}

function validateDeviceCounts(showResult = false) {
    // Count devices in DOM
    const deviceCards = document.querySelectorAll('.device-card');
    const deviceCount = deviceCards.length;
    
    // Count total_devices from template if available
    let templateDeviceCount = null;
    try {
        // Look for any element with total_devices in a comment or attribute
        const scriptElements = document.querySelectorAll('script');
        for (const script of scriptElements) {
            if (script.textContent.includes('total_devices')) {
                const match = script.textContent.match(/total_devices.*?(\d+)/);
                if (match && match[1]) {
                    templateDeviceCount = parseInt(match[1]);
                    break;
                }
            }
        }
    } catch (e) {
        console.error('Error parsing template device count:', e);
    }
    
    const result = {
        deviceCount: deviceCount,
        templateDeviceCount: templateDeviceCount,
        expected: 29, // From SQL query
        mismatch: deviceCount !== 29
    };
    
    if (showResult) {
        console.log('Device count validation:', result);
    }
    
    if (result.mismatch && window.showToast) {
        window.showToast(`Device count mismatch: Found ${deviceCount} in DOM, expected 29.`, 'warning');
    }
    
    return result;
}

// Helper function: Extended version of querySelector for :contains
if (!window.jQuery) {
    // Add simple implementation of contains selector
    Element.prototype.querySelectorAll = (function(orig) {
        return function(selector) {
            if (selector.includes(':contains')) {
                // Extract the text to search for
                const parts = selector.split(':contains(');
                const baseSelector = parts[0];
                const searchText = parts[1].slice(0, -1).replace(/["']/g, '');
                
                // Get all elements matching the base selector
                const elements = orig.call(this, baseSelector);
                
                // Filter by text content
                return Array.from(elements).filter(el => 
                    el.textContent.includes(searchText)
                );
            }
            return orig.call(this, selector);
        };
    })(Element.prototype.querySelectorAll);
}
