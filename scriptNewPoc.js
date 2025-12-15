// --- 1. SETUP ---
const SUPABASE_URL = 'https://nxgfcjqjhjbermxcobkv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54Z2ZjanFqaGpiZXJteGNvYmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1ODcxMTUsImV4cCI6MjA3NzE2MzExNX0.YcIZo_9UfNjgjMMrgEUh6Z1O_G90oRAlBNMzkxrGlZg';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. CONFIGURATION & CONSTANTS ---
const PROMO_NAME_VAR = "Bundle Offer 2025 - Q1"; // Managed by Developers
const MAX_FILE_SIZE_MB = 5;
const STORAGE_BUCKET = 'proofs'; // Must exist in Supabase Storage
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

// --- 3. DOM Elements ---
const form = document.getElementById('sales-form');
const t1Select = document.getElementById('t1-name');
const pocSelect = document.getElementById('poc-name');
const manualPocInput = document.getElementById('manual-poc-name');
const pocNumberInput = document.getElementById('poc-number');
const depotSelect = document.getElementById('depot-name');
const manualDepotInput = document.getElementById('manual-depot-name');
const depotNumberInput = document.getElementById('depot-number');

// New Fields
const mechanicInput = document.getElementById('mechanic');
const statsProofSelect = document.getElementById('stats-proofs');
const proofUploadWrapper = document.getElementById('proof-upload-wrapper');
const proofFileInput = document.getElementById('proof-file');

const machinesInput = document.getElementById('machines-sold');
const postersInput = document.getElementById('posters-distributed');
const commentInput = document.getElementById('comment');
const submitButton = document.getElementById('submit-btn');
const formMessage = document.getElementById('form-message');

// Data Stores
let currentPocData = [];
let currentDepotData = [];
let currentEditId = null;
let t1ChoiceInstance, pocChoiceInstance, depotChoiceInstance;

// --- 4. UTILITY FUNCTIONS ---
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// --- 5. SEARCH API CALLS ---
async function searchPocs(query = '') {
    let queryBuilder = _supabase
        .from('pocs')
        .select('id, Name, ABI_SFA_SAPID__c, ABI_SFA_City__c')
        .range(0, 99); 

    if (query.length >= 2) {
        queryBuilder = queryBuilder.ilike('Name', `%${query}%`);
    }
    const { data, error } = await queryBuilder;
    if (error) { console.error('Error searching POCs:', error); return []; }
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
    if (error) { console.error('Error searching Depots:', error); return []; }
    return data;
}

// --- 6. INITIALIZATION ---
async function updatePocChoices(query) {
    const results = await searchPocs(query);
    const zeroOption = { id: ZERO_UUID, Name: "Inexistant", ABI_SFA_SAPID__c: "00000000", ABI_SFA_City__c: "" };
    currentPocData = [zeroOption, ...results];

    const choices = currentPocData.map(poc => ({
        value: poc.id,
        label: poc.id === ZERO_UUID ? "--- Inexistant dans la liste ---" : `${poc.Name} // ${poc.ABI_SFA_City__c || '?'} // ${poc.ABI_SFA_SAPID__c || 'No ID'}`,
        customProperties: poc 
    }));
    pocChoiceInstance.setChoices(choices, 'value', 'label', true); 
}

async function updateDepotChoices(query) {
    const results = await searchDepots(query);
    const zeroOption = { id: ZERO_UUID, "Ship to Name": "Inexistant", "Ship to number": "00000000", "Sous groupement": "" };
    currentDepotData = [zeroOption, ...results];

    const choices = currentDepotData.map(depot => ({
        value: depot.id,
        label: depot.id === ZERO_UUID ? "--- Inexistant dans la liste ---" : `${depot["Ship to Name"]} // ${depot["Ship to number"] || 'No #'} // ${depot["Sous groupement"] || ''}`,
        customProperties: depot
    }));
    depotChoiceInstance.setChoices(choices, 'value', 'label', true);
}

async function initForm() {
    // Load T1
    const { data: t1Names } = await _supabase.from('t1_users').select('id, full_name').order('full_name');
    const t1Options = t1Names.map(item => ({ value: item.id, label: item.full_name }));
    t1ChoiceInstance = new Choices(t1Select, { choices: t1Options, searchEnabled: true, shouldSort: false });

    // Load POCs/Depots
    pocChoiceInstance = new Choices(pocSelect, { searchEnabled: true, searchResultLimit: 100, shouldSort: false, placeholder: true, placeholderValue: 'Type to search POC...', itemSelectText: '' });
    depotChoiceInstance = new Choices(depotSelect, { searchEnabled: true, searchResultLimit: 100, shouldSort: false, placeholder: true, placeholderValue: 'Type to search Depot...', itemSelectText: '' });

    await updatePocChoices('');
    await updateDepotChoices('');

    // Search Listeners
    pocSelect.addEventListener('search', debounce(async (e) => { if (e.detail.value.length >= 2) await updatePocChoices(e.detail.value); }, 300));
    depotSelect.addEventListener('search', debounce(async (e) => { if (e.detail.value.length >= 2) await updateDepotChoices(e.detail.value); }, 300));

    // Check Edit Mode
    checkEditMode();
}

// --- 7. FIELD LISTENERS ---

// Toggle Proof Upload Field
statsProofSelect.addEventListener('change', () => {
    if (statsProofSelect.value === 'true') {
        proofUploadWrapper.classList.remove('hidden');
        proofFileInput.required = true; // Make it required if selected
    } else {
        proofUploadWrapper.classList.add('hidden');
        proofFileInput.required = false;
        proofFileInput.value = ''; // Clear file if hiding
    }
});

pocSelect.addEventListener('change', () => {
    const selectedId = pocSelect.value;
    if (selectedId === ZERO_UUID) {
        manualPocInput.classList.remove('hidden');
        manualPocInput.required = true;
        pocNumberInput.value = "00000000";
    } else {
        manualPocInput.classList.add('hidden');
        manualPocInput.required = false;
        manualPocInput.value = "";
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

// --- 8. SUBMIT HANDLER (With File Upload) ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';
    formMessage.textContent = '';

    try {
        // 1. Handle File Upload (if Stats Proof is Yes)
        let uploadedProofUrl = null;
        const statsProofBool = statsProofSelect.value === 'true';

        if (statsProofBool) {
            const file = proofFileInput.files[0];
            
            if (!file && !currentEditId) {
                // If new report and yes is selected, file is mandatory
                throw new Error("Please upload a proof file.");
            }

            if (file) {
                // Check Size
                if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                    throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE_MB}MB.`);
                }

                // Generate unique file name
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
                const filePath = `uploads/${fileName}`;

                submitButton.textContent = 'Uploading Proof...';

                // Upload to Supabase Storage
                const { error: uploadError } = await _supabase.storage
                    .from(STORAGE_BUCKET)
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                // Get Public URL
                const { data: urlData } = _supabase.storage
                    .from(STORAGE_BUCKET)
                    .getPublicUrl(filePath);
                
                uploadedProofUrl = urlData.publicUrl;
            }
        }

        submitButton.textContent = 'Saving Report...';

        // 2. Prepare Data
        let finalPocId = pocSelect.value === ZERO_UUID ? null : pocSelect.value;
        let finalManualPoc = pocSelect.value === ZERO_UUID ? manualPocInput.value : null;
        let finalDepotId = depotSelect.value === ZERO_UUID ? null : depotSelect.value;
        let finalManualDepot = depotSelect.value === ZERO_UUID ? manualDepotInput.value : null;

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
            poc_name_text: pocLabel,
            depot_name_text: depotLabel,
            "Inexistant_POCname": finalManualPoc,
            "Inexistant_DepotName": finalManualDepot,
            
            // --- NEW FIELDS ---
            "Promo_Name": PROMO_NAME_VAR,
            "Mechanic": mechanicInput.value,
            "Stats_Proofs": statsProofBool,
            // Only update proof location if a new file was uploaded, 
            // otherwise keep it undefined so it doesn't overwrite existing on edit
            ...(uploadedProofUrl && { "Proof_Location": uploadedProofUrl }) 
        };

        // 3. Insert / Update
        let error;
        if (currentEditId) {
            const { error: err } = await _supabase.from('sales_reports').update(formData).eq('id', currentEditId);
            error = err;
        } else {
            const { error: err } = await _supabase.from('sales_reports').insert([formData]);
            error = err;
        }
        
        if (error) throw error;

        // 4. Success
        if (currentEditId) {
            window.location.href = 'summary.html';
        } else {
            formMessage.textContent = 'Report submitted successfully!';
            formMessage.className = 'success';
            
            // Reset UI
            t1ChoiceInstance.setChoiceByValue('');
            pocChoiceInstance.setChoiceByValue('');
            depotChoiceInstance.setChoiceByValue('');
            manualPocInput.classList.add('hidden');
            manualDepotInput.classList.add('hidden');
            proofUploadWrapper.classList.add('hidden'); // Hide upload
            
            form.reset();
            // Reset stats proof to 'false' manually because form.reset() might not trigger the change event logic
            statsProofSelect.value = 'false';
            proofFileInput.value = '';
            
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

// --- 9. EDIT MODE (Modified for new fields) ---
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

            // POC
            if (data.poc_id) {
                const exists = currentPocData.some(p => p.id === data.poc_id);
                if (!exists) {
                     const { data: singlePoc } = await _supabase.from('pocs').select('id, Name, ABI_SFA_SAPID__c, ABI_SFA_City__c').eq('id', data.poc_id).single();
                     if (singlePoc) {
                         currentPocData.push(singlePoc);
                         const choice = { value: singlePoc.id, label: `${singlePoc.Name} // ${singlePoc.ABI_SFA_City__c} // ${singlePoc.ABI_SFA_SAPID__c}`, customProperties: singlePoc };
                         pocChoiceInstance.setChoices([choice], 'value', 'label', false); 
                     }
                }
                pocChoiceInstance.setChoiceByValue(data.poc_id);
            } else if (data.Inexistant_POCname) {
                pocChoiceInstance.setChoiceByValue(ZERO_UUID);
                manualPocInput.value = data.Inexistant_POCname;
            }

            // Depot
            if (data.depot_id) {
                 const exists = currentDepotData.some(d => d.id === data.depot_id);
                 if (!exists) {
                     const { data: singleDepot } = await _supabase.from('depots').select('id, "Ship to Name", "Ship to number", "Sous groupement"').eq('id', data.depot_id).single();
                     if (singleDepot) {
                         currentDepotData.push(singleDepot);
                         const choice = { value: singleDepot.id, label: `${singleDepot["Ship to Name"]} // ${singleDepot["Ship to number"]}`, customProperties: singleDepot };
                         depotChoiceInstance.setChoices([choice], 'value', 'label', false);
                     }
                 }
                depotChoiceInstance.setChoiceByValue(data.depot_id);
            } else if (data.Inexistant_DepotName) {
                depotChoiceInstance.setChoiceByValue(ZERO_UUID);
                manualDepotInput.value = data.Inexistant_DepotName;
            }

            // Fill new fields
            mechanicInput.value = data.Mechanic || '';
            
            // Set Stats Proofs
            statsProofSelect.value = data.Stats_Proofs ? 'true' : 'false';
            if (data.Stats_Proofs) {
                proofUploadWrapper.classList.remove('hidden');
                // Note: We cannot set the value of file input programmatically for security reasons.
                // The user must re-upload if they want to change it.
                proofFileInput.required = false; // Not required on edit if already exists (logic simplified here)
            }

            machinesInput.value = data.machines_sold;
            postersInput.value = data.posters_distributed;
            commentInput.value = data.comment;

        } catch (error) { console.error(error); }
    }
}

document.addEventListener('DOMContentLoaded', initForm);