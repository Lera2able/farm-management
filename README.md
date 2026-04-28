# Livestock Attendance System (Dikgomo)

A mobile-first Progressive Web App for tracking livestock attendance offline with automatic sync to Google Sheets and email notifications.

## Features

✅ **Offline-First**: Works without internet connection  
✅ **Setswana Interface**: All labels in Setswana for farm workers  
✅ **Auto-Save**: Saves locally on every checkbox tick  
✅ **Smart Grouping**: Livestock organized by number ranges  
✅ **Search**: Quick search to find specific livestock  
✅ **Sync**: Automatic sync when network is available  
✅ **Email Notifications**: Sends summary to admins  
✅ **Google Sheets Integration**: Automatic monthly attendance tracking  
✅ **Sold/Died Registration**: Track livestock status changes  
✅ **Add New Livestock**: Request additions (admin approval)  

## System Requirements

- Modern web browser (Chrome, Safari, Firefox, Edge)
- Internet connection (only needed for initial setup and syncing)
- Google Account (for Google Sheets integration)

## Quick Start

### 1. Deploy the App

You have several options to deploy:

#### Option A: GitHub Pages (Recommended - Free)

1. Create a GitHub account if you don't have one
2. Create a new repository called `livestock-attendance`
3. Upload all files from this folder to the repository
4. Go to **Settings** > **Pages**
5. Under "Source", select "main" branch
6. Click Save
7. Your app will be available at: `https://your-username.github.io/livestock-attendance/`

#### Option B: Netlify (Free, Easy)

1. Go to [netlify.com](https://netlify.com)
2. Sign up for free account
3. Drag and drop this entire folder
4. Your app will be deployed automatically
5. You'll get a URL like: `https://random-name.netlify.app`

#### Option C: Web Server

Upload all files to any web hosting service.

### 2. Set Up Google Sheets

Follow the complete guide in `GOOGLE_SHEETS_SETUP.md`

Key steps:
1. Create Google Sheet with monthly tabs
2. Add Apps Script code
3. Deploy as Web App
4. Copy the Web App URL
5. Update `sync.js` with your URL

### 3. Install on Phones

#### For Android:

1. Open the app URL in Chrome
2. Tap the menu (⋮) in the top right
3. Tap "Add to Home screen"
4. Confirm
5. The app will now work like a native app, even offline!

#### For iPhone:

1. Open the app URL in Safari
2. Tap the Share button
3. Scroll and tap "Add to Home Screen"
4. Confirm
5. Done!

## File Structure

```
livestock-attendance/
│
├── index.html              # Main farm worker interface
├── styles.css              # All styling
├── app.js                  # Main application logic
├── db.js                   # IndexedDB for offline storage
├── sync.js                 # Google Sheets & email sync
├── service-worker.js       # PWA offline functionality
├── manifest.json           # PWA configuration
├── livestock-data.js       # Livestock IDs and grouping
│
├── GOOGLE_SHEETS_SETUP.md  # Google Sheets setup guide
└── README.md               # This file
```

## How It Works

### For Farm Workers (Simple View)

1. **First Time**: Enter your name as shepherd
2. **Search** (Phuruphutsa): Type livestock number to find quickly
3. **Groups**: Tap to expand groups (11xxx, 55xxx, etc.)
4. **Tick Boxes**: Mark "Teng" (Present) for each animal
5. **Save** (Boloka): Click the sticky save button (auto-saves too)
6. **Sold/Died**: Click "Ikwadise" link to register status change
7. **Sync** (Tlhabolola): Automatic when network available, or tap button

### Offline Mode

- All ticks are saved locally on the phone
- Multiple days can be recorded offline
- When network is detected, data syncs automatically
- Or manually tap "Tlhabolola" (Sync) when you have signal

### For Admins (You & Your Husband)

- Receive email notifications for:
  - Daily attendance summaries
  - New livestock addition requests
  - Sold/Died registrations
  
- View full data in Google Sheets:
  - Monthly tabs with attendance
  - "Pending Additions" tab
  - "Sold/Died Register" tab

## Setswana Translation Reference

| English | Setswana |
|---------|----------|
| Search | Phuruphutsa |
| Add New Number | Tsenya Nomoro e Ntšhwa |
| Save | Boloka |
| Update/Sync | Tlhabolola |
| Present | Teng |
| Absent | Siyo |
| Inactive | Ga e dire |
| Sold | Rekisitswe |
| Died | Sule |
| Date | Letlha |
| Livestock Number | Nomoro ya Leruo |
| Register/Mark | Ikwadise/Tshwaya |
| Shepherd | Modisa |

## Troubleshooting

### Problem: App won't load
**Solution**: Clear browser cache, reload page

### Problem: Checkboxes don't save
**Solution**: Check browser supports IndexedDB (all modern browsers do)

### Problem: Sync fails
**Solution**: 
1. Check internet connection
2. Verify Google Apps Script Web App URL is correct
3. Check Apps Script deployment is set to "Anyone"

### Problem: No email received
**Solution**:
1. Check spam folder
2. Verify email addresses in Apps Script
3. Check Google Apps Script execution logs

### Problem: Data not in Google Sheets
**Solution**:
1. Open Apps Script and check "Executions" tab for errors
2. Ensure Web App is deployed with "Anyone" access
3. Check SHEET_ID is correct in Apps Script

## Customization

### Change Colors

Edit `styles.css`:
```css
:root {
    --primary-green: #2c5f2d;  /* Change main color */
    --light-green: #4a9b4d;
    --red: #c92a2a;
}
```

### Add More Livestock

1. Update `livestock-data.js` with new IDs
2. Add to Google Apps Script `getAllLivestockIds()` function
3. Add to "Master List" sheet if using that method

### Change Email Recipients

Update `sync.js`:
```javascript
const CONFIG = {
    adminEmails: ['email1@example.com', 'email2@example.com'],
    ...
};
```

Also update in Google Apps Script:
```javascript
const ADMIN_EMAILS = ['email1@example.com', 'email2@example.com'];
```

## Security & Privacy

- Data is stored locally on each phone
- Sync only happens when manually triggered or automatic with network
- Google Sheets is private to you and specified admins
- Farm workers cannot see the Google Sheets
- No external tracking or analytics

## Data Backup

Your data is safe in multiple places:
1. Locally on each farm worker's phone
2. Google Sheets (cloud backup)
3. Email notifications (additional record)

**Recommendation**: Download monthly Google Sheets as Excel backup

## Future Enhancements

Possible additions:
- Admin interface for approving additions
- Photo upload for livestock
- Offline maps for signal spots
- Reports and analytics
- Multi-farm support

## Support

Technical support:
- Lerato: leratom2012@gmail.com
- Neo: mogajaneo@yahoo.com

## License

This system was custom-built for personal farm management use.

---

**Last Updated**: April 2026  
**Version**: 1.0  
**Built with**: Vanilla JavaScript, IndexedDB, Google Sheets API
