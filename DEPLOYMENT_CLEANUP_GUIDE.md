# 🗑️ Files to DELETE before Hostinger deployment

## ❌ Backend - DON'T Upload These:

### Development & Testing Files:
- `venv/` (entire folder)
- `__pycache__/` (all folders)
- `*.pyc` files
- `.pytest_cache/`
- `test_*.py` (all test files)
- `.env` file
- `.git/` folder
- `.gitignore`

### Test & Debug Scripts:
- `test_all_workflows.py`
- `test_complete_system.py`
- `test_api.py`
- `test_companies.py`
- `test_coc_pdi_tracking.py`
- `fix_all_routes.py`
- `fix_database.py`
- `fix_document_paths.py`
- `fix_schema.py`
- `fix_bom_image_paths.py`

### Migration Scripts (after first setup):
- `add_coc_columns_to_bom.py`
- `add_coc_tracking.py`
- `add_delivered_fields.py`
- `add_lot_number_column.py`
- `add_production_fields_migration.py`
- `add_running_order_field.py`
- `add_serial_fields.py`
- `update_bom_schema.py`
- `update_lot_number_column.py`
- `update_schema.py`
- `migrate_pdi_system.py`
- `delete_test_coc.py`

### Database Scripts (after initial import):
- `init_all_tables.py` (use only once)
- `setup_coc_database.sh`

### Documentation (optional, keep if needed):
- `README.md`
- `HOSTINGER_DEPLOYMENT.md`
- `RUN_TESTS.md`
- `.env.example`

---

## ❌ Frontend - DON'T Upload These:

### Source Files (after build):
- `src/` (entire folder - only needed for development)
- `public/` (except files copied to build)
- `node_modules/` (entire folder - NEVER upload)

### Development Files:
- `package.json`
- `package-lock.json`
- `.git/`
- `.gitignore`
- `README.md`

### Config Files:
- `.env`
- `.env.local`
- `.env.development`
- `.env.production`

---

## ✅ What TO Upload:

### Backend (to `public_html/api/`):
```
✅ app/ (entire folder with all routes, models, services)
✅ passenger_wsgi.py
✅ .htaccess
✅ config.py
✅ requirements.txt
✅ create_coc_tables.py (for initial setup)
✅ init_db.py (for initial setup)
✅ export_database.py (useful for backups)
✅ production_server.py (optional backup)
```

### Frontend (to `public_html/`):
**Only upload contents of `build/` folder:**
```
✅ index.html
✅ static/ folder
✅ assets/ folder (if exists)
✅ manifest.json
✅ robots.txt
✅ favicon.ico
✅ .htaccess (from frontend_htaccess.txt)
```

---

## 📦 Create Production Package

### Backend Cleanup Commands:

**Windows PowerShell:**
```powershell
cd backend

# Remove Python cache
Get-ChildItem -Recurse -Directory __pycache__ | Remove-Item -Recurse -Force
Get-ChildItem -Recurse -Filter *.pyc | Remove-Item -Force

# Remove test files
Remove-Item test_*.py -Force -ErrorAction SilentlyContinue

# Remove venv
Remove-Item -Recurse -Force venv -ErrorAction SilentlyContinue

# Remove .env
Remove-Item .env -Force -ErrorAction SilentlyContinue
```

**Linux/Mac:**
```bash
cd backend

# Remove Python cache
find . -type d -name __pycache__ -exec rm -rf {} +
find . -type f -name "*.pyc" -delete

# Remove test files
rm -f test_*.py

# Remove venv
rm -rf venv

# Remove .env
rm -f .env
```

---

### Frontend Build Commands:

```bash
cd frontend

# Install dependencies (if not done)
npm install

# Create production build
npm run build

# This creates 'build/' folder with optimized files
```

---

## 📋 Upload Checklist

### Before Upload:
- [ ] Backend: Delete all test files
- [ ] Backend: Delete venv folder
- [ ] Backend: Delete __pycache__ folders
- [ ] Backend: Delete .env file
- [ ] Frontend: Run `npm run build`
- [ ] Database: Export using export_database.py

### After Upload:
- [ ] Set environment variables in Hostinger
- [ ] Install Python packages on Hostinger
- [ ] Import database to Hostinger MySQL
- [ ] Test backend: `yourdomain.com/api/coc/list`
- [ ] Test frontend: `yourdomain.com`
- [ ] Test login
- [ ] Verify no 404 errors

---

## 🚀 Quick Deployment Steps

1. **Cleanup Backend:**
   ```
   Delete test files, venv, cache, .env
   ```

2. **Build Frontend:**
   ```
   npm run build
   ```

3. **Export Database:**
   ```
   python export_database.py
   ```

4. **Upload Backend:**
   ```
   Upload to: public_html/api/
   ```

5. **Upload Frontend:**
   ```
   Upload build contents to: public_html/
   ```

6. **Setup Database:**
   ```
   Import database_export.sql to Hostinger MySQL
   ```

7. **Configure:**
   ```
   Set environment variables in Hostinger
   Install Python packages via SSH
   ```

8. **Test:**
   ```
   Visit yourdomain.com
   ```

---

## 💡 Pro Tips

1. **Use FTP/SFTP clients:**
   - FileZilla
   - WinSCP
   - Cyberduck

2. **Exclude patterns in FTP:**
   - `**/__pycache__/**`
   - `**/*.pyc`
   - `**/venv/**`
   - `**/node_modules/**`
   - `**/.git/**`

3. **Keep local backups:**
   - Don't delete local files
   - Keep source code for updates

4. **Version control:**
   - Use git for tracking changes
   - Create deployment branch

---

## 📁 Final Folder Sizes

**Backend (after cleanup):**
- ~5-10 MB (without venv, test files)

**Frontend (build folder):**
- ~2-5 MB (optimized static files)

**Database:**
- ~50-100 MB (depends on data)

**Total Upload:** ~10-20 MB

---

## 🎯 Result

After deployment:
- ✅ Frontend: `https://yourdomain.com`
- ✅ Backend API: `https://yourdomain.com/api`
- ✅ No port conflicts
- ✅ Single domain
- ✅ Fast loading
- ✅ Production-ready

---

**Note:** Keep your local project folder intact for future updates!
