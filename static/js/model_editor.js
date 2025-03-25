/**
 * Generic Model Editor
 * JavaScript for handling generic CRUD operations in the admin panel
 */

class ModelEditor {
    constructor(modelName, primaryField) {
        this.modelName = modelName;
        this.primaryField = primaryField || 'name';
        this.modelFields = [];
        this.modelItem = {};
        this.displayName = this.formatDisplayName(modelName);
        
        this.initialize();
    }
    
    initialize() {
        // Load model fields from first item if available
        this.loadModelStructure();
        
        // Set up event handlers
        this.setupEventHandlers();
        
        // Set up search functionality
        this.setupSearch();
    }
    
    loadModelStructure() {
        const firstItemId = $('#tableHeader').data('first-item-id');
        if (firstItemId) {
            $.getJSON(`/admin/api/${this.modelName}/${firstItemId}`, (data) => {
                this.modelItem = data;
                this.modelFields = this.extractModelFields(data);
            });
        }
    }
    
    extractModelFields(item) {
        const fields = [];
        for (const key in item) {
            // Skip id, timestamps, and special fields
            if (key !== 'id' && !key.endsWith('_at') && !key.startsWith('_')) {
                fields.push({
                    name: key,
                    type: typeof item[key],
                    value: item[key]
                });
            }
        }
        return fields;
    }
    
    setupEventHandlers() {
        // Add item button
        $('#addItemBtn').click(() => this.showAddItemModal());
        
        // Edit item buttons
        $('.edit-item').click((event) => {
            const itemId = $(event.currentTarget).data('id');
            this.showEditItemModal(itemId);
        });
        
        // Save item button
        $('#saveItem').click(() => this.saveItem());
        
        // Delete item buttons
        $('.delete-item').click((event) => {
            const itemId = $(event.currentTarget).data('id');
            this.deleteItem(itemId);
        });
    }
    
    setupSearch() {
        $('#searchInput').on('keyup', function() {
            const value = $(this).val().toLowerCase();
            $('table tbody tr').filter(function() {
                $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
            });
        });
    }
    
    showAddItemModal() {
        $('#itemModalLabel').text(`Add New ${this.displayName}`);
        $('#itemForm')[0].reset();
        $('#itemId').val('');
        this.populateFormFields({});
        $('#itemModal').modal('show');
    }
    
    showEditItemModal(itemId) {
        $('#itemModalLabel').text(`Edit ${this.displayName}`);
        
        // Fetch item data and populate form
        $.getJSON(`/admin/api/${this.modelName}/${itemId}`, (data) => {
            $('#itemId').val(data.id);
            this.populateFormFields(data);
            $('#itemModal').modal('show');
        }).fail((xhr) => {
            console.error("Error fetching item:", xhr.responseText);
            alert("Error loading data. See console for details.");
        });
    }
    
    saveItem() {
        const itemData = {};
        let hasRequiredFields = true;
        
        // Extract form data
        $('#itemForm :input:not([type=hidden])').each(function() {
            const field = $(this);
            const name = field.attr('name');
            const isRequired = field.prop('required');
            let value = field.val();
            
            // Check required fields
            if (isRequired && !value) {
                hasRequiredFields = false;
            }
            
            // Handle different input types
            if (field.attr('type') === 'checkbox') {
                value = field.is(':checked');
            }
            else if (field.attr('type') === 'number') {
                value = parseInt(value) || 0;
            }
            
            itemData[name] = value;
        });
        
        // Validate form
        if (!hasRequiredFields) {
            alert("Please fill out all required fields.");
            return;
        }
        
        const itemId = $('#itemId').val();
        let method, url;
        
        if (itemId) {
            // Update existing item
            method = 'PUT';
            url = `/admin/api/${this.modelName}/${itemId}`;
        } else {
            // Create new item
            method = 'POST';
            url = `/admin/api/${this.modelName}`;
        }
        
        // Disable save button during submission
        $('#saveItem').prop('disabled', true).text('Saving...');
        
        console.log(`Saving ${this.modelName}:`, itemData);
        
        $.ajax({
            url: url,
            method: method,
            contentType: 'application/json',
            data: JSON.stringify(itemData),
            success: (response) => {
                console.log(`${this.modelName} saved successfully:`, response);
                $('#itemModal').modal('hide');
                alert(`${this.displayName} saved successfully`);
                location.reload();
            },
            error: (xhr) => {
                console.error(`Error saving ${this.modelName}:`, xhr.responseText);
                let errorMsg = 'Unknown error occurred';
                try {
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        errorMsg = xhr.responseJSON.error;
                    } else {
                        errorMsg = xhr.statusText || errorMsg;
                    }
                } catch (e) {
                    console.error('Error parsing error response:', e);
                }
                alert('Error: ' + errorMsg);
            },
            complete: () => {
                $('#saveItem').prop('disabled', false).text('Save changes');
            }
        });
    }
    
    deleteItem(itemId) {
        if (confirm(`Are you sure you want to delete this ${this.displayName}?`)) {
            $.ajax({
                url: `/admin/api/${this.modelName}/${itemId}`,
                method: 'DELETE',
                success: () => location.reload(),
                error: (xhr) => {
                    console.error("Error deleting item:", xhr.responseText);
                    alert('Error: ' + (xhr.responseJSON ? xhr.responseJSON.error : 'Unknown error occurred'));
                }
            });
        }
    }
    
    populateFormFields(data) {
        const formFields = $('#formFields');
        formFields.empty();
        
        let fields = this.modelFields.length > 0 ? this.modelFields : [{
            name: this.primaryField,
            type: 'string',
            value: ''
        }];
        
        fields.forEach(field => {
            // Skip certain fields
            if (field.name === 'id' || field.name.endsWith('_at')) {
                return;
            }
            
            let input = '';
            const value = data[field.name] || '';
            const fieldLabel = this.formatDisplayName(field.name);
            const isRequired = ['name', 'username', 'email'].includes(field.name);
            const requiredAttr = isRequired ? 'required' : '';
            
            if (field.name === 'password' || field.name === 'password_hash') {
                // Password field
                input = `<input type="password" class="form-control" id="${field.name}" name="${field.name}" ${requiredAttr}>`;
            } else if (field.type === 'boolean') {
                // Boolean checkbox
                const checked = value ? 'checked' : '';
                input = `
                    <div class="form-check">
                        <input type="checkbox" class="form-check-input" id="${field.name}" name="${field.name}" ${checked}>
                        <label class="form-check-label" for="${field.name}">${fieldLabel}</label>
                    </div>
                `;
            } else if (field.name.endsWith('_id')) {
                // Foreign key select
                input = `<select class="form-control" id="${field.name}" name="${field.name}" ${requiredAttr}></select>`;
                
                // Load options for the select based on field name
                const relatedModel = field.name.replace('_id', '');
                const capitalizedModel = relatedModel.charAt(0).toUpperCase() + relatedModel.slice(1);
                
                $.getJSON(`/admin/api/${capitalizedModel}`, (items) => {
                    let options = `<option value="">Select ${this.formatDisplayName(relatedModel)}...</option>`;
                    items.forEach(item => {
                        const selected = item.id == value ? 'selected' : '';
                        const displayText = item.name || item.username || `ID: ${item.id}`;
                        options += `<option value="${item.id}" ${selected}>${displayText}</option>`;
                    });
                    $(`#${field.name}`).html(options);
                }).fail(() => {
                    // If API call fails, use a text input instead
                    $(`#${field.name}`).replaceWith(`<input type="text" class="form-control" id="${field.name}" name="${field.name}" value="${value}" ${requiredAttr}>`);
                });
            } else {
                // Regular text input
                input = `<input type="text" class="form-control" id="${field.name}" name="${field.name}" value="${value}" ${requiredAttr}>`;
            }
            
            // Add form group
            formFields.append(`
                <div class="form-group">
                    <label for="${field.name}">${fieldLabel}</label>
                    ${input}
                </div>
            `);
        });
    }
    
    formatDisplayName(name) {
        return name
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
}
