module.exports = {
  apps: [
    {
      name: 'void-game',
      script: 'npx',
      args: 'tsx server/src/index.ts',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
