/**
 * Common admin functions for CRUD operations
 */

// Helper to show alert messages
function showAlert(message, type = 'success') {
    const alertDiv = $(`<div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${message}
        <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
        </button>
    </div>`);
    
    // Add to top of page
    $('#main-content').prepend(alertDiv);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.alert('close');
    }, 5000);
}

// Helper for AJAX error handling
function handleAjaxError(xhr) {
    console.error('AJAX Error:', xhr);
    let errorMsg = 'Unknown error occurred';
    
    try {
        if (xhr.responseJSON && xhr.responseJSON.error) {
            errorMsg = xhr.responseJSON.error;
        } else if (xhr.statusText) {
            errorMsg = xhr.statusText;
        }
    } catch (e) {
        console.error('Error parsing error response:', e);
    }
    
    showAlert('Error: ' + errorMsg, 'danger');
    return errorMsg;
}

// Standard form validation
function validateForm(formSelector, requiredFields = []) {
    let valid = true;
    
    // Check specific fields if provided
    if (requiredFields.length > 0) {
        requiredFields.forEach(field => {
            const input = $(`${formSelector} [name=${field}]`);
            if (!input.val()) {
                input.addClass('is-invalid');
                valid = false;
            } else {
                input.removeClass('is-invalid');
            }
        });
    } else {
        // Check all required inputs
        $(`${formSelector} [required]`).each(function() {
            if (!$(this).val()) {
                $(this).addClass('is-invalid');
                valid = false;
            } else {
                $(this).removeClass('is-invalid');
            }
        });
    }
    
    if (!valid) {
        showAlert('Please fill out all required fields', 'warning');
    }
    
    return valid;
}
