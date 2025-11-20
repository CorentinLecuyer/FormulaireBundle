// --- 1. SETUP ---
const SUPABASE_URL = 'https://nxgfcjqjhjbermxcobkv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54Z2ZjanFqaGpiZXJteGNvYmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1ODcxMTUsImV4cCI6MjA3NzE2MzExNX0.YcIZo_9UfNjgjMMrgEUh6Z1O_G90oRAlBNMzkxrGlZg';

// --- 2. Initialize Supabase Client ---
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 3. DOM Elements ---
const reportsListContainer = document.getElementById('reports-list');
const t1FilterSelect = document.getElementById('t1-filter');
const downloadBtn = document.getElementById('download-btn'); // NEW BUTTON

// --- 4. Data Storage ---
let allReports = [];
let currentFilteredReports = [];
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
        currentFilteredReports = data;

        populateT1Filter(allReports);
        renderReports(allReports);

    } catch (error) {
        console.error('Error loading reports:', error);
        reportsListContainer.innerHTML = `<p class="error">Error loading reports: ${error.message}</p>`;
    }
}

function downloadXLSX() {
    if (!currentFilteredReports || currentFilteredReports.length === 0) {
        alert("No data to download.");
        return;
    }

    // 1. Map the data into a clean JSON format for Excel
    const excelData = currentFilteredReports.map(row => {
        // Resolve POC Name
        let pocName = row.pocs?.Name;
        if (!pocName && row.Inexistant_POCname) pocName = `${row.Inexistant_POCname} (Manuel)`;

        // Resolve Depot Name
        let depotName = row.depots?.["Ship to Name"];
        if (!depotName && row.Inexistant_DepotName) depotName = `${row.Inexistant_DepotName} (Manuel)`;

        return {
            "Date": new Date(row.created_at).toLocaleDateString(),
            "T1 Name": row.t1_users?.full_name || 'N/A',
            "POC Name": pocName || 'N/A',
            "POC City": row.pocs?.ABI_SFA_City__c || '',
            "POC SAP ID": row.pocs?.ABI_SFA_SAPID__c || '',
            "Depot Name": depotName || 'N/A',
            "Depot Number": row.depots?.["Ship to number"] || '',
            "Machines Sold": row.machines_sold,
            "Posters Distributed": row.posters_distributed,
            "Comment": row.comment || ''
        };
    });

    // 2. Create a Worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Optional: Auto-adjust column widths (makes it look professional)
    const wscols = [
        { wch: 12 }, // Date
        { wch: 20 }, // T1
        { wch: 30 }, // POC Name
        { wch: 15 }, // City
        { wch: 15 }, // SAP ID
        { wch: 30 }, // Depot
        { wch: 15 }, // Depot Num
        { wch: 15 }, // Machines
        { wch: 15 }, // Posters
        { wch: 50 }  // Comment
    ];
    worksheet['!cols'] = wscols;

    // 3. Create a Workbook and append the worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Reports");

    // 4. Generate file name with date
    const fileName = `Sales_Reports_${new Date().toISOString().split('T')[0]}.xlsx`;

    // 5. Download
    XLSX.writeFile(workbook, fileName);
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
        reportsListContainer.innerHTML = "<p>No reports found.</p>";
        return;
    }

    reportsListContainer.innerHTML = reportsToDisplay.map(report => {
        // LOGIC: Try to get linked name. If null, check for Manual Name. Else N/A.
        let pocDisplay = report.pocs?.Name;
        if (!pocDisplay && report.Inexistant_POCname) {
            pocDisplay = `${report.Inexistant_POCname} (Manuel)`;
        } else if (!pocDisplay) {
            pocDisplay = 'N/A';
        }

        const pocCity = report.pocs?.ABI_SFA_City__c ? `(${report.pocs.ABI_SFA_City__c})` : '';

        let depotDisplay = report.depots?.["Ship to Name"];
        if (!depotDisplay && report.Inexistant_DepotName) {
            depotDisplay = `${report.Inexistant_DepotName} (Manuel)`;
        } else if (!depotDisplay) {
            depotDisplay = 'N/A';
        }

        return `
        <div class="report-card">
            <div class="report-card-header">
                <span><strong>T1:</strong> ${report.t1_users?.full_name || 'N/A'} </span>
                <span><strong>POC:</strong> ${pocDisplay} ${pocCity}</span>
                <span class="report-date">${new Date(report.created_at).toLocaleDateString()}</span>
            <div class="report-card-actions">
                <button class="btn-edit" data-id="${report.id}"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn-delete" data-id="${report.id}"><i class="fas fa-trash"></i> Delete</button>
            </div>
            </div>
            <div class="report-card-body">
                <p><strong>Depot:</strong> ${depotDisplay}</p>
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
        currentFilteredReports = allReports;
        renderReports(allReports);
    } else {
        currentFilteredReports = allReports.filter(report => report.t1_user_id === selectedT1Id);
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

downloadBtn.addEventListener('click', downloadXLSX);
document.addEventListener('DOMContentLoaded', loadData);