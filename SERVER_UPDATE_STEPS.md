# Server Pe Code Update Karne Ke Steps

## Method 1: SSH se Pull karo (Recommended)

### 1. SSH se server connect karo
```bash
ssh username@103.108.220.227
# Ya Hostinger SSH terminal use karo (cPanel -> Terminal)
```

### 2. API folder me jao
```bash
cd ~/public_html/api
```

### 3. Git pull karo
```bash
git pull origin main
```

### 4. Python dependencies update karo (agar naye packages hain)
```bash
source ~/virtualenv/public_html/api/3.9/bin/activate
pip install -r requirements.txt
```

### 5. Database migrations run karo (agar naye tables/columns hain)
```bash
python add_shift_ipqc_columns.py
python add_coc_tracking_table.py
```

### 6. Application restart karo
```bash
touch tmp/restart.txt
# Ya
mkdir -p tmp && touch tmp/restart.txt
```

### 7. Uploads folder fix karo (ek baar)
```bash
bash ../fix_uploads_access.sh
# Ya manually:
mkdir -p uploads/bom_materials
chmod 755 uploads uploads/bom_materials
chmod 644 .htaccess uploads/.htaccess
```

---

## Method 2: Frontend Update (agar frontend changes hain)

### 1. Frontend folder me jao
```bash
cd ~/public_html
```

### 2. Pull karo (agar yahan bhi git repo hai)
```bash
git pull origin main
```

### 3. Ya manually upload karo
- Local pe: `npm run build`
- Upload `frontend/build/*` files to `~/public_html/`

---

## Quick Commands (Copy-Paste for Server Terminal)

```bash
# Backend update
cd ~/public_html/api
git pull origin main
source ~/virtualenv/public_html/api/3.9/bin/activate
pip install -r requirements.txt
mkdir -p tmp && touch tmp/restart.txt

# Uploads fix (ek baar)
mkdir -p uploads/bom_materials uploads/ipqc_pdfs uploads/ftr_documents uploads/ftr_reports uploads/iv_graphs
chmod 755 uploads uploads/bom_materials uploads/ipqc_pdfs uploads/ftr_documents uploads/ftr_reports uploads/iv_graphs
chmod 644 .htaccess uploads/.htaccess

echo "✓ Server updated successfully!"
```

---

## Troubleshooting

### Git pull nahi ho raha?
```bash
# Check git status
git status

# Agar changes hain toh stash karo
git stash
git pull origin main

# Ya force pull
git fetch origin
git reset --hard origin/main
```

### Permission errors?
```bash
chmod 755 uploads
chmod 644 .htaccess
```

### Application restart nahi ho raha?
```bash
# Force restart
touch tmp/restart.txt
# Wait 2-3 seconds, then check
curl http://103.108.220.227/api/health
```

### Database migration errors?
```bash
# Check Python environment
which python
python --version

# Activate venv first
source ~/virtualenv/public_html/api/3.9/bin/activate
python add_shift_ipqc_columns.py
```

---

## Important Notes

1. **Backup pehle lo:** Database export kar lo update se pehle
2. **Test karo:** Update ke baad test URL kholo browser me
3. **Logs check karo:** `tail -f ~/logs/error_log` errors dekhne ke liye
4. **.env file:** Update mat karo git se, manually check karo
5. **uploads/ folder:** Git me nahi hai, manually create karna padega

---

## Test URLs After Update

- API Health: http://103.108.220.227/api/health
- COC Management: http://103.108.220.227/coc-management
- BOM Image: http://103.108.220.227/api/uploads/bom_materials/test.jpg
- Frontend: http://103.108.220.227/

---

## Agar koi issue aaye toh:

1. Error logs dekho: `tail -100 ~/logs/error_log`
2. Application restart: `touch tmp/restart.txt`
3. Python version check: `python --version` (should be 3.9+)
4. Database connectivity: `mysql -u username -p database_name`
5. File permissions: `ls -la` and fix with `chmod`
