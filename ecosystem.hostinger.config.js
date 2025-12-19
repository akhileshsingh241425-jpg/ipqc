// PM2 Configuration for Hostinger VPS
module.exports = {
  apps: [
    {
      name: 'pdi-backend',
      script: 'python3',
      args: 'production_server.py',
      cwd: '/home/username/public_html/api',
      interpreter: 'none',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        FLASK_ENV: 'production',
        PORT: 5003
      },
      error_file: '/home/username/logs/pdi-backend-error.log',
      out_file: '/home/username/logs/pdi-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};
