// Sync Logic for Google Sheets and Email Notifications

// Configuration - REPLACE WITH YOUR VALUES
const CONFIG = {
    googleSheetsWebAppUrl: 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL',
    adminEmails: ['mogajaneo@yahoo.com', 'leratom2012@gmail.com'],
    googleSheetsUrl: 'YOUR_GOOGLE_SHEETS_URL'
};

// Auto-sync function
async function autoSync() {
    const syncBtn = document.getElementById('syncBtn');
    const syncIcon = document.getElementById('syncIcon');
    const syncText = document.getElementById('syncText');
    
    try {
        syncBtn.classList.add('syncing');
        syncBtn.disabled = true;
        syncIcon.textContent = '⏳';
        syncText.textContent = 'Tlhabolola...';
        
        // Get unsynced data
        const unsyncedAttendance = await db.getUnsyncedAttendance();
        const unsyncedActions = await db.getUnsyncedActions();
        
        if (unsyncedAttendance.length === 0 && unsyncedActions.length === 0) {
            showSyncStatus('Ga go na se se sa ntšhweng', 'online');
            return;
        }
        
        // Sync attendance records
        for (const record of unsyncedAttendance) {
            await syncAttendanceRecord(record);
            await db.markAttendanceSynced(record.id);
        }
        
        // Sync pending actions
        for (const action of unsyncedActions) {
            await syncAction(action);
            await db.markActionSynced(action.id);
        }
        
        showSyncStatus(`Tlhabololo e atlehile! ${unsyncedAttendance.length + unsyncedActions.length} rekoto`, 'online');
        
    } catch (error) {
        console.error('Sync error:', error);
        showSyncStatus('Phoso ya tlhabololo! Leka gape', 'error');
    } finally {
        syncBtn.classList.remove('syncing');
        syncBtn.disabled = false;
        syncIcon.textContent = '🔄';
        syncText.textContent = 'Tlhabolola';
    }
}

// Sync single attendance record to Google Sheets
async function syncAttendanceRecord(record) {
    try {
        // Prepare data for Google Sheets
        const data = {
            type: 'attendance',
            shepherdName: record.shepherdName,
            date: record.date,
            timestamp: record.timestamp,
            presentLivestock: record.presentLivestock,
            totalActive: LIVESTOCK_DATA.filter(l => !l.is_inactive).length,
            presentCount: record.presentLivestock.length
        };
        
        // Send to Google Apps Script
        const response = await fetch(CONFIG.googleSheetsWebAppUrl, {
            method: 'POST',
            mode: 'no-cors', // Google Apps Script requires this
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        // Send email notification
        await sendEmailNotification(data);
        
        return true;
    } catch (error) {
        console.error('Attendance sync error:', error);
        throw error;
    }
}

// Sync action (add livestock, sold, died)
async function syncAction(action) {
    try {
        const data = {
            type: action.type,
            data: action.data,
            timestamp: action.timestamp
        };
        
        // Send to Google Apps Script
        const response = await fetch(CONFIG.googleSheetsWebAppUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        return true;
    } catch (error) {
        console.error('Action sync error:', error);
        throw error;
    }
}

// Send email notification
async function sendEmailNotification(attendanceData) {
    try {
        const emailBody = {
            to: CONFIG.adminEmails,
            subject: `Livestock Attendance - ${attendanceData.date}`,
            message: `
Attendance Completed

Modisa: ${attendanceData.shepherdName}
Letlha: ${attendanceData.date}

Dikgomo tse di Teng: ${attendanceData.presentCount} / ${attendanceData.totalActive}
Dikgomo tse di Siyo: ${attendanceData.totalActive - attendanceData.presentCount}

View full report: ${CONFIG.googleSheetsUrl}

---
Sent from Livestock Attendance System
            `.trim()
        };
        
        // Use a simple email service (you can use EmailJS or similar)
        // For now, this is handled by the Google Apps Script
        const response = await fetch(CONFIG.googleSheetsWebAppUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'email',
                emailData: emailBody
            })
        });
        
        return true;
    } catch (error) {
        console.error('Email send error:', error);
        // Don't throw - email is not critical
        return false;
    }
}

// Export attendance data for admin review
async function exportAttendanceData() {
    const allRecords = await db.getAllAttendance();
    
    // Convert to CSV
    const csvRows = [
        ['Date', 'Shepherd', 'Total Active', 'Present Count', 'Absent Count', 'Synced'].join(',')
    ];
    
    allRecords.forEach(record => {
        const totalActive = LIVESTOCK_DATA.filter(l => !l.is_inactive).length;
        const presentCount = record.presentLivestock.length;
        const absentCount = totalActive - presentCount;
        
        csvRows.push([
            record.date,
            record.shepherdName,
            totalActive,
            presentCount,
            absentCount,
            record.synced ? 'Yes' : 'No'
        ].join(','));
    });
    
    return csvRows.join('\n');
}

// Download CSV export
async function downloadAttendanceCSV() {
    const csv = await exportAttendanceData();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `livestock-attendance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
