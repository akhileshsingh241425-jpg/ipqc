# PDI IPQC System - Testing Guide

## 🧪 Complete Test Script

Test script tests all major functionality of the PDI IPQC system including:
- ✅ Server health check
- ✅ COC management (sync, list, stock, update)
- ✅ Production/Companies management
- ✅ FTR routes
- ✅ IPQC data routes
- ✅ Peel test routes
- ✅ Master data (BOM, cell specs)
- ✅ Production workflow

---

## 🚀 How to Run Tests

### Prerequisites
1. **Backend server must be running** on port 5003
2. Python 3.x installed
3. Required Python package: `requests`

### Step 1: Start Backend Server
```bash
cd C:\Users\hp\Desktop\PDI\pdi_complete\backend
python run.py
```

### Step 2: Install Requirements (if needed)
```bash
pip install requests
```

### Step 3: Run Test Script
Open a **new terminal** and run:
```bash
cd C:\Users\hp\Desktop\PDI\pdi_complete\backend
python test_complete_system.py
```

---

## 📊 Test Output

The script will show:
- ✅ **Green checkmarks** for passed tests
- ❌ **Red X marks** for failed tests
- ⚠️ **Yellow warnings** for non-critical issues
- ℹ️ **Blue info** messages for details

### Sample Output:
```
======================================================================
  STEP 1: Server Health Check
======================================================================

Testing: Get server health
  GET /
  Status: 200 ✓
✓ Server is accessible (Status: 200)

======================================================================
  STEP 2: Testing COC Management
======================================================================

Testing: Get COC companies list
  GET /coc/companies
  Status: 200 ✓
✓ Success: OK
  Preview: {"success": true, "data": [...]}...
ℹ Found 15 companies in COC
```

### Final Summary:
```
======================================================================
  TEST SUMMARY
======================================================================

Total Tests: 15
Passed: 13
Failed: 1
Warnings: 1

Success Rate: 86.7%

======================================================================
✓ SYSTEM IS WORKING WELL!
  All major features are functional
======================================================================
```

---

## 🎯 What Gets Tested

### Backend API Tests:

1. **Server Health**
   - Checks if backend is running
   - Tests basic connectivity

2. **COC Management**
   - Companies list
   - COC documents list
   - Stock data
   - COC sync from Zoho
   - Update used quantity

3. **Production Management**
   - Get all companies
   - Production days
   - Production records

4. **FTR Routes**
   - Upload endpoints
   - Document management

5. **IPQC Routes**
   - Data retrieval
   - Test records

6. **Peel Test Routes**
   - Test data access

7. **Master Data**
   - BOM data
   - Cell specifications

---

## 🖥️ Frontend Testing

Frontend features **must be tested manually** in browser:

### 1. User Authentication
- Login as super admin: `admin@gautam` / `Gautam@123`
- Login as normal user: `user@gautam` / `Gautam@123`
- Check role badge in sidebar (👑 Super Admin / 👤 User)

### 2. User Management (Super Admin Only)
- Access User Management page
- Add new user
- Edit user details
- Delete users
- Normal users should see "Access Denied"

### 3. COC Dashboard
- View all COC documents
- Edit "Used" quantity (✏️ icon)
- Save/Cancel changes
- Verify available quantity updates

### 4. Daily Report
- Select company
- View production days
- Open PDI Details modal
- Edit "Used Qty" in BOM materials
- Check Gap recalculation

### 5. COC Selection Modal
- Create new production day
- Click "Select COC for Materials"
- Check purple gradient header
- Check card-based layout
- Test hover effects
- Select COC documents
- Verify green highlight for selected items

### 6. Role-Based Access
- Super admin: See all delete/clear buttons
- Normal user: No delete/clear buttons
- Test in: BulkFTRGenerator, PDIFTRGenerator, GraphManager, DailyReport

### 7. FTR Generation
- Upload FTR documents
- Generate PDF reports
- Download reports

### 8. IPQC Data Entry
- Enter test data
- Generate reports
- View history

---

## 🔧 Troubleshooting

### Backend Not Accessible
```
✗ Server not accessible: Connection refused
⚠ Make sure backend server is running on port 5003
```
**Solution:** Start backend server first
```bash
cd backend
python run.py
```

### Module Not Found Error
```
ModuleNotFoundError: No module named 'requests'
```
**Solution:** Install requests module
```bash
pip install requests
```

### COC Tests Failing
```
✗ COC Sync failed: Connection timeout
```
**Solution:** Check Zoho API credentials in config.py

### Test Shows 0 COC Documents
```
⚠ No COC records to test update
```
**Solution:** Run COC sync first from frontend or use sync API

---

## 📝 Test Results Interpretation

### Success Rate >= 80%
✅ System is working well
- All major features functional
- Minor issues (if any) don't affect core functionality

### Success Rate 50-80%
⚠️ System has some issues
- Review failed tests
- Fix non-critical problems
- System still usable

### Success Rate < 50%
❌ System has major issues
- Critical failures detected
- Check backend server
- Review database connections
- Check API configurations

---

## 🎨 Color Codes in Output

- 🟢 **GREEN** = Success
- 🔴 **RED** = Failed
- 🟡 **YELLOW** = Warning
- 🔵 **BLUE** = Information
- 🔷 **CYAN** = Section headers

---

## 💡 Tips

1. **Run tests regularly** after making changes
2. **Check backend logs** if tests fail
3. **Test frontend manually** for UI features
4. **Keep test results** for comparison
5. **Fix failing tests** before deployment

---

## 📞 Support

If tests consistently fail:
1. Check backend server is running
2. Verify database is accessible
3. Review backend logs for errors
4. Check API configurations in config.py
5. Ensure all dependencies are installed

---

**Last Updated:** December 19, 2025
