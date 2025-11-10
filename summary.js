// --- 1. SETUP: Must be the same as your script.js ---
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
let t1FilterChoiceInstance = null; // <-- Store the instance

// --- 5. Main Function to Load Data ---
async function loadData() {
    try {
        reportsListContainer.innerHTML = "<p>Loading reports...</p>";

        const { data, error } = await _supabase
            .from('sales_reports')
            .select(`
                *,
                t1_users ( id, full_name ),
                pocs ( poc_name ),
                depots ( depot_name )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        allReports = data; // Store the data
        
        populateT1Filter(allReports); // Populate the filter
        renderReports(allReports); // Render the initial full list

    } catch (error) {
        console.error('Error loading reports:', error);
        reportsListContainer.innerHTML = `<p class="error">Error loading reports: ${error.message}</p>`;
    }
}

// --- 6. UPDATED Function to Populate T1 Filter ---
function populateT1Filter(reports) {
    const t1s = new Map();
    
    // Create a unique list of T1s from the reports
    reports.forEach(report => {
        if (report.t1_users) {
            t1s.set(report.t1_user_id, report.t1_users.full_name);
        }
    });

    // Sort the T1s alphabetically by name
    const sortedT1s = new Map([...t1s.entries()].sort((a, b) => a[1].localeCompare(b[1])));

    if (t1FilterChoiceInstance) {
        t1FilterChoiceInstance.destroy();
    }


    // Populate the select dropdown
    t1FilterSelect.innerHTML = '<option value="all">Show All</option>';
    sortedT1s.forEach((name, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        t1FilterSelect.appendChild(option);
    });

    // Initialize Choices.js on the filter dropdown
    t1FilterChoiceInstance = new Choices(t1FilterSelect, { 
        searchEnabled: true, 
        searchResultLimit: 10,
        shouldSort: false, // We already sorted it

        fuseOptions: {
            shouldSort: true, // Sort results by relevance
            threshold: 0.1,   // Be more strict (0.0 = perfect match, 1.0 = match all)
            ignoreLocation: true, // Search the entire string, not just the start
            minMatchCharLength: 1  // Only find matches of 1 char or more
        }
    });
}

// --- 7. NEW Function to Render Reports ---
function renderReports(reportsToDisplay) {
    if (reportsToDisplay.length === 0) {
        reportsListContainer.innerHTML = "<p>No reports found for this filter.</p>";
        return;
    }

    // Build the HTML for the list
    reportsListContainer.innerHTML = reportsToDisplay.map(report => `
        <div class="report-card">
            <div class="report-card-header">
                <span><strong>T1:</strong> ${report.t1_users?.full_name || 'N/A'} </span>
                <span><strong>POC:</strong> ${report.pocs?.poc_name || 'N/A'}</span>
                <span class="report-date">${new Date(report.created_at).toLocaleDateString()}</span>
            <div class="report-card-actions">
                <button class="btn-edit" data-id="${report.id}"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn-delete" data-id="${report.id}"><i class="fas fa-trash"></i> Delete</button>
            </div>
            </div>
            <div class="report-card-body">
                <p><strong>Depot:</strong> ${report.depots?.depot_name || 'N/A'}</p>
                <p><strong>Machines:</strong> ${report.machines_sold}</p> 
                <p><strong>Posters:</strong> ${report.posters_distributed}</p>
                <p class="comment"><strong>Comment:</strong> ${report.comment || 'N/A'}</p>
            </div>
        </div>
    `).join('');
}


// --- 8. Event Listeners ---

// Listen for changes on the T1 filter
t1FilterSelect.addEventListener('change', () => {
    const selectedT1Id = t1FilterSelect.value;

    if (selectedT1Id === 'all') {
        renderReports(allReports); // Show all
    } else {
        // Filter the reports
        const filteredReports = allReports.filter(report => report.t1_user_id === selectedT1Id);
        renderReports(filteredReports);
    }
});

// Handle Edit/Delete Clicks (this is the same as before)
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

            // --- UPDATED: Reload data from scratch to update list and filter ---
            loadData(); // This will now correctly rebuild the Choices.js filter

        } catch (error) {
            console.error('Error deleting report:', error);
            alert(`Error: ${error.message}`);
        }
    }
}

// --- 9. Load data when the page is ready ---
document.addEventListener('DOMContentLoaded', loadData);