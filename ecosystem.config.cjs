// Écosystème pm2 : MuniTax (taxes municipales) + tunnel Internet
// Application admin/agent/client sur le port 3100 (le 3000 est utilisé par paynova)
module.exports = {
  apps: [
    {
      name: "munitax-app",
      cwd: "/home/ange-eudes/taxes-municipales",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3100",
      env: { NODE_ENV: "production", PORT: "3100" },
      autorestart: true,
      max_memory_restart: "400M",
    },
    {
      name: "munitax-tunnel",
      script: "/home/ange-eudes/.local/bin/cloudflared",
      args: "tunnel --url http://localhost:3100 --logfile /tmp/opencode/munitax-tunnel.log --loglevel info",
      autorestart: true,
    },
    {
      name: "paynova-tunnel",
      script: "/home/ange-eudes/.local/bin/cloudflared",
      args: "tunnel --url http://localhost:3000 --logfile /tmp/opencode/paynova-tunnel.log --loglevel info",
      autorestart: true,
    },
  ],
};
