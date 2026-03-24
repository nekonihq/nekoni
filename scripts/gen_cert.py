"""Generate a self-signed TLS cert/key for local HTTPS."""
import ipaddress
import socket
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/certs")
out_dir.mkdir(parents=True, exist_ok=True)
cert_path = out_dir / "cert.pem"
key_path = out_dir / "key.pem"

if cert_path.exists() and key_path.exists():
    print(f"[gen_cert] cert already exists at {cert_path}")
    sys.exit(0)

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

# Collect SANs: localhost + current LAN IP
san_names: list[x509.GeneralName] = [
    x509.DNSName("localhost"),
    x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
]
try:
    lan_ip = socket.gethostbyname(socket.gethostname())
    if lan_ip and not lan_ip.startswith("127."):
        san_names.append(x509.IPAddress(ipaddress.IPv4Address(lan_ip)))
        print(f"[gen_cert] including LAN IP {lan_ip} in SAN")
except Exception:
    pass

now = datetime.now(timezone.utc)
cert = (
    x509.CertificateBuilder()
    .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "nekoni-local")]))
    .issuer_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "nekoni-local")]))
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(now)
    .not_valid_after(now + timedelta(days=825))
    .add_extension(x509.SubjectAlternativeName(san_names), critical=False)
    .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
    .sign(key, hashes.SHA256())
)

key_path.write_bytes(key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.TraditionalOpenSSL,
    serialization.NoEncryption(),
))
cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))

print(f"[gen_cert] generated {cert_path} + {key_path}")
print(f"[gen_cert] valid for: localhost, 127.0.0.1" + (f", {lan_ip}" if lan_ip else ""))
