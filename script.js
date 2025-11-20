// --- 1. SETUP ---
const SUPABASE_URL = 'https://nxgfcjqjhjbermxcobkv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54Z2ZjanFqaGpiZXJteGNvYmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1ODcxMTUsImV4cCI6MjA3NzE2MzExNX0.YcIZo_9UfNjgjMMrgEUh6Z1O_G90oRAlBNMzkxrGlZg';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. Constants & Elements ---
const ZERO_UUID = '00000000-0000-0000-0000-000000000000'; 

const form = document.getElementById('sales-form');
const t1Select = document.getElementById('t1-name');
const pocSelect = document.getElementById('poc-name');
const manualPocInput = document.getElementById('manual-poc-name');
const pocNumberInput = document.getElementById('poc-number');
const depotSelect = document.getElementById('depot-name');
const manualDepotInput = document.getElementById('manual-depot-name');
const depotNumberInput = document.getElementById('depot-number');
const machinesInput = document.getElementById('machines-sold');
const postersInput = document.getElementById('posters-distributed');
const commentInput = document.getElementById('comment');
const submitButton = document.getElementById('submit-btn');
const formMessage = document.getElementById('form-message');

// GLOBAL DATA STORES (The Source of Truth)
let currentPocData = [];
let currentDepotData = [];
let currentEditId = null;

let t1ChoiceInstance, pocChoiceInstance, depotChoiceInstance;

// --- UTILITY: DEBOUNCE ---
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// --- 3. API SEARCH FUNCTIONS ---
async function searchPocs(query = '') {
    let queryBuilder = _supabase
        .from('pocs')
        .select('id, Name, ABI_SFA_SAPID__c, ABI_SFA_City__c')
        .range(0, 99); // Limit results for performance

    if (query.length >= 2) {
        queryBuilder = queryBuilder.ilike('Name', `%${query}%`);
    }
    // If query is empty, we just fetch the first 100

    const { data, error } = await queryBuilder;
    if (error) {
        console.error('Error searching POCs:', error);
        return [];
    }
    return data;
}

async function searchDepots(query = '') {
    let queryBuilder = _supabase
        .from('depots')
        .select('id, "Ship to Name", "Ship to number", "Sous groupement"')
        .range(0, 99);

    if (query.length >= 2) {
        queryBuilder = queryBuilder.ilike('"Ship to Name"', `%${query}%`);
    }

    const { data, error } = await queryBuilder;
    if (error) {
        console.error('Error searching Depots:', error);
        return [];
    }
    return data;
}

// --- 4. INITIALIZATION & DROPDOWN UPDATES ---

async function updatePocChoices(query) {
    const results = await searchPocs(query);
    
    // 1. Create the "Inexistant" object
    const zeroOption = {
        id: ZERO_UUID,
        Name: "Inexistant",
        ABI_SFA_SAPID__c: "00000000",
        ABI_SFA_City__c: ""
    };

    // 2. Update the Global Store (This fixes the "Lost ID" bug)
    // We merge the zero option with the search results
    currentPocData = [zeroOption, ...results];

    // 3. Format for Choices.js
    const choices = currentPocData.map(poc => ({
        value: poc.id,
        label: poc.id === ZERO_UUID ? "--- Inexistant dans la liste ---" : `${poc.Name} // ${poc.ABI_SFA_City__c || '?'} // ${poc.ABI_SFA_SAPID__c || 'No ID'}`,
        customProperties: poc 
    }));

    // 4. Refresh Dropdown
    pocChoiceInstance.setChoices(choices, 'value', 'label', true); 
}

async function updateDepotChoices(query) {
    const results = await searchDepots(query);

    const zeroOption = {
        id: ZERO_UUID,
        "Ship to Name": "Inexistant",
        "Ship to number": "00000000",
        "Sous groupement": ""
    };

    // Update Global Store
    currentDepotData = [zeroOption, ...results];

    const choices = currentDepotData.map(depot => ({
        value: depot.id,
        label: depot.id === ZERO_UUID ? "--- Inexistant dans la liste ---" : `${depot["Ship to Name"]} // ${depot["Ship to number"] || 'No #'} // ${depot["Sous groupement"] || ''}`,
        customProperties: depot
    }));

    depotChoiceInstance.setChoices(choices, 'value', 'label', true);
}


async function initForm() {
    // Load T1s (Static list)
    const { data: t1Names } = await _supabase.from('t1_users').select('id, full_name').order('full_name');
    const t1Options = t1Names.map(item => ({ value: item.id, label: item.full_name }));
    
    t1ChoiceInstance = new Choices(t1Select, { choices: t1Options, searchEnabled: true, shouldSort: false });

    // Init Choices for Searchable Fields
    pocChoiceInstance = new Choices(pocSelect, {
        searchEnabled: true, searchResultLimit: 100, shouldSort: false,
        placeholder: true, placeholderValue: 'Type to search POC...', noChoicesText: 'No results found', itemSelectText: ''
    });

    depotChoiceInstance = new Choices(depotSelect, {
        searchEnabled: true, searchResultLimit: 100, shouldSort: false,
        placeholder: true, placeholderValue: 'Type to search Depot...', noChoicesText: 'No results found', itemSelectText: ''
    });

    // Initial Load of Data
    await updatePocChoices('');
    await updateDepotChoices('');

    // Listen for Typing (Server Side Search)
    pocSelect.addEventListener('search', debounce(async (e) => {
        if (e.detail.value.length >= 2) await updatePocChoices(e.detail.value);
    }, 300));

    depotSelect.addEventListener('search', debounce(async (e) => {
        if (e.detail.value.length >= 2) await updateDepotChoices(e.detail.value);
    }, 300));

    // Check Edit Mode
    checkEditMode();
}


// --- 5. EVENT LISTENERS (The Fix) ---

// We use the 'change' event on the native select, but we look up data in our Global Arrays.
pocSelect.addEventListener('change', () => {
    const selectedId = pocSelect.value;
    
    if (selectedId === ZERO_UUID) {
        // Case: Inexistant
        manualPocInput.classList.remove('hidden');
        manualPocInput.required = true;
        pocNumberInput.value = "00000000";
    } else {
        // Case: Normal Selection
        manualPocInput.classList.add('hidden');
        manualPocInput.required = false;
        manualPocInput.value = "";

        // LOOKUP in Global Array (Robust)
        const selectedPoc = currentPocData.find(p => p.id === selectedId);
        pocNumberInput.value = selectedPoc ? (selectedPoc.ABI_SFA_SAPID__c || '') : '';
    }
});

depotSelect.addEventListener('change', () => {
    const selectedId = depotSelect.value;

    if (selectedId === ZERO_UUID) {
        manualDepotInput.classList.remove('hidden');
        manualDepotInput.required = true;
        depotNumberInput.value = "00000000";
    } else {
        manualDepotInput.classList.add('hidden');
        manualDepotInput.required = false;
        manualDepotInput.value = "";

        const selectedDepot = currentDepotData.find(d => d.id === selectedId);
        depotNumberInput.value = selectedDepot ? (selectedDepot["Ship to number"] || '') : '';
    }
});


// --- 6. SUBMIT ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
    formMessage.textContent = '';

    try {
        let finalPocId = pocSelect.value === ZERO_UUID ? null : pocSelect.value;
        let finalManualPoc = pocSelect.value === ZERO_UUID ? manualPocInput.value : null;

        let finalDepotId = depotSelect.value === ZERO_UUID ? null : depotSelect.value;
        let finalManualDepot = depotSelect.value === ZERO_UUID ? manualDepotInput.value : null;

        // Get text labels safely
        // We find the label in our data store to be safe
        const selectedPocObj = currentPocData.find(p => p.id === pocSelect.value);
        const selectedDepotObj = currentDepotData.find(d => d.id === depotSelect.value);

        const pocLabel = selectedPocObj ? `${selectedPocObj.Name}` : 'Unknown';
        const depotLabel = selectedDepotObj ? `${selectedDepotObj["Ship to Name"]}` : 'Unknown';

        const formData = {
            t1_user_id: t1Select.value,
            poc_id: finalPocId,
            depot_id: finalDepotId,
            machines_sold: machinesInput.value,
            posters_distributed: postersInput.value,
            comment: commentInput.value,
            
            // Save the names for reference
            poc_name_text: pocLabel,
            depot_name_text: depotLabel,
            
            "Inexistant_POCname": finalManualPoc,
            "Inexistant_DepotName": finalManualDepot
        };

        let error;
        if (currentEditId) {
            const { error: err } = await _supabase.from('sales_reports').update(formData).eq('id', currentEditId);
            error = err;
        } else {
            const { error: err } = await _supabase.from('sales_reports').insert([formData]);
            error = err;
        }
        
        if (error) throw error;

        if (currentEditId) {
            window.location.href = 'summary.html';
        } else {
            formMessage.textContent = 'Success!';
            formMessage.className = 'success';
            
            // Reset UI
            t1ChoiceInstance.setChoiceByValue('');
            pocChoiceInstance.setChoiceByValue('');
            depotChoiceInstance.setChoiceByValue('');
            
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

// --- 7. EDIT MODE ---
async function checkEditMode() {
    const params = new URLSearchParams(window.location.search);
    currentEditId = params.get('edit_id');

    if (currentEditId) {
        form.querySelector('h2').textContent = 'Edit Report';
        submitButton.textContent = 'Update Report';

        try {
            const { data, error } = await _supabase.from('sales_reports').select('*').eq('id', currentEditId).single();
            if (error || !data) return;

            t1ChoiceInstance.setChoiceByValue(data.t1_user_id);

            // POC Logic for Edit
            if (data.poc_id) {
                // If the POC is not in the initial list, fetch it specifically
                const exists = currentPocData.some(p => p.id === data.poc_id);
                if (!exists) {
                     const { data: singlePoc } = await _supabase.from('pocs').select('id, Name, ABI_SFA_SAPID__c, ABI_SFA_City__c').eq('id', data.poc_id).single();
                     if (singlePoc) {
                         currentPocData.push(singlePoc); // Add to our source of truth
                         const choice = {
                            value: singlePoc.id,
                            label: `${singlePoc.Name} // ${singlePoc.ABI_SFA_City__c} // ${singlePoc.ABI_SFA_SAPID__c}`,
                            customProperties: singlePoc
                        };
                        // Force inject into choices
                        pocChoiceInstance.setChoices([choice], 'value', 'label', false); 
                     }
                }
                pocChoiceInstance.setChoiceByValue(data.poc_id);
            } else if (data.Inexistant_POCname) {
                pocChoiceInstance.setChoiceByValue(ZERO_UUID);
                manualPocInput.value = data.Inexistant_POCname;
            }

            // Depot Logic for Edit
            if (data.depot_id) {
                 const exists = currentDepotData.some(d => d.id === data.depot_id);
                 if (!exists) {
                     const { data: singleDepot } = await _supabase.from('depots').select('id, "Ship to Name", "Ship to number", "Sous groupement"').eq('id', data.depot_id).single();
                     if (singleDepot) {
                         currentDepotData.push(singleDepot);
                         const choice = {
                            value: singleDepot.id,
                            label: `${singleDepot["Ship to Name"]} // ${singleDepot["Ship to number"]}`,
                            customProperties: singleDepot
                        };
                        depotChoiceInstance.setChoices([choice], 'value', 'label', false);
                     }
                 }
                depotChoiceInstance.setChoiceByValue(data.depot_id);
            } else if (data.Inexistant_DepotName) {
                depotChoiceInstance.setChoiceByValue(ZERO_UUID);
                manualDepotInput.value = data.Inexistant_DepotName;
            }

            machinesInput.value = data.machines_sold;
            postersInput.value = data.posters_distributed;
            commentInput.value = data.comment;

        } catch (error) { console.error(error); }
    }
}

document.addEventListener('DOMContentLoaded', initForm);