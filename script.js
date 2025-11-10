// --- 1. SETUP: Replace with your Supabase details ---
const SUPABASE_URL = 'https://nxgfcjqjhjbermxcobkv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54Z2ZjanFqaGpiZXJteGNvYmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1ODcxMTUsImV4cCI6MjA3NzE2MzExNX0.YcIZo_9UfNjgjMMrgEUh6Z1O_G90oRAlBNMzkxrGlZg';


// --- 2. Initialize Supabase Client ---
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 3. DOM Elements ---
const form = document.getElementById('sales-form');
const t1Select = document.getElementById('t1-name');
const pocSelect = document.getElementById('poc-name');
const pocNumberInput = document.getElementById('poc-number');
const depotSelect = document.getElementById('depot-name');
const depotNumberInput = document.getElementById('depot-number');
const machinesInput = document.getElementById('machines-sold');
const postersInput = document.getElementById('posters-distributed');
const commentInput = document.getElementById('comment');
const submitButton = document.getElementById('submit-btn');
const formMessage = document.getElementById('form-message');

// --- 4. Data Storage ---
let pocData = [];
let depotData = [];
let currentEditId = null; // <-- ADDED: To track if we are in edit mode

let t1ChoiceInstance, pocChoiceInstance, depotChoiceInstance;

// --- 5. Helper Function to Populate Select ---
function populateSelect(selectElement, data, nameCol, idCol = 'id') {
    // Clear loading text
    selectElement.innerHTML = `<option value="">-- Select an option --</option>`;

    // Populate with data
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[idCol];
        option.textContent = item[nameCol];
        selectElement.appendChild(option);
    });
}

// --- 6. Fetch Initial Data ---
async function loadInitialData() {
    try {
        // Fetch T1 Names
        const { data: t1Names, error: t1Error } = await _supabase
            .from('t1_users')
            .select('id, full_name')
            .order('full_name', { ascending: true });
        if (t1Error) throw t1Error;
        populateSelect(t1Select, t1Names, 'full_name');

        // Fetch POCs
        const { data: pocs, error: pocError } = await _supabase
            .from('pocs')
            .select('id, poc_name, poc_number')
            .order('poc_name', { ascending: true });
        if (pocError) throw pocError;
        pocData = pocs;
        populateSelect(pocSelect, pocData, 'poc_name');

        // Fetch Depots
        const { data: depots, error: depotError } = await _supabase
            .from('depots')
            .select('id, depot_name, depot_number')
            .order('depot_name', { ascending: true });
        if (depotError) throw depotError;
        depotData = depots;
        populateSelect(depotSelect, depotData, 'depot_name');

    } catch (error) {
        console.error('Error loading initial data:', error);
        formMessage.textContent = 'Error loading form data. Please refresh.';
        formMessage.className = 'error';
    }
}

// --- NEW: Check for Edit Mode ---
async function checkEditMode() {
    // Wait for dropdowns to be populated
    await loadInitialData();

    // Initialize Choices.js *first* and store instances
    const choiceOptions = {
        searchEnabled: true,
        searchResultLimit: 10,
        shouldSort: false,

        fuseOptions: {
            shouldSort: true, // Sort results by relevance
            threshold: 0.1,   // Be more strict (0.0 = perfect match, 1.0 = match all)
            ignoreLocation: true, // Search the entire string, not just the start
            minMatchCharLength: 1  // Only find matches of 1 char or more
        }
    };
    t1ChoiceInstance = new Choices(t1Select, choiceOptions);
    pocChoiceInstance = new Choices(pocSelect, choiceOptions);
    depotChoiceInstance = new Choices(depotSelect, choiceOptions);


    const params = new URLSearchParams(window.location.search);
    currentEditId = params.get('edit_id');

    if (currentEditId) {
        // We are in edit mode
        form.querySelector('h2').textContent = 'Edit Report';
        submitButton.textContent = 'Update Report';

        try {
            // Fetch the specific report
            const { data, error } = await _supabase
                .from('sales_reports')
                .select('*')
                .eq('id', currentEditId)
                .single(); // Get a single record

            if (error) throw error;
            if (!data) {
                formMessage.textContent = 'Error: Report not found.';
                formMessage.className = 'error';
                return;
            }

            // ▼▼▼ THIS IS THE FIX ▼▼▼
            // Populate the form fields using the Choices.js API
            t1ChoiceInstance.setChoiceByValue(data.t1_user_id.toString());
            pocChoiceInstance.setChoiceByValue(data.poc_id.toString());
            depotChoiceInstance.setChoiceByValue(data.depot_id.toString());
            // ▲▲▲ END OF FIX ▲▲▲

            machinesInput.value = data.machines_sold;
            postersInput.value = data.posters_distributed;
            commentInput.value = data.comment;

            // Manually trigger change events to update dependent fields
            pocSelect.dispatchEvent(new Event('change'));
            depotSelect.dispatchEvent(new Event('change'));

        } catch (error) {
            console.error('Error fetching report for edit:', error);
            formMessage.textContent = `Error: ${error.message}`;
            formMessage.className = 'error';
        }
    }
}


// --- 7. Event Listeners for Dependent Fields ---
pocSelect.addEventListener('change', (e) => {
    const selectedPocId = e.target.value;
    const selectedPoc = pocData.find(poc => poc.id == selectedPocId);

    if (selectedPoc) {
        pocNumberInput.value = selectedPoc.poc_number;
    } else {
        pocNumberInput.value = '';
    }
});

depotSelect.addEventListener('change', (e) => {
    const selectedDepotId = e.target.value;
    const selectedDepot = depotData.find(depot => depot.id == selectedDepotId);

    if (selectedDepot) {
        depotNumberInput.value = selectedDepot.depot_number;
    } else {
        depotNumberInput.value = '';
    }
});

// --- 8. Handle Form Submission (UPDATED) ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
    formMessage.textContent = '';

    try {
        // Collect form data (same as before)
        const formData = {
            t1_user_id: t1Select.value,
            poc_id: pocSelect.value,
            depot_id: depotSelect.value,
            machines_sold: machinesInput.value,
            posters_distributed: postersInput.value,
            comment: commentInput.value,
            poc_name_text: pocSelect.options[pocSelect.selectedIndex].text,
            depot_name_text: depotSelect.options[depotSelect.selectedIndex].text,
        };

        let error;

        // --- UPDATED LOGIC: Check if we are editing or inserting ---
        if (currentEditId) {
            // We are UPDATING an existing record
            const { error: updateError } = await _supabase
                .from('sales_reports')
                .update(formData)
                .eq('id', currentEditId);
            error = updateError;
        } else {
            // We are INSERTING a new record
            const { error: insertError } = await _supabase
                .from('sales_reports')
                .insert([formData]);
            error = insertError;
        }

        if (error) throw error;

        // --- UPDATED SUCCESS ---
        if (currentEditId) {
            // If update is successful, go back to the summary page
            formMessage.textContent = 'Report updated successfully!';
            formMessage.className = 'success';
            window.location.href = 'summary.html';
        } else {
            // If insert is successful, clear the form
            formMessage.textContent = 'Report submitted successfully!';
            formMessage.className = 'success';

            // ▼▼▼ Clear Choices.js fields correctly ▼▼▼
            t1ChoiceInstance.clearInput();
            t1ChoiceInstance.setChoiceByValue('');
            pocChoiceInstance.clearInput();
            pocChoiceInstance.setChoiceByValue('');
            depotChoiceInstance.clearInput();
            depotChoiceInstance.setChoiceByValue('');
            // ▲▲▲ END OF FIX ▲▲▲

            form.reset(); // Clear other fields
            pocNumberInput.value = '';
            depotNumberInput.value = '';
        }

    } catch (error) {
        console.error('Error submitting form:', error);
        formMessage.textContent = `Error: ${error.message}`;
        formMessage.className = 'error';
    } finally {
        submitButton.disabled = false;
        // Reset button text based on mode
        submitButton.textContent = currentEditId ? 'Update Report' : 'Submit Report';
    }
});

// --- 9. Load data when the page is ready (UPDATED) ---
// We now call checkEditMode, which in turn calls loadInitialData
document.addEventListener('DOMContentLoaded', checkEditMode);