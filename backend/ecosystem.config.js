// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'random-chat-api',
      script: './dist/server.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster',
      
      // Environment variables
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },

      // Performance settings
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto restart on file changes (development only)
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'dist'],
      
      // Advanced settings
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      shutdown_with_message: true,
      
      // Exponential backoff restart delay
      exp_backoff_restart_delay: 100,
      
      // Auto restart on memory threshold
      autorestart: true,
      
      // Interpreter
      interpreter: 'node',
      
      // Node.js arguments
      node_args: [
        '--max-old-space-size=2048',
        '--max-http-header-size=16384'
      ],
      
      // Source map support
      source_map_support: true,
    }
  ],

  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-production-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:username/random-chat-backend.git',
      path: '/var/www/random-chat',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': '',
      'post-setup': 'npm install && npm run build',
    },
    staging: {
      user: 'deploy',
      host: 'your-staging-server.com',
      ref: 'origin/develop',
      repo: 'git@github.com:username/random-chat-backend.git',
      path: '/var/www/random-chat-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env development',
    }
  }
};