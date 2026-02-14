# 🚀 PDI IPQC System - Hostinger Deployment Guide

## 📋 Overview
**Database:** MySQL (provided by Hostinger)  
**Backend:** Python Flask (runs on same domain)  
**Frontend:** React (static build files)  
**Domain Structure:** 
- Frontend: `https://yourdomain.com`
- Backend API: `https://yourdomain.com/api`

**✅ No Port Conflicts - Everything on HTTPS port 443**

---

## 🗄️ Database Information

**Current Database:** MySQL
- Database Name: `pdi_database`
- Tables: ~20 tables
- Key Tables:
  - `coc_documents` - COC material tracking
  - `companies` - Production companies
  - `production_records` - Daily production
  - `users` - User authentication
  - And more...

**Hostinger Database Setup:**
1. Hostinger provides MySQL database free with hosting
2. Get credentials from Hostinger Control Panel
3. Import database structure (we'll create import file)

---

## 📁 Folder Structure on Hostinger

```
public_html/
├── api/                          # Backend (Python Flask)
│   ├── app/
│   ├── passenger_wsgi.py        # Main entry point
│   ├── .htaccess                # Backend routing
│   └── requirements.txt
├── index.html                   # Frontend (React build)
├── static/                      # React static files
├── assets/                      # React assets
└── .htaccess                    # Frontend routing
```

---

## 🔧 Step-by-Step Deployment

### STEP 1: Prepare Backend for Production

#### 1.1 Get Hostinger Database Credentials
Login to Hostinger → MySQL Databases → Note:
- Host: `localhost` (usually)
- Database Name: `u123456789_pdi` (example)
- Username: `u123456789_admin`
- Password: (from Hostinger)

#### 1.2 Create Production Config
Already configured in `config.py` - just set environment variables

#### 1.3 Upload Backend Files
Upload these folders to `public_html/api/`:
```
backend/
├── app/
├── passenger_wsgi.py
├── .htaccess
├── config.py
└── requirements.txt
```

**DON'T upload:**
- `venv/` folder
- `__pycache__/` folders
- `*.pyc` files
- Test files
- `.env` file (set variables in Hostinger)

---

### STEP 2: Configure Backend on Hostinger

#### 2.1 Setup Python App in Hostinger
1. Go to Hostinger Control Panel
2. Find "Select PHP Version" or "Python App"
3. Set Python version: 3.9 or higher
4. Set Application Root: `/public_html/api`
5. Set Application URL: `https://yourdomain.com/api`
6. Set Application Startup File: `passenger_wsgi.py`

#### 2.2 Install Python Packages
SSH into Hostinger:
```bash
cd ~/public_html/api
source ~/virtualenv/bin/activate
pip install -r requirements.txt
```

#### 2.3 Set Environment Variables
In Hostinger Control Panel → Environment Variables:
```
MYSQL_HOST=localhost
MYSQL_USER=u123456789_admin
MYSQL_PASSWORD=your_password
MYSQL_DB=u123456789_pdi
SECRET_KEY=your-secret-key-change-this
FLASK_ENV=production
DEBUG=False
FRONTEND_URL=https://yourdomain.com
```

---

### STEP 3: Import Database

#### 3.1 Export Current Database
On your local machine:
```bash
cd backend
python export_database.py
```
This creates `database_export.sql`

#### 3.2 Import to Hostinger
1. Go to Hostinger → phpMyAdmin
2. Select your database
3. Click Import
4. Upload `database_export.sql`
5. Click Go

---

### STEP 4: Build Frontend for Production

#### 4.1 Update API URL
Edit `frontend/src/services/apiService.js`:
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL || 
                     (window.location.hostname === 'localhost' 
                      ? 'http://localhost:5003/api' 
                      : '/api');
```

#### 4.2 Create Production Build
```bash
cd frontend
npm run build
```

This creates `build/` folder with optimized files

---

### STEP 5: Upload Frontend to Hostinger

#### 5.1 Upload Build Files
Upload contents of `frontend/build/` to `public_html/`:
```
public_html/
├── index.html
├── static/
├── assets/
└── manifest.json
```

**DON'T upload:**
- `node_modules/` folder
- `src/` folder
- `public/` folder
- `package.json`

#### 5.2 Create Frontend .htaccess
Already provided in `frontend_htaccess.txt`

---

### STEP 6: Test Deployment

#### 6.1 Test Backend
Visit: `https://yourdomain.com/api/coc/list`
Should return JSON data

#### 6.2 Test Frontend
Visit: `https://yourdomain.com`
Should show login page

#### 6.3 Test Login
- Username: `admin@gautam`
- Password: `Gautam@123`

---

## 🔐 Security Checklist

- [ ] Changed SECRET_KEY in production
- [ ] Set DEBUG=False
- [ ] Removed test files
- [ ] Database credentials secure
- [ ] HTTPS enabled (Hostinger provides free SSL)
- [ ] CORS configured for your domain only

---

## 📊 What Files to Upload

### Backend (to `public_html/api/`):
```
✅ app/ folder (entire)
✅ passenger_wsgi.py
✅ .htaccess
✅ config.py
✅ requirements.txt
✅ create_coc_tables.py
✅ init_db.py

❌ venv/
❌ __pycache__/
❌ test_*.py files
❌ .env
❌ node_modules/
❌ *.pyc files
```

### Frontend (to `public_html/`):
```
✅ build/index.html → public_html/index.html
✅ build/static/ → public_html/static/
✅ build/assets/ → public_html/assets/
✅ .htaccess

❌ src/
❌ node_modules/
❌ public/
❌ package.json
❌ All source files
```

---

## 🚨 Troubleshooting

### Backend Not Working?
1. Check passenger_wsgi.py is correct
2. Verify Python version in Hostinger
3. Check error logs: `~/public_html/api/tmp/restart.txt`
4. Restart app: `touch ~/public_html/api/tmp/restart.txt`

### Frontend Not Showing?
1. Check .htaccess routing
2. Verify index.html is in public_html root
3. Clear browser cache
4. Check console for errors

### Database Connection Error?
1. Verify database credentials
2. Check if database exists
3. Import database structure
4. Check MySQL user permissions

### API Calls Failing?
1. Check CORS configuration
2. Verify API_BASE_URL in frontend
3. Check backend logs
4. Test API directly: `/api/coc/list`

---

## 📞 Quick Commands

### Restart Backend (SSH):
```bash
touch ~/public_html/api/tmp/restart.txt
```

### Check Backend Logs:
```bash
tail -f ~/logs/access.log
tail -f ~/logs/error.log
```

### Update Backend Code:
```bash
cd ~/public_html/api
git pull origin main  # if using git
touch tmp/restart.txt
```

### Rebuild Frontend:
```bash
cd frontend
npm run build
# Upload new build files via FTP
```

---

## ✅ Final Checklist

- [ ] Backend uploaded to `/api` folder
- [ ] Frontend build uploaded to root
- [ ] Database imported
- [ ] Environment variables set
- [ ] Python packages installed
- [ ] SSL certificate active (HTTPS)
- [ ] Test login working
- [ ] Test COC data loading
- [ ] Test all major features
- [ ] Remove test/debug files

---

## 🎯 Production URLs

After deployment:
- **Main App:** `https://yourdomain.com`
- **API:** `https://yourdomain.com/api`
- **COC List:** `https://yourdomain.com/api/coc/list`
- **Companies:** `https://yourdomain.com/api/companies`

**No port numbers needed!** Everything runs on standard HTTPS (port 443)

---

## 📝 Database Schema

**Current Tables:**
1. `coc_documents` - 511 documents
2. `companies` - 4 companies
3. `production_records`
4. `production_days`
5. `raw_material_stock`
6. `material_consumption`
7. `users` (for authentication)
8. And 15+ more tables

**Database Size:** ~50MB
**Export File:** `database_export.sql` (will be created)

---

## 🔄 Update Process (After Deployment)

### Update Backend:
1. Make changes locally
2. Test thoroughly
3. Upload changed files via FTP
4. SSH: `touch ~/public_html/api/tmp/restart.txt`

### Update Frontend:
1. Make changes in React
2. `npm run build`
3. Upload new build files
4. Clear browser cache

---

**Support Contact:** Hostinger support for server issues  
**Deployment Time:** ~30 minutes  
**Domain Propagation:** 24-48 hours for DNS
