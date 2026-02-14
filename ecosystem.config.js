module.exports = {
  apps: [
    {
      name: 'pdi-backend',
      script: 'python',
      args: 'backend/production_server.py',
      cwd: './',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5003
        // AZURE_CV_KEY, AZURE_CV_ENDPOINT, GROQ_API_KEY - Set on server via .env file
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'pdi-frontend',
      script: 'npx',
      args: 'serve -s build -l 3000',
      cwd: './frontend',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
