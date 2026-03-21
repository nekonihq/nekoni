# Signal Server — AWS Lightsail Deployment

The signal server is a lightweight Node.js WebSocket relay (~10 MB RAM idle).
Recommended host: **AWS Lightsail $3.50/month** (512 MB RAM, 1 vCPU, 20 GB SSD).

All signaling messages are Ed25519-signed and the actual chat data travels over
an encrypted WebRTC DataChannel — plain `ws://` over a static IP is sufficient.

---

## 1. Create Lightsail instance

1. Open [AWS Lightsail](https://lightsail.aws.amazon.com) → **Create instance**
2. Pick a region close to your home machine
3. Platform: **Linux/Unix** — Blueprint: **OS Only → Ubuntu 24.04 LTS**
4. Instance plan: **$3.50/month** (512 MB)
5. Name it `nekoni-signal`, click **Create**

### Assign a static IP (permanent — free while attached)

Lightsail → **Networking** tab → **Create static IP** → attach to `nekoni-signal`.
Your IP will not change on reboot.

### Open firewall port

Lightsail → instance → **Networking** tab → **IPv4 firewall** → Add rule:

| Protocol | Port | Purpose       |
| -------- | ---- | ------------- |
| TCP      | 3000 | Signal server |

Port 22 (SSH) is open by default.

---

## 2. Run the setup script

Open the instance SSH console in Lightsail (browser-based, no local SSH needed),
then clone the repo and run the setup script:

```bash
git clone https://github.com/nekonihq/nekoni
bash nekoni/apps/signal/scripts/setup-lightsail.sh
```

The script will:
- Install Node.js 22 via `fnm`
- Install `pnpm` and `pm2`
- Build the signal server in place
- Start it under PM2 and register it to auto-start on reboot
- Print the `SIGNAL_URL` to paste into your `.env`

---

## 3. Update your `.env`

On your home machine set the URL printed by the script:

```
SIGNAL_URL=ws://<static-ip>:3000
```

Then restart the agent:

```bash
docker compose up -d agent
```

---

## Updating

In the Lightsail SSH console:

```bash
cd nekoni
git pull origin main
bash apps/signal/scripts/deploy.sh
```

---

## Health check

```bash
curl http://<static-ip>:3000/health
# → {"status":"ok"}
```

---

## PM2 quick reference

```bash
pm2 status                    # process list
pm2 logs nekoni-signal        # live logs
pm2 restart nekoni-signal     # restart
pm2 stop nekoni-signal        # stop
```

---

## Optional: domain + TLS (`wss://`)

Only needed if you want encrypted WebSocket transport. Install Caddy:

```bash
sudo apt-get install -y caddy
sudo tee /etc/caddy/Caddyfile <<EOF
signal.yourdomain.com {
    reverse_proxy localhost:3000
}
EOF
sudo systemctl restart caddy
```

Open ports 80 + 443 instead of 3000 in the Lightsail firewall, point a DNS A
record at the static IP, then set `SIGNAL_URL=wss://signal.yourdomain.com`.
