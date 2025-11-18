// --- 1. SETUP ---
const SUPABASE_URL = 'https://nxgfcjqjhjbermxcobkv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54Z2ZjanFqaGpiZXJteGNvYmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1ODcxMTUsImV4cCI6MjA3NzE2MzExNX0.YcIZo_9UfNjgjMMrgEUh6Z1O_G90oRAlBNMzkxrGlZg';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. Constants & Elements ---
const ZERO_UUID = '00000000-0000-0000-0000-000000000000'; // Special ID for UI logic

const form = document.getElementById('sales-form');
const t1Select = document.getElementById('t1-name');
const pocSelect = document.getElementById('poc-name');
const manualPocInput = document.getElementById('manual-poc-name'); // NEW
const pocNumberInput = document.getElementById('poc-number');
const depotSelect = document.getElementById('depot-name');
const manualDepotInput = document.getElementById('manual-depot-name'); // NEW
const depotNumberInput = document.getElementById('depot-number');
const machinesInput = document.getElementById('machines-sold');
const postersInput = document.getElementById('posters-distributed');
const commentInput = document.getElementById('comment');
const submitButton = document.getElementById('submit-btn');
const formMessage = document.getElementById('form-message');

let pocData = [];
let depotData = [];
let currentEditId = null;

let t1ChoiceInstance, pocChoiceInstance, depotChoiceInstance;

function populateSelect(selectElement, data, nameCol, idCol = 'id') {
    selectElement.innerHTML = `<option value="">-- Select an option --</option>`;
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[idCol];
        option.textContent = item[nameCol];
        selectElement.appendChild(option);
    });
}

// --- 3. Load Data ---
async function loadInitialData() {
    try {
        // Fetch T1
        const { data: t1Names, error: t1Error } = await _supabase
            .from('t1_users').select('id, full_name').order('full_name', { ascending: true });
        if (t1Error) throw t1Error;
        populateSelect(t1Select, t1Names, 'full_name');

        // --- POCs ---
        const { data: pocs, error: pocError } = await _supabase
            .from('pocs').select('id, Name, ABI_SFA_SAPID__c, ABI_SFA_City__c');
        if (pocError) throw pocError;

        // Sort JS
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

        // ADD THE SPECIAL OPTION TO THE TOP
        pocData.unshift({
            id: ZERO_UUID,
            Name: "Inexistant",
            displayLabel: "--- Inexistant dans la liste ---",
            ABI_SFA_SAPID__c: "00000000"
        });

        populateSelect(pocSelect, pocData, 'displayLabel');

        // --- DEPOTs ---
        const { data: depots, error: depotError } = await _supabase
            .from('depots').select('id, "Ship to Name", "Ship to number", "Sous groupement"');
        if (depotError) throw depotError;

        depots.sort((a, b) => {
             const nameA = a["Ship to Name"] ? a["Ship to Name"].trim() : '';
             const nameB = b["Ship to Name"] ? b["Ship to Name"].trim() : '';
             const isLetterA = /^[a-zA-Z\u00C0-\u00FF]/.test(nameA);
             const isLetterB = /^[a-zA-Z\u00C0-\u00FF]/.test(nameB);
             if (isLetterA && !isLetterB) return -1;
             if (!isLetterA && isLetterB) return 1;
             return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
        });

        depotData = depots.map(depot => ({
            ...depot,
            displayLabel: `${depot["Ship to Name"]} // ${depot["Ship to number"] || 'No #'} // ${depot["Sous groupement"] || ''}`
        }));

        // ADD THE SPECIAL OPTION TO THE TOP
        depotData.unshift({
            id: ZERO_UUID,
            "Ship to Name": "Inexistant",
            displayLabel: "--- Inexistant dans la liste ---",
            "Ship to number": "00000000"
        });

        populateSelect(depotSelect, depotData, 'displayLabel');

    } catch (error) {
        console.error('Error loading initial data:', error);
        formMessage.textContent = 'Error loading form data.';
        formMessage.className = 'error';
    }
}

// --- 4. Check Edit Mode ---
async function checkEditMode() {
    await loadInitialData(); 

    const choiceOptions = {
        searchEnabled: true, searchResultLimit: 10, shouldSort: false,
        fuseOptions: { shouldSort: true, threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2 }
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
                .from('sales_reports').select('*').eq('id', currentEditId).single(); 
            
            if (error) throw error;
            if (!data) return;

            t1ChoiceInstance.setChoiceByValue(data.t1_user_id);

            // Handle POC: If ID is null but we have manual text, select Zero UUID
            if (!data.poc_id && data.Inexistant_POCname) {
                pocChoiceInstance.setChoiceByValue(ZERO_UUID);
                manualPocInput.value = data.Inexistant_POCname;
                // Trigger change manually to show the field
                pocSelect.dispatchEvent(new Event('change')); 
            } else {
                pocChoiceInstance.setChoiceByValue(data.poc_id);
            }

            // Handle Depot: If ID is null but we have manual text, select Zero UUID
            if (!data.depot_id && data.Inexistant_DepotName) {
                depotChoiceInstance.setChoiceByValue(ZERO_UUID);
                manualDepotInput.value = data.Inexistant_DepotName;
                depotSelect.dispatchEvent(new Event('change'));
            } else {
                depotChoiceInstance.setChoiceByValue(data.depot_id);
            }

            machinesInput.value = data.machines_sold;
            postersInput.value = data.posters_distributed;
            commentInput.value = data.comment;

            // Refresh dependent fields
            pocSelect.dispatchEvent(new Event('change'));
            depotSelect.dispatchEvent(new Event('change'));

        } catch (error) {
            console.error('Error fetching report:', error);
        }
    }
}

// --- 5. Event Listeners ---

pocSelect.addEventListener('change', (e) => {
    const selectedPocId = e.target.value;
    
    // Logic for "Inexistant"
    if (selectedPocId === ZERO_UUID) {
        manualPocInput.classList.remove('hidden');
        manualPocInput.required = true; // Make manual input required
        pocNumberInput.value = "00000000";
    } else {
        manualPocInput.classList.add('hidden');
        manualPocInput.required = false;
        manualPocInput.value = ""; // Clear if switching back
        
        const selectedPoc = pocData.find(poc => poc.id == selectedPocId);
        pocNumberInput.value = selectedPoc ? (selectedPoc.ABI_SFA_SAPID__c || '') : '';
    }
});

depotSelect.addEventListener('change', (e) => {
    const selectedDepotId = e.target.value;

    // Logic for "Inexistant"
    if (selectedDepotId === ZERO_UUID) {
        manualDepotInput.classList.remove('hidden');
        manualDepotInput.required = true;
        depotNumberInput.value = "00000000";
    } else {
        manualDepotInput.classList.add('hidden');
        manualDepotInput.required = false;
        manualDepotInput.value = "";

        const selectedDepot = depotData.find(depot => depot.id == selectedDepotId);
        depotNumberInput.value = selectedDepot ? (selectedDepot["Ship to number"] || '') : '';
    }
});

// --- 6. Submit ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
    formMessage.textContent = '';

    try {
        // Determine values for POC
        let finalPocId = pocSelect.value;
        let finalManualPoc = null;
        if (finalPocId === ZERO_UUID) {
            finalPocId = null; // Send NULL to DB for ID
            finalManualPoc = manualPocInput.value; // Send text to new column
        }

        // Determine values for Depot
        let finalDepotId = depotSelect.value;
        let finalManualDepot = null;
        if (finalDepotId === ZERO_UUID) {
            finalDepotId = null;
            finalManualDepot = manualDepotInput.value;
        }

        const formData = {
            t1_user_id: t1Select.value,
            poc_id: finalPocId,
            depot_id: finalDepotId,
            machines_sold: machinesInput.value,
            posters_distributed: postersInput.value,
            comment: commentInput.value,
            poc_name_text: pocSelect.options[pocSelect.selectedIndex].text,
            depot_name_text: depotSelect.options[depotSelect.selectedIndex].text,
            
            // Save manual inputs to the columns in sales_reports
            "Inexistant_POCname": finalManualPoc,
            "Inexistant_DepotName": finalManualDepot
        };

        let error;
        if (currentEditId) {
            const { error: updateError } = await _supabase
                .from('sales_reports').update(formData).eq('id', currentEditId);
            error = updateError;
        } else {
            const { error: insertError } = await _supabase
                .from('sales_reports').insert([formData]);
            error = insertError;
        }
        
        if (error) throw error;

        if (currentEditId) {
            window.location.href = 'summary.html';
        } else {
            formMessage.textContent = 'Success!';
            formMessage.className = 'success';
            
            // Clear choices
            t1ChoiceInstance.setChoiceByValue('');
            pocChoiceInstance.setChoiceByValue('');
            depotChoiceInstance.setChoiceByValue('');
            
            // Hide manual inputs
            manualPocInput.classList.add('hidden');
            manualDepotInput.classList.add('hidden');
            
            form.reset();
            pocNumberInput.value = '';
            depotNumberInput.value = '';
        }

    } catch (error) {
        console.error('Error:', error);
        formMessage.textContent = `Error: ${error.message}`;
        formMessage.className = 'error';
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = currentEditId ? 'Update Report' : 'Submit Report';
    }
});

document.addEventListener('DOMContentLoaded', checkEditMode);