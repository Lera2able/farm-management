# Deployment Checklist for Livestock Attendance System

## Pre-Deployment (Do These First)

- [ ] Read through `README.md` completely
- [ ] Read through `GOOGLE_SHEETS_SETUP.md`
- [ ] Choose deployment method (GitHub Pages, Netlify, or web server)
- [ ] Have Google Account ready
- [ ] Have livestock data ready

## Step 1: Set Up Google Sheets (30 minutes)

- [ ] Create new Google Sheet: "Dikgomo Attendance Register"
- [ ] Create 12 monthly tabs (January - December)
- [ ] Set up first month with headers:
  - Column A: "Nomoro ya Leruo"
  - Row 1: Date headers (will be added automatically)
- [ ] Create "Master List" sheet with all livestock IDs
- [ ] Create "Pending Additions" sheet
- [ ] Create "Sold/Died Register" sheet

## Step 2: Set Up Google Apps Script (20 minutes)

- [ ] Open Google Sheet
- [ ] Go to Extensions > Apps Script
- [ ] Copy code from `GOOGLE_SHEETS_SETUP.md`
- [ ] Update `SHEET_ID` with your sheet ID (from URL)
- [ ] Update `ADMIN_EMAILS` with your emails
- [ ] Update `getAllLivestockIds()` function with your livestock IDs
- [ ] Save the script
- [ ] Deploy as Web App
- [ ] Set "Execute as" to "Me"
- [ ] Set "Who has access" to "Anyone"
- [ ] Click Deploy
- [ ] **COPY THE WEB APP URL** - you'll need this!

## Step 3: Configure the App (5 minutes)

- [ ] Open `sync.js` in a text editor
- [ ] Find the `CONFIG` section at the top
- [ ] Replace `YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL` with the URL you copied
- [ ] Replace `YOUR_GOOGLE_SHEETS_URL` with your Google Sheets URL
- [ ] Verify email addresses are correct
- [ ] Save the file

## Step 4: Update Livestock Data (10 minutes)

Your livestock data is already in `livestock-data.js`, but verify:

- [ ] Open `livestock-data.js`
- [ ] Check all livestock IDs are present
- [ ] Verify groupings are correct
- [ ] Check inactive (red) animals are marked correctly
- [ ] Verify "Rikus" is marked as special

## Step 5: Deploy the App (15 minutes)

### If using GitHub Pages:

- [ ] Create GitHub account
- [ ] Create new repository: `livestock-attendance`
- [ ] Upload all files to repository
- [ ] Go to Settings > Pages
- [ ] Select "main" branch as source
- [ ] Wait 2-3 minutes for deployment
- [ ] Test the URL: `https://your-username.github.io/livestock-attendance/`

### If using Netlify:

- [ ] Go to netlify.com
- [ ] Sign up for free account
- [ ] Drag and drop the entire folder
- [ ] Wait for deployment
- [ ] Test the URL

## Step 6: Create App Icons (5 minutes)

Option A: Use Placeholder
- [ ] Rename any 512x512 cow image to `icon-512.png`
- [ ] Resize it to create `icon-192.png`
- [ ] Upload both to your deployment

Option B: Create Custom
- [ ] Use an online icon generator
- [ ] Create 512x512 and 192x192 versions
- [ ] Save as `icon-512.png` and `icon-192.png`
- [ ] Upload to your deployment

## Step 7: Test Everything (15 minutes)

- [ ] Open the app URL on your phone
- [ ] Test offline mode (turn off wifi/data)
- [ ] Mark some livestock present
- [ ] Save the attendance
- [ ] Turn on internet
- [ ] Click sync
- [ ] Check Google Sheets - data should appear
- [ ] Check email - you should receive notification
- [ ] Test search function
- [ ] Test add new livestock
- [ ] Test sold/died registration

## Step 8: Install on Farm Workers' Phones (10 minutes per phone)

### Android:
- [ ] Open app URL in Chrome
- [ ] Tap menu (⋮)
- [ ] Tap "Add to Home screen"
- [ ] Enter shepherd name on first launch
- [ ] Test that app works offline

### iPhone:
- [ ] Open app URL in Safari
- [ ] Tap Share button
- [ ] Tap "Add to Home Screen"
- [ ] Enter shepherd name on first launch
- [ ] Test that app works offline

## Step 9: Admin Setup (5 minutes)

- [ ] Test admin interface at `your-url/admin.html`
- [ ] Bookmark it on your phone
- [ ] Test approving pending additions
- [ ] Test approving sold/died registrations
- [ ] Test downloading CSV export

## Step 10: Training (30 minutes)

Farm Workers Training:
- [ ] Show how to open the app
- [ ] Explain the groups (11xxx, 55xxx, etc.)
- [ ] Demonstrate search
- [ ] Show how to tick boxes
- [ ] Explain save button (sticky at top)
- [ ] Demonstrate sold/died registration
- [ ] Show add new livestock
- [ ] Explain when to go to signal spot for sync

## Post-Deployment

- [ ] Set up weekly backup reminder
- [ ] Schedule monthly Google Sheets export
- [ ] Add admin.html URL to your bookmarks
- [ ] Print out this checklist for reference
- [ ] Keep a backup of all files

## Troubleshooting Checklist

If sync doesn't work:
- [ ] Check internet connection
- [ ] Verify Web App URL in sync.js is correct
- [ ] Check Apps Script deployment status
- [ ] Review Apps Script execution logs
- [ ] Try redeploying Apps Script

If emails don't arrive:
- [ ] Check spam folder
- [ ] Verify email addresses in Apps Script
- [ ] Check Gmail daily sending quota
- [ ] Review Apps Script execution logs

If data doesn't appear in sheets:
- [ ] Check SHEET_ID in Apps Script
- [ ] Verify Apps Script has "Anyone" access
- [ ] Check execution logs for errors
- [ ] Try manual test of Apps Script

## Important Notes

✅ **Offline Data**: Farm workers can work completely offline. Data syncs when they get to the signal spot.

✅ **Multiple Days**: If they work 3 days offline, all 3 days will sync when network is available.

✅ **Data Safety**: Data is stored locally on phones AND in Google Sheets. Very safe.

✅ **Admin Approval**: New livestock and sold/died need admin approval via Google Sheets or admin interface.

⚠️ **Backup**: Download Google Sheets monthly as Excel backup.

⚠️ **Browser**: Must use Chrome (Android) or Safari (iPhone) for best results.

---

**Deployment Time**: ~2 hours total  
**Ongoing Maintenance**: ~15 minutes per month  
**Support**: leratom2012@gmail.com / mogajaneo@yahoo.com
