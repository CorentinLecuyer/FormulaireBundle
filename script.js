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
let currentEditId = null;

// Store Choices.js instances
let t1ChoiceInstance, pocChoiceInstance, depotChoiceInstance;

// --- 5. Helper Function to Populate Select ---
function populateSelect(selectElement, data, nameCol, idCol = 'id') {
    selectElement.innerHTML = `<option value="">-- Select an option --</option>`;
    
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

        // --- FETCH POCS ---
        const { data: pocs, error: pocError } = await _supabase
            .from('pocs')
            .select('id, Name, ABI_SFA_SAPID__c, ABI_SFA_City__c');
        
        if (pocError) throw pocError;

        // Sort POCs (Letters first)
        pocs.sort((a, b) => {
             const nameA = a.Name ? a.Name.trim() : '';
             const nameB = b.Name ? b.Name.trim() : '';
             const isLetterA = /^[a-zA-Z\u00C0-\u00FF]/.test(nameA);
             const isLetterB = /^[a-zA-Z\u00C0-\u00FF]/.test(nameB);
             if (isLetterA && !isLetterB) return -1;
             if (!isLetterA && isLetterB) return 1;
             return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
        });

        pocData = pocs.map(poc => ({
            ...poc,
            displayLabel: `${poc.Name} // ${poc.ABI_SFA_City__c || '?'} // ${poc.ABI_SFA_SAPID__c || 'No ID'}`
        }));
        populateSelect(pocSelect, pocData, 'displayLabel');


        // --- UPDATED DEPOT FETCHING & SORTING ---
        // Note the quotes around column names with spaces
        const { data: depots, error: depotError } = await _supabase
            .from('depots')
            .select('id, "Ship to Name", "Ship to number", "Sous groupement"');
            
        if (depotError) throw depotError;

        // Sort Depots (Letters first) using "Ship to Name"
        depots.sort((a, b) => {
             // Use bracket notation for keys with spaces
             const nameA = a["Ship to Name"] ? a["Ship to Name"].trim() : '';
             const nameB = b["Ship to Name"] ? b["Ship to Name"].trim() : '';
             
             const isLetterA = /^[a-zA-Z\u00C0-\u00FF]/.test(nameA);
             const isLetterB = /^[a-zA-Z\u00C0-\u00FF]/.test(nameB);
             
             if (isLetterA && !isLetterB) return -1;
             if (!isLetterA && isLetterB) return 1;
             
             return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
        });

        // Map the sorted data to a searchable format
        depotData = depots.map(depot => ({
            ...depot,
            // Create a combined string for searching
            displayLabel: `${depot["Ship to Name"]} // ${depot["Ship to number"] || 'No #'} // ${depot["Sous groupement"] || ''}`
        }));

        populateSelect(depotSelect, depotData, 'displayLabel');

    } catch (error) {
        console.error('Error loading initial data:', error);
        formMessage.textContent = 'Error loading form data. Please refresh.';
        formMessage.className = 'error';
    }
}

// --- Check for Edit Mode ---
async function checkEditMode() {
    await loadInitialData(); 

    const choiceOptions = {
        searchEnabled: true,
        searchResultLimit: 10,
        shouldSort: false, // Keep our custom JS sort
        fuseOptions: {
          shouldSort: true,
          threshold: 0.3,
          ignoreLocation: true,
          minMatchCharLength: 2
        }
    };
    t1ChoiceInstance = new Choices(t1Select, choiceOptions);
    pocChoiceInstance = new Choices(pocSelect, choiceOptions);
    depotChoiceInstance = new Choices(depotSelect, choiceOptions);


    const params = new URLSearchParams(window.location.search);
    currentEditId = params.get('edit_id');

    if (currentEditId) {
        form.querySelector('h2').textContent = 'Edit Report';
        submitButton.textContent = 'Update Report';

        try {
            const { data, error } = await _supabase
                .from('sales_reports')
                .select('*')
                .eq('id', currentEditId)
                .single(); 
            
            if (error) throw error;
            if (!data) {
                formMessage.textContent = 'Error: Report not found.';
                formMessage.className = 'error';
                return;
            }

            t1ChoiceInstance.setChoiceByValue(data.t1_user_id.toString());
            pocChoiceInstance.setChoiceByValue(data.poc_id.toString());
            depotChoiceInstance.setChoiceByValue(data.depot_id.toString());

            machinesInput.value = data.machines_sold;
            postersInput.value = data.posters_distributed;
            commentInput.value = data.comment;

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
        pocNumberInput.value = selectedPoc.ABI_SFA_SAPID__c || ''; 
    } else {
        pocNumberInput.value = '';
    }
});

// --- UPDATED DEPOT LISTENER ---
depotSelect.addEventListener('change', (e) => {
    const selectedDepotId = e.target.value;
    const selectedDepot = depotData.find(depot => depot.id == selectedDepotId);
    
    if (selectedDepot) {
        // Use bracket notation for "Ship to number"
        depotNumberInput.value = selectedDepot["Ship to number"] || '';
    } else {
        depotNumberInput.value = '';
    }
});

// --- 8. Handle Form Submission ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
    formMessage.textContent = '';

    try {
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

        if (currentEditId) {
            const { error: updateError } = await _supabase
                .from('sales_reports')
                .update(formData)
                .eq('id', currentEditId);
            error = updateError;
        } else {
            const { error: insertError } = await _supabase
                .from('sales_reports')
                .insert([formData]);
            error = insertError;
        }
        
        if (error) throw error;

        if (currentEditId) {
            formMessage.textContent = 'Report updated successfully!';
            formMessage.className = 'success';
            window.location.href = 'summary.html';
        } else {
            formMessage.textContent = 'Report submitted successfully!';
            formMessage.className = 'success';
            
            t1ChoiceInstance.clearInput();
            t1ChoiceInstance.setChoiceByValue('');
            pocChoiceInstance.clearInput();
            pocChoiceInstance.setChoiceByValue('');
            depotChoiceInstance.clearInput();
            depotChoiceInstance.setChoiceByValue('');

            form.reset(); 
            pocNumberInput.value = '';
            depotNumberInput.value = '';
        }

    } catch (error) {
        console.error('Error submitting form:', error);
        formMessage.textContent = `Error: ${error.message}`;
        formMessage.className = 'error';
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = currentEditId ? 'Update Report' : 'Submit Report';
    }
});

document.addEventListener('DOMContentLoaded', checkEditMode);