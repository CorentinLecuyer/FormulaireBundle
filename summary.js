// --- 1. SETUP ---
const SUPABASE_URL = 'https://nxgfcjqjhjbermxcobkv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54Z2ZjanFqaGpiZXJteGNvYmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1ODcxMTUsImV4cCI6MjA3NzE2MzExNX0.YcIZo_9UfNjgjMMrgEUh6Z1O_G90oRAlBNMzkxrGlZg';

// --- 2. Initialize Supabase Client ---
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 3. DOM Elements ---
const reportsListContainer = document.getElementById('reports-list');
const t1FilterSelect = document.getElementById('t1-filter');

// --- 4. Data Storage ---
let allReports = [];
let t1FilterChoiceInstance = null;

// --- 5. Main Function to Load Data ---
async function loadData() {
    try {
        reportsListContainer.innerHTML = "<p>Loading reports...</p>";

        // --- UPDATED QUERY WITH NEW COLUMN NAMES ---
        const { data, error } = await _supabase
            .from('sales_reports')
            .select(`
                *,
                t1_users ( id, full_name ),
                pocs ( Name, ABI_SFA_City__c ),
                depots ( "Ship to Name" ) 
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        allReports = data; 
        
        populateT1Filter(allReports);
        renderReports(allReports); 

    } catch (error) {
        console.error('Error loading reports:', error);
        reportsListContainer.innerHTML = `<p class="error">Error loading reports: ${error.message}</p>`;
    }
}

// --- 6. Function to Populate T1 Filter ---
function populateT1Filter(reports) {
    const t1s = new Map();
    
    reports.forEach(report => {
        if (report.t1_users) {
            t1s.set(report.t1_user_id, report.t1_users.full_name);
        }
    });

    const sortedT1s = new Map([...t1s.entries()].sort((a, b) => a[1].localeCompare(b[1])));

    if (t1FilterChoiceInstance) {
        t1FilterChoiceInstance.destroy();
    }

    t1FilterSelect.innerHTML = '<option value="all">Show All</option>';
    sortedT1s.forEach((name, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        t1FilterSelect.appendChild(option);
    });

    t1FilterChoiceInstance = new Choices(t1FilterSelect, { 
        searchEnabled: true, 
        searchResultLimit: 10,
        shouldSort: false,
        fuseOptions: {
          shouldSort: true,
          threshold: 0.3,
          ignoreLocation: true,
          minMatchCharLength: 2
        }
    });
}

// --- 7. Render Reports ---
function renderReports(reportsToDisplay) {
    if (reportsToDisplay.length === 0) {
        reportsListContainer.innerHTML = "<p>No reports found for this filter.</p>";
        return;
    }

    // --- UPDATE DISPLAY LOGIC TO USE NEW COLUMNS ---
    reportsListContainer.innerHTML = reportsToDisplay.map(report => {
        const pocName = report.pocs?.Name || 'N/A';
        const pocCity = report.pocs?.ABI_SFA_City__c ? `(${report.pocs.ABI_SFA_City__c})` : '';
        
        // Accessing the column with spaces requires bracket notation ["..."]
        const depotName = report.depots?.["Ship to Name"] || 'N/A';

        return `
        <div class="report-card">
            <div class="report-card-header">
                <span><strong>T1:</strong> ${report.t1_users?.full_name || 'N/A'} </span>
                <span><strong>POC:</strong> ${pocName} ${pocCity}</span>
                <span class="report-date">${new Date(report.created_at).toLocaleDateString()}</span>
            <div class="report-card-actions">
                <button class="btn-edit" data-id="${report.id}"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn-delete" data-id="${report.id}"><i class="fas fa-trash"></i> Delete</button>
            </div>
            </div>
            <div class="report-card-body">
                <p><strong>Depot:</strong> ${depotName}</p>
                <p><strong>Machines:</strong> ${report.machines_sold}</p> 
                <p><strong>Posters:</strong> ${report.posters_distributed}</p>
                <p class="comment"><strong>Comment:</strong> ${report.comment || 'N/A'}</p>
            </div>
        </div>
    `}).join('');
}


// --- 8. Event Listeners ---
t1FilterSelect.addEventListener('change', () => {
    const selectedT1Id = t1FilterSelect.value;

    if (selectedT1Id === 'all') {
        renderReports(allReports); 
    } else {
        const filteredReports = allReports.filter(report => report.t1_user_id === selectedT1Id);
        renderReports(filteredReports);
    }
});

reportsListContainer.addEventListener('click', (e) => {
    const editButton = e.target.closest('.btn-edit');
    const deleteButton = e.target.closest('.btn-delete');

    if (editButton) {
        const reportId = editButton.dataset.id;
        handleEdit(reportId);
    }

    if (deleteButton) {
        const reportId = deleteButton.dataset.id;
        handleDelete(reportId);
    }
});

function handleEdit(id) {
    window.location.href = `index.html?edit_id=${id}`;
}

async function handleDelete(id) {
    if (confirm('Are you sure you want to delete this report?')) {
        try {
            const { error } = await _supabase
                .from('sales_reports')
                .delete()
                .eq('id', id);

            if (error) throw error;
            loadData(); 

        } catch (error) {
            console.error('Error deleting report:', error);
            alert(`Error: ${error.message}`);
        }
    }
}

document.addEventListener('DOMContentLoaded', loadData);