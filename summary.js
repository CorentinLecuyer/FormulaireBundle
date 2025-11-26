// --- 1. SETUP ---
const SUPABASE_URL = 'https://nxgfcjqjhjbermxcobkv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54Z2ZjanFqaGpiZXJteGNvYmt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1ODcxMTUsImV4cCI6MjA3NzE2MzExNX0.YcIZo_9UfNjgjMMrgEUh6Z1O_G90oRAlBNMzkxrGlZg';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const reportsListContainer = document.getElementById('reports-list');
const t1FilterSelect = document.getElementById('t1-filter');
const downloadBtn = document.getElementById('download-btn');

let allReports = [];
let currentFilteredReports = [];
let t1FilterChoiceInstance = null;

// --- 2. Load Data ---
async function loadData() {
    try {
        reportsListContainer.innerHTML = "<p>Loading reports...</p>";

        // ▼▼▼ KEY FIX IS IN THIS QUERY ▼▼▼
        const { data, error } = await _supabase
            .from('sales_reports')
            .select(`
                *,
                t1_users ( id, full_name ),
                pocs ( Name, ABI_SFA_City__c, ABI_SFA_SAPID__c ),
                depots ( "Ship to Name", "Ship to number" ) 
            `)
            // We explicitly added ABI_SFA_SAPID__c and "Ship to number" above
            .order('created_at', { ascending: false })
            .range(0, 4999);

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

// --- 3. Populate Filter ---
function populateT1Filter(reports) {
    const t1s = new Map();
    reports.forEach(report => {
        if (report.t1_users) {
            t1s.set(report.t1_user_id, report.t1_users.full_name);
        }
    });

    const sortedT1s = new Map([...t1s.entries()].sort((a, b) => a[1].localeCompare(b[1])));

    if (t1FilterChoiceInstance) t1FilterChoiceInstance.destroy();

    t1FilterSelect.innerHTML = '<option value="all">Show All</option>';
    sortedT1s.forEach((name, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        t1FilterSelect.appendChild(option);
    });

    t1FilterChoiceInstance = new Choices(t1FilterSelect, { 
        searchEnabled: true, searchResultLimit: 10, shouldSort: false,
        fuseOptions: { shouldSort: true, threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2 }
    });
}

// --- 4. Render Reports ---
function renderReports(reportsToDisplay) {
    currentFilteredReports = reportsToDisplay

    const totalMachines = reportsToDisplay.reduce((sum, r) => sum + (r.machines_sold || 0), 0);
    const totalPosters = reportsToDisplay.reduce((sum, r) => sum + (r.posters_distributed || 0), 0);

    // Animate the numbers (optional simple update)
    document.getElementById('total-machines').textContent = totalMachines.toLocaleString();
    document.getElementById('total-posters').textContent = totalPosters.toLocaleString();
    

    if (reportsToDisplay.length === 0) {
        reportsListContainer.innerHTML = "<p>No reports found for this filter.</p>";
        return;
    }

    reportsListContainer.innerHTML = reportsToDisplay.map(report => {
        // Display Logic for the Card
        let pocDisplay = report.pocs?.Name;
        if (!pocDisplay && report.Inexistant_POCname) pocDisplay = `${report.Inexistant_POCname} (Manuel)`;
        else if (!pocDisplay) pocDisplay = 'N/A';
        
        const pocCity = report.pocs?.ABI_SFA_City__c ? `(${report.pocs.ABI_SFA_City__c})` : '';
        
        let depotDisplay = report.depots?.["Ship to Name"];
        if (!depotDisplay && report.Inexistant_DepotName) depotDisplay = `${report.Inexistant_DepotName} (Manuel)`;
        else if (!depotDisplay) depotDisplay = 'N/A';

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

// --- 5. EXCEL DOWNLOAD FUNCTION ---
function downloadXLSX() {
    if (!currentFilteredReports || currentFilteredReports.length === 0) {
        alert("No data to download.");
        return;
    }

    const excelData = currentFilteredReports.map(row => {
        
        // --- 1. POC LOGIC ---
        // Name
        let pocName = row.pocs?.Name;
        if (!pocName && row.Inexistant_POCname) pocName = `${row.Inexistant_POCname} (Manuel)`;
        
        // ID: Try the Linked Table column first. If empty, check if manual name exists.
        let pocId = row.pocs?.ABI_SFA_SAPID__c; 
        if (!pocId && row.Inexistant_POCname) pocId = "00000000";


        // --- 2. DEPOT LOGIC ---
        // Name
        let depotName = row.depots?.["Ship to Name"];
        if (!depotName && row.Inexistant_DepotName) depotName = `${row.Inexistant_DepotName} (Manuel)`;

        // Number: Try the Linked Table column first.
        let depotNumber = row.depots?.["Ship to number"];
        if (!depotNumber && row.Inexistant_DepotName) depotNumber = "00000000";

        return {
            "Date": new Date(row.created_at).toLocaleDateString(),
            "T1 Name": row.t1_users?.full_name || 'N/A',
            "POC Name": pocName || 'N/A',
            "POC City": row.pocs?.ABI_SFA_City__c || '',
            "POC SAP ID": pocId || '', // This should now populate
            "Depot Name": depotName || 'N/A',
            "Depot Number": depotNumber || '', // This should now populate
            "Machines Sold": row.machines_sold,
            "Posters Distributed": row.posters_distributed,
            "Comment": row.comment || ''
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    const wscols = [
        { wch: 12 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, 
        { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 50 }
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Reports");

    const fileName = `Sales_Reports_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
}

// --- 6. Event Listeners ---
downloadBtn.addEventListener('click', downloadXLSX);

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

    if (editButton) handleEdit(editButton.dataset.id);
    if (deleteButton) handleDelete(deleteButton.dataset.id);
});

function handleEdit(id) {
    window.location.href = `index.html?edit_id=${id}`;
}

async function handleDelete(id) {
    if (confirm('Are you sure you want to delete this report?')) {
        try {
            const { error } = await _supabase.from('sales_reports').delete().eq('id', id);
            if (error) throw error;
            loadData(); 
        } catch (error) {
            console.error('Error deleting report:', error);
            alert(`Error: ${error.message}`);
        }
    }
}

document.addEventListener('DOMContentLoaded', loadData);