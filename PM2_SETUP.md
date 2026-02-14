# 🚀 PM2 Setup Guide

## Overview

PM2 process manager se aap backend aur frontend dono ko production-ready environment mein chala sakte ho.

---

## 📦 Installation

### Local (Windows/Linux/Mac):
```bash
npm install -g pm2
```

### Hostinger VPS:
```bash
npm install -g pm2

# Or if permission error:
sudo npm install -g pm2
```

---

## 🏠 Local Development Setup

### 1. Start Both Services:
```bash
# Root folder se
pm2 start ecosystem.config.js

# Or individually:
pm2 start ecosystem.config.js --only pdi-backend
pm2 start ecosystem.config.js --only pdi-frontend
```

### 2. Check Status:
```bash
pm2 status
pm2 logs
pm2 monit
```

### 3. Stop Services:
```bash
pm2 stop all
pm2 delete all
```

---

## 🌐 Hostinger VPS Setup

### Architecture:
```
Nginx (Port 443) → PM2 Backend (Port 5002)
                 → Static Frontend Files
```

### 1. Upload Files:
```bash
# Via SCP or FTP
scp -r backend/* username@server:/home/username/public_html/api/
```

### 2. Install Dependencies:
```bash
ssh username@server
cd ~/public_html/api

# Python packages
pip3 install -r requirements.txt

# PM2
npm install -g pm2
```

### 3. Update ecosystem.hostinger.config.js:
```javascript
// Replace 'username' with your actual username
cwd: '/home/YOUR_USERNAME/public_html/api',
error_file: '/home/YOUR_USERNAME/logs/pdi-backend-error.log',
out_file: '/home/YOUR_USERNAME/logs/pdi-backend-out.log',
```

### 4. Create Logs Directory:
```bash
mkdir -p ~/logs
```

### 5. Start Backend with PM2:
```bash
cd ~/public_html/api

# Copy config file
cp ecosystem.hostinger.config.js ./ecosystem.config.js

# Start
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup auto-start on reboot
pm2 startup
# (Follow the command it gives you)
```

### 6. Configure Nginx:
```bash
sudo nano /etc/nginx/sites-available/default
```

Add this configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates (Hostinger provides these)
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend - Static files
    root /home/username/public_html;
    index index.html;

    # Frontend routing (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API - Proxy to PM2
    location /api {
        proxy_pass http://localhost:5002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files cache
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 7. Test & Reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📊 PM2 Commands

### Process Management:
```bash
# List all processes
pm2 list
pm2 status

# Start/Stop/Restart
pm2 start pdi-backend
pm2 stop pdi-backend
pm2 restart pdi-backend
pm2 delete pdi-backend

# Start all / Stop all
pm2 start all
pm2 stop all
pm2 restart all
```

### Monitoring:
```bash
# Real-time monitoring
pm2 monit

# Logs
pm2 logs                    # All logs
pm2 logs pdi-backend        # Specific app
pm2 logs --lines 100        # Last 100 lines
pm2 flush                   # Clear logs

# Process info
pm2 show pdi-backend
pm2 describe pdi-backend
```

### Advanced:
```bash
# Auto-restart on file changes (development)
pm2 start ecosystem.config.js --watch

# Cluster mode (multiple instances)
pm2 start ecosystem.config.js -i max

# Memory usage
pm2 status
pm2 monit

# CPU & Memory info
pm2 describe pdi-backend
```

### Startup & Save:
```bash
# Save current process list
pm2 save

# Generate startup script
pm2 startup

# Resurrect saved processes
pm2 resurrect

# Remove startup script
pm2 unstartup
```

---

## 🔧 Configuration Options

### Backend (Python Flask):

**ecosystem.config.js:**
```javascript
{
  name: 'pdi-backend',
  script: 'python3',
  args: 'production_server.py',
  cwd: '/path/to/api',
  instances: 2,              // Number of instances
  exec_mode: 'cluster',      // Cluster mode for load balancing
  autorestart: true,         // Auto-restart on crash
  watch: false,              // Don't watch in production
  max_memory_restart: '1G',  // Restart if exceeds 1GB
  env: {
    FLASK_ENV: 'production',
    PORT: 5002
  }
}
```

### Frontend (Static Server):

**Only needed for local development:**
```javascript
{
  name: 'pdi-frontend',
  script: 'npx',
  args: 'serve -s build -l 3000',
  cwd: './frontend'
}
```

**On Hostinger:** Frontend served directly by Nginx (no PM2 needed)

---

## 🎯 Production Workflow

### Initial Deployment:
```bash
# 1. Upload files
scp -r backend/* user@server:/home/user/public_html/api/

# 2. SSH to server
ssh user@server

# 3. Install dependencies
cd ~/public_html/api
pip3 install -r requirements.txt

# 4. Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 5. Configure Nginx (one time)
sudo nano /etc/nginx/sites-available/default
sudo systemctl reload nginx
```

### Updates:
```bash
# 1. Upload new code
scp -r backend/* user@server:/home/user/public_html/api/

# 2. Restart PM2
ssh user@server
pm2 restart pdi-backend

# 3. Check logs
pm2 logs pdi-backend --lines 50
```

---

## 🐛 Troubleshooting

### Backend not starting:
```bash
# Check logs
pm2 logs pdi-backend --err

# Check Python
which python3
python3 --version

# Test manually
cd ~/public_html/api
python3 production_server.py
```

### Port already in use:
```bash
# Check what's using port 5002
sudo netstat -tlnp | grep :5002

# Kill process
sudo kill -9 PID
```

### PM2 not found:
```bash
# Install PM2
npm install -g pm2

# Or with sudo
sudo npm install -g pm2

# Add to PATH
export PATH=$PATH:/usr/local/bin
```

### High memory usage:
```bash
# Check memory
pm2 status
pm2 monit

# Restart with lower instances
pm2 delete pdi-backend
pm2 start ecosystem.config.js --only pdi-backend -i 1
```

---

## 📈 Performance Optimization

### 1. Cluster Mode:
```javascript
instances: 'max',  // Use all CPU cores
exec_mode: 'cluster'
```

### 2. Memory Management:
```javascript
max_memory_restart: '1G',  // Auto-restart if exceeds
```

### 3. Log Rotation:
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 4. Monitoring:
```bash
# Install PM2 monitoring (optional)
pm2 link YOUR_SECRET_KEY YOUR_PUBLIC_KEY
```

---

## ✅ Verification Checklist

After PM2 setup:

- [ ] `pm2 status` shows app running
- [ ] `pm2 logs` shows no errors
- [ ] Backend accessible: `curl http://localhost:5002/api/coc/list`
- [ ] Frontend loads: `https://yourdomain.com`
- [ ] API calls work from frontend
- [ ] PM2 saved: `pm2 save`
- [ ] Auto-startup configured: `pm2 startup`
- [ ] Nginx configured and reloaded

---

## 🎉 Benefits of PM2

✅ **Auto-restart** on crash  
✅ **Cluster mode** for load balancing  
✅ **Process monitoring** in real-time  
✅ **Log management** built-in  
✅ **Zero-downtime** reload  
✅ **Startup scripts** for auto-start  
✅ **Memory management** automatic  
✅ **Easy deployment** updates  

---

## 📚 Quick Reference

```bash
# Start
pm2 start ecosystem.config.js

# Status
pm2 status

# Logs
pm2 logs

# Restart
pm2 restart all

# Stop
pm2 stop all

# Save & Startup
pm2 save
pm2 startup

# Monitor
pm2 monit
```

---

**Your app will run 24/7 with PM2! 🚀**
