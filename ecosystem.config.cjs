module.exports = {
  apps: [{
    name: 'whospy',
    script: 'server/dist/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 20001
    },
    // 异常自动重启，最多连续重启10次，间隔5秒
    max_restarts: 10,
    restart_delay: 5000
  }]
};
