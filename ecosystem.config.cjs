module.exports = {
  apps: [
    {
      name: 'void-server',
      script: 'npx',
      args: 'tsx server/src/index.ts',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
    {
      name: 'void-client',
      script: 'npx',
      args: 'vite --host 0.0.0.0 --port 3000',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
