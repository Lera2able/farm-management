// Main Application Logic
let currentShepherd = '';
let livestockState = {}; // Track checkbox states
let currentSearchTerm = '';

// Initialize app
async function initApp() {
    // Check for shepherd name
    const shepherd = await db.getShepherd();
    if (shepherd && shepherd.name) {
        currentShepherd = shepherd.name;
        hideShepherdModal();
        showShepherdInfo();
    } else {
        showShepherdModal();
    }

    // Load saved local state
    livestockState = await db.getAllLocalState();

    // Render livestock
    renderLivestock();

    // Setup search
    document.getElementById('searchInput').addEventListener('input', handleSearch);

    // Update stats
    updateStats();

    // Check network status
    updateNetworkStatus();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
}

// Shepherd Modal
function showShepherdModal() {
    document.getElementById('shepherdModal').style.display = 'flex';
}

function hideShepherdModal() {
    document.getElementById('shepherdModal').style.display = 'none';
}

async function saveShepherdName() {
    const name = document.getElementById('shepherdName').value.trim();
    if (!name) {
        alert('Tsweetswee kwala leina la gago');
        return;
    }
    
    currentShepherd = name;
    await db.saveShepherd(name);
    hideShepherdModal();
    showShepherdInfo();
}

function showShepherdInfo() {
    document.getElementById('shepherdInfo').textContent = `Modisa: ${currentShepherd}`;
}

// Render Livestock Groups
function renderLivestock() {
    const container = document.getElementById('livestockContainer');
    container.innerHTML = '';

    // Group livestock
    const groups = {
        special: [],
        '11': [],
        '55': [],
        '56': [],
        '58': [],
        '72': [],
        other: [],
        inactive: []
    };

    LIVESTOCK_DATA.forEach(item => {
        if (item.is_inactive) {
            groups.inactive.push(item);
        } else {
            groups[item.group].push(item);
        }
    });

    // Render each group
    const groupOrder = ['special', '11', '55', '56', '58', '72', 'other', 'inactive'];
    
    groupOrder.forEach(groupKey => {
        const groupData = groups[groupKey];
        if (groupData.length === 0) return;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'livestock-group';
        groupDiv.innerHTML = `
            <div class="group-header ${groupKey === 'special' ? 'special' : ''} ${groupKey === 'inactive' ? 'inactive' : ''}" 
                 onclick="toggleGroup('${groupKey}')">
                <span>${GROUP_LABELS[groupKey]}</span>
                <span class="group-count">${groupData.length}</span>
            </div>
            <div class="group-content" id="group-${groupKey}">
                ${renderLivestockItems(groupData, groupKey === 'inactive')}
            </div>
        `;
        
        container.appendChild(groupDiv);
    });

    // Apply search filter if active
    if (currentSearchTerm) {
        applySearchFilter();
    }
}

function renderLivestockItems(items, isInactive) {
    return items.map(item => {
        const isPresent = livestockState[item.id] || false;
        const itemClass = `livestock-item ${isInactive ? 'inactive' : ''} ${isPresent ? 'present' : ''}`;
        
        return `
            <div class="${itemClass}" data-livestock-id="${item.id}">
                <div class="checkbox-container">
                    <input type="checkbox" 
                           id="check-${item.id}" 
                           ${isPresent ? 'checked' : ''}
                           ${isInactive ? 'disabled' : ''}
                           onchange="handleCheckboxChange('${item.id}', this.checked)">
                    <div class="checkbox-custom"></div>
                </div>
                
                <div class="livestock-info">
                    <span class="livestock-number">${item.id}</span>
                    ${isInactive ? '<span class="livestock-status inactive-label">Ga e dire</span>' : 
                      isPresent ? '<span class="livestock-status">Teng</span>' : 
                      '<span class="livestock-status">Siyo</span>'}
                </div>
                
                ${isInactive ? 
                    `<a href="#" class="action-link" onclick="editInactive('${item.id}'); return false;">Lokisa</a>` :
                    `<a href="#" class="action-link" onclick="showRegistrationModal('${item.id}'); return false;">Ikwadise</a>`
                }
            </div>
        `;
    }).join('');
}

// Toggle group expand/collapse
function toggleGroup(groupKey) {
    const content = document.getElementById(`group-${groupKey}`);
    content.classList.toggle('expanded');
}

// Handle checkbox change
async function handleCheckboxChange(livestockId, isChecked) {
    livestockState[livestockId] = isChecked;
    await db.saveLocalState(livestockId, isChecked);
    
    // Update visual state
    const item = document.querySelector(`[data-livestock-id="${livestockId}"]`);
    if (item) {
        if (isChecked) {
            item.classList.add('present');
            item.querySelector('.livestock-status').textContent = 'Teng';
        } else {
            item.classList.remove('present');
            item.querySelector('.livestock-status').textContent = 'Siyo';
        }
    }
    
    updateStats();
}

// Update statistics
function updateStats() {
    const activeLivestock = LIVESTOCK_DATA.filter(l => !l.is_inactive);
    const totalActive = activeLivestock.length;
    const present = Object.values(livestockState).filter(v => v === true).length;
    const absent = totalActive - present;
    
    document.getElementById('totalCount').textContent = totalActive;
    document.getElementById('presentCount').textContent = present;
    document.getElementById('absentCount').textContent = absent;
}

// Search functionality
function handleSearch(e) {
    currentSearchTerm = e.target.value.toLowerCase().trim();
    applySearchFilter();
}

function applySearchFilter() {
    const allItems = document.querySelectorAll('.livestock-item');
    let hasMatch = false;
    
    allItems.forEach(item => {
        const livestockId = item.getAttribute('data-livestock-id').toLowerCase();
        
        if (!currentSearchTerm || livestockId.includes(currentSearchTerm)) {
            item.style.display = '';
            hasMatch = true;
            
            // Expand parent group if match found
            if (currentSearchTerm) {
                const groupContent = item.closest('.group-content');
                if (groupContent) {
                    groupContent.classList.add('expanded');
                }
            }
        } else {
            item.style.display = 'none';
        }
    });
    
    // If search term and match found, scroll to first match
    if (currentSearchTerm && hasMatch) {
        const firstMatch = document.querySelector('.livestock-item[style=""]');
        if (firstMatch) {
            firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

// Save Attendance
async function saveAttendance() {
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Boloka...';
    
    try {
        // Get all present livestock
        const presentLivestock = Object.keys(livestockState).filter(id => livestockState[id] === true);
        
        if (presentLivestock.length === 0) {
            alert('Ga go na le leruo le le swerweng!');
            return;
        }
        
        // Save to IndexedDB
        await db.saveAttendance(currentShepherd, presentLivestock);
        
        // Clear local state
        livestockState = {};
        await db.clearLocalState();
        
        // Re-render
        renderLivestock();
        updateStats();
        
        // Show success
        showSyncStatus('Bolokwa ka katlego! ✓', 'online');
        
        // Try to sync immediately if online
        if (navigator.onLine) {
            setTimeout(() => autoSync(), 1000);
        }
        
    } catch (error) {
        console.error('Save error:', error);
        showSyncStatus('Phoso! Leka gape.', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>💾</span> Boloka';
    }
}

// Show Add Modal
function showAddModal() {
    document.getElementById('addModal').classList.remove('hidden');
    document.getElementById('newLivestockNumber').value = '';
}

function closeAddModal() {
    document.getElementById('addModal').classList.add('hidden');
}

async function submitNewLivestock() {
    const number = document.getElementById('newLivestockNumber').value.trim();
    
    if (!number) {
        alert('Tsweetswee kwala nomoro');
        return;
    }
    
    // Check if already exists
    const exists = LIVESTOCK_DATA.some(l => l.id === number);
    if (exists) {
        alert('Nomoro e e teng!');
        return;
    }
    
    // Save as pending action
    await db.savePendingAction('add_livestock', {
        livestockId: number,
        submittedBy: currentShepherd
    });
    
    closeAddModal();
    showSyncStatus('Rometswe go tlhabololo ✓', 'online');
    
    // Try to sync
    if (navigator.onLine) {
        setTimeout(() => autoSync(), 1000);
    }
}

// Show Registration Modal (Sold/Died)
function showRegistrationModal(livestockId) {
    document.getElementById('regLivestockNumber').textContent = livestockId;
    document.getElementById('registrationModal').classList.remove('hidden');
    document.getElementById('regStatus').value = '';
    document.getElementById('regDate').value = new Date().toISOString().split('T')[0];
    
    // Store current livestock ID
    document.getElementById('registrationModal').setAttribute('data-livestock-id', livestockId);
}

function closeRegistrationModal() {
    document.getElementById('registrationModal').classList.add('hidden');
}

async function submitRegistration() {
    const livestockId = document.getElementById('registrationModal').getAttribute('data-livestock-id');
    const status = document.getElementById('regStatus').value;
    const date = document.getElementById('regDate').value;
    
    if (!status) {
        alert('Tsweetswee kgetha kgetho');
        return;
    }
    
    if (!date) {
        alert('Tsweetswee kgetha letlha');
        return;
    }
    
    // Save as pending action
    await db.savePendingAction(status, {
        livestockId,
        date,
        submittedBy: currentShepherd
    });
    
    closeRegistrationModal();
    showSyncStatus('Rometswe go tlhabololo ✓', 'online');
    
    // Try to sync
    if (navigator.onLine) {
        setTimeout(() => autoSync(), 1000);
    }
}

// Edit inactive livestock (admin function)
function editInactive(livestockId) {
    alert(`Lokisa: ${livestockId} - Tiro ya tlhabololo`);
    // This will be implemented in admin interface
}

// Network status
function updateNetworkStatus() {
    if (navigator.onLine) {
        showSyncStatus('Inthanete e teng ✓', 'online');
    } else {
        showSyncStatus('Ga go na Inthanete - Offline mode', 'offline');
    }
}

function handleOnline() {
    updateNetworkStatus();
    autoSync();
}

function handleOffline() {
    updateNetworkStatus();
}

function showSyncStatus(message, type) {
    const statusDiv = document.getElementById('syncStatus');
    statusDiv.textContent = message;
    statusDiv.className = `sync-status ${type}`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'sync-status';
    }, 5000);
}

// Manual sync
async function manualSync() {
    if (!navigator.onLine) {
        showSyncStatus('Ga go na Inthanete!', 'error');
        return;
    }
    
    await autoSync();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
