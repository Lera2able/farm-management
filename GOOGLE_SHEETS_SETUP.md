# Google Sheets Setup Guide for Livestock Attendance System

## Overview
This guide will help you set up Google Sheets integration for automatic attendance tracking and email notifications.

## Step 1: Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it: **Dikgomo Attendance Register**
4. Create tabs for each month:
   - January
   - February
   - March
   - April
   - May
   - June
   - July
   - August
   - September
   - October
   - November
   - December

## Step 2: Set Up Sheet Structure

For each month tab, create the following structure:

### Row 1: Headers
```
| Nomoro ya Leruo | 2026-04-28 | 2026-04-29 | 2026-04-30 | ...
```

### Row 2 onwards: Livestock IDs
```
| Rikus           | ✓          |            | ✓          |
| 11001           | ✓          | ✓          |            |
| 11002           |            | ✓          | ✓          |
...
```

## Step 3: Create Google Apps Script

1. In your Google Sheet, click **Extensions** > **Apps Script**
2. Delete any existing code
3. Copy and paste the following script:

```javascript
// Google Apps Script for Livestock Attendance System

// Email Configuration
const ADMIN_EMAILS = ['mogajaneo@yahoo.com', 'leratom2012@gmail.com'];
const SHEET_ID = 'YOUR_SHEET_ID_HERE'; // Get from URL
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    if (data.type === 'attendance') {
      handleAttendance(data);
    } else if (data.type === 'add_livestock') {
      handleAddLivestock(data);
    } else if (data.type === 'sold' || data.type === 'died') {
      handleRegistration(data);
    } else if (data.type === 'email') {
      sendEmail(data.emailData);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function handleAttendance(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  // Get month from date
  const date = new Date(data.timestamp);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[date.getMonth()];
  
  // Get or create month sheet
  let sheet = ss.getSheetByName(monthName);
  if (!sheet) {
    sheet = ss.insertSheet(monthName);
    initializeMonthSheet(sheet);
  }
  
  // Add date column if not exists
  const dateStr = data.date;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let dateCol = headers.indexOf(dateStr);
  
  if (dateCol === -1) {
    // Add new date column
    dateCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, dateCol).setValue(dateStr);
  } else {
    dateCol += 1; // Convert to 1-based index
  }
  
  // Update attendance for each livestock
  const allLivestock = getAllLivestockIds();
  allLivestock.forEach((livestockId, index) => {
    const row = index + 2; // Row 1 is header
    const isPresent = data.presentLivestock.includes(livestockId);
    sheet.getRange(row, dateCol).setValue(isPresent ? '✓' : '-');
  });
  
  // Send email notification
  sendAttendanceEmail(data);
}

function initializeMonthSheet(sheet) {
  // Set header
  sheet.getRange(1, 1).setValue('Nomoro ya Leruo');
  
  // Add all livestock IDs
  const allLivestock = getAllLivestockIds();
  allLivestock.forEach((id, index) => {
    sheet.getRange(index + 2, 1).setValue(id);
  });
  
  // Format
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
}

function getAllLivestockIds() {
  // This should match your livestock data
  // For now, returning a placeholder - you'll need to update this
  return ['Rikus']; // Add all your livestock IDs here
}

function handleAddLivestock(data) {
  // Store pending livestock additions in a separate sheet
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let pendingSheet = ss.getSheetByName('Pending Additions');
  
  if (!pendingSheet) {
    pendingSheet = ss.insertSheet('Pending Additions');
    pendingSheet.getRange(1, 1, 1, 4).setValues([['Timestamp', 'Livestock ID', 'Submitted By', 'Status']]);
  }
  
  const lastRow = pendingSheet.getLastRow() + 1;
  pendingSheet.getRange(lastRow, 1, 1, 4).setValues([[
    new Date(data.data.timestamp),
    data.data.livestockId,
    data.data.submittedBy,
    'Pending'
  ]]);
  
  // Send notification to admins
  sendAdminNotification('New Livestock Addition Request', 
    `New livestock number submitted: ${data.data.livestockId}\nSubmitted by: ${data.data.submittedBy}`);
}

function handleRegistration(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let registrationSheet = ss.getSheetByName('Sold/Died Register');
  
  if (!registrationSheet) {
    registrationSheet = ss.insertSheet('Sold/Died Register');
    registrationSheet.getRange(1, 1, 1, 5).setValues([['Timestamp', 'Livestock ID', 'Status', 'Date', 'Submitted By']]);
  }
  
  const lastRow = registrationSheet.getLastRow() + 1;
  registrationSheet.getRange(lastRow, 1, 1, 5).setValues([[
    new Date(data.timestamp),
    data.data.livestockId,
    data.type === 'sold' ? 'Rekisitswe' : 'Sule',
    data.data.date,
    data.data.submittedBy
  ]]);
  
  // Send notification to admins
  sendAdminNotification('Livestock Status Update', 
    `Livestock: ${data.data.livestockId}\nStatus: ${data.type === 'sold' ? 'Sold' : 'Died'}\nDate: ${data.data.date}\nSubmitted by: ${data.data.submittedBy}`);
}

function sendAttendanceEmail(data) {
  const subject = `Livestock Attendance - ${data.date}`;
  const body = `
Attendance Completed

Modisa: ${data.shepherdName}
Letlha: ${data.date}

Dikgomo tse di Teng: ${data.presentCount} / ${data.totalActive}
Dikgomo tse di Siyo: ${data.totalActive - data.presentCount}

View full report: ${SHEET_URL}

---
Sent from Livestock Attendance System
  `.trim();
  
  ADMIN_EMAILS.forEach(email => {
    MailApp.sendEmail(email, subject, body);
  });
}

function sendAdminNotification(subject, message) {
  ADMIN_EMAILS.forEach(email => {
    MailApp.sendEmail(email, `[Livestock System] ${subject}`, message);
  });
}

function sendEmail(emailData) {
  emailData.to.forEach(email => {
    MailApp.sendEmail(email, emailData.subject, emailData.message);
  });
}

// Web app must be accessible to anyone
function doGet(e) {
  return ContentService.createTextOutput('Livestock Attendance API is running');
}
```

4. Click **Save** (💾 icon)
5. Name your project: "Livestock Attendance Backend"

## Step 4: Deploy as Web App

1. Click **Deploy** > **New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Choose **Web app**
4. Fill in:
   - **Description**: "Livestock Attendance API"
   - **Execute as**: Me
   - **Who has access**: Anyone
5. Click **Deploy**
6. **IMPORTANT**: Copy the **Web App URL** that appears
   - It will look like: `https://script.google.com/macros/s/XXXXX/exec`

## Step 5: Configure the Mobile App

1. Open the file `sync.js` in your mobile app
2. Find this section:
```javascript
const CONFIG = {
    googleSheetsWebAppUrl: 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL',
    adminEmails: ['mogajaneo@yahoo.com', 'leratom2012@gmail.com'],
    googleSheetsUrl: 'YOUR_GOOGLE_SHEETS_URL'
};
```

3. Replace:
   - `YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL` with the Web App URL you copied
   - `YOUR_GOOGLE_SHEETS_URL` with your Google Sheets URL (from browser address bar)

## Step 6: Update Livestock IDs in Apps Script

In your Apps Script, update the `getAllLivestockIds()` function with all your livestock IDs:

```javascript
function getAllLivestockIds() {
  return [
    'Rikus',
    '11001',
    '11002',
    // ... add all your livestock IDs here
  ];
}
```

Or better yet, read them from a "Master List" sheet:

```javascript
function getAllLivestockIds() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const masterSheet = ss.getSheetByName('Master List');
  
  if (!masterSheet) return [];
  
  const data = masterSheet.getRange(2, 1, masterSheet.getLastRow() - 1, 1).getValues();
  return data.map(row => row[0]).filter(id => id);
}
```

## Step 7: Test the Integration

1. Open the mobile app
2. Mark some livestock as present
3. Click "Boloka" (Save)
4. Click "Tlhabolola" (Sync)
5. Check your Google Sheet - you should see the attendance recorded
6. Check your email - you should receive a notification

## Troubleshooting

### Issue: No data appearing in Google Sheets
**Solution**: 
- Make sure the Web App URL is correct in `sync.js`
- Check Apps Script **Executions** tab for errors
- Ensure deployment is set to "Anyone" access

### Issue: Not receiving emails
**Solution**:
- Check spam folder
- Verify email addresses in Apps Script are correct
- Check Apps Script quota (Gmail has daily limits)

### Issue: Sync button shows error
**Solution**:
- Check browser console (F12) for error messages
- Ensure you have internet connection when syncing
- Try deploying a new version of the Apps Script

## Monthly Maintenance

At the start of each month, create a new month tab in your Google Sheet. The system will automatically initialize it when first attendance is recorded.

## Security Notes

- The Apps Script runs with your permissions
- Only you and specified admins receive email notifications
- Farm workers can only submit data, not view the full sheet
- Consider enabling 2-factor authentication on your Google account

---

## Support

For technical issues, contact:
- Lerato: leratom2012@gmail.com
- Neo: mogajaneo@yahoo.com
