# Signal Server — AWS Lightsail Deployment

The signal server is a lightweight Node.js WebSocket relay (~10 MB RAM idle).
Recommended host: **AWS Lightsail $3.50/month** (512 MB RAM, 1 vCPU, 20 GB SSD).

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

### Open firewall ports

Lightsail → instance → **Networking** tab → **IPv4 firewall** → Add rules:

| Protocol | Port | Purpose            |
| -------- | ---- | ------------------ |
| TCP      | 80   | Caddy (HTTP→HTTPS) |
| TCP      | 443  | Caddy (HTTPS/WSS)  |

Port 22 (SSH) is open by default. Port 3000 does **not** need to be public — Caddy proxies it.

---

## 2. Point a domain at the instance

Add a DNS **A record** pointing your subdomain to the static IP:

```
signal.yourdomain.com  A  <static-ip>
```

Wait for DNS to propagate before running the setup script.

---

## 3. Run the setup script

Open the instance SSH console in Lightsail (browser-based), then:

```bash
git clone https://github.com/nekonihq/nekoni
bash nekoni/apps/signal/scripts/setup-lightsail.sh
```

The script will:
- Create a 1 GB swap file (prevents OOM on 512 MB RAM)
- Install Node.js 22 via `fnm`
- Install `pm2`
- Build the signal server
- Start it under PM2 and register it to auto-start on reboot

---

## 4. Configure TLS with Caddy

In the same SSH console:

```bash
sudo apt-get install -y caddy
sudo tee /etc/caddy/Caddyfile <<EOF
signal.yourdomain.com {
    reverse_proxy localhost:3000
}
EOF
sudo systemctl enable caddy
sudo systemctl restart caddy
```

Caddy automatically obtains and renews a Let's Encrypt certificate.

Verify:

```bash
curl https://signal.yourdomain.com/health
# → {"status":"ok"}
```

---

## 5. Update your `.env`

On your home machine:

```
SIGNAL_URL=wss://signal.yourdomain.com
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

## PM2 quick reference

```bash
pm2 status                    # process list
pm2 logs nekoni-signal        # live logs
pm2 restart nekoni-signal     # restart
pm2 stop nekoni-signal        # stop
```
