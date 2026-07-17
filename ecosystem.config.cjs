// PM2 process definition for King Recruit.
// Usage on the server (from inside this folder, e.g. X:\king-recruit-production02\king-recruit):
//   pm2 start ecosystem.config.cjs
//   pm2 save                 # persist across reboots (after pm2-startup / pm2-installer is set up)
//   pm2 logs king-recruit    # tail output
//   pm2 restart king-recruit
//   pm2 stop king-recruit

module.exports = {
  apps: [
    {
      name: 'king-recruit',
      script: 'server.js',
      // Resolve paths relative to this config file, so it works regardless of
      // the mapped drive letter (X:\...) or the real server path.
      cwd: __dirname,

      // File-based storage in ./data means only ONE process may run.
      // Fork mode, single instance — never use cluster mode here.
      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      watch: false, // production: do NOT watch/reload on file changes
      max_memory_restart: '500M',

      env: {
        NODE_ENV: 'production',
        PORT: 3005,
        HOST: '0.0.0.0',
      },

      // Logs (written under this folder unless you point them elsewhere).
      merge_logs: true,
      time: true, // prefix each log line with a timestamp
      out_file: './logs/king-recruit-out.log',
      error_file: './logs/king-recruit-error.log',
    },
  ],
};
