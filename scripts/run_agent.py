"""Start the agent with an optional SSL termination proxy.

HTTP  :8000  — primary uvicorn server (single app instance, full lifespan)
HTTPS :8443  — asyncio SSL proxy that forwards to :8000 (no second app init)
"""
import asyncio
import os
import ssl
from pathlib import Path

import uvicorn


async def _pipe(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    try:
        while chunk := await reader.read(65536):
            writer.write(chunk)
            await writer.drain()
    except (ConnectionResetError, BrokenPipeError):
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def _proxy_handler(
    ssl_reader: asyncio.StreamReader,
    ssl_writer: asyncio.StreamWriter,
    port_http: int,
) -> None:
    try:
        http_reader, http_writer = await asyncio.open_connection("127.0.0.1", port_http)
    except OSError:
        ssl_writer.close()
        return
    await asyncio.gather(
        _pipe(ssl_reader, http_writer),
        _pipe(http_reader, ssl_writer),
    )


async def main() -> None:
    port_http = int(os.getenv("AGENT_PORT", "8000"))
    port_https = int(os.getenv("AGENT_PORT_HTTPS", "8443"))
    certs_dir = Path(os.getenv("AGENT_CERTS_DIR", "data/certs"))

    key = certs_dir / "key.pem"
    cert = certs_dir / "cert.pem"

    tasks: list[asyncio.Task] = []

    if key.exists() and cert.exists():
        ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_ctx.load_cert_chain(str(cert), str(key))

        proxy = await asyncio.start_server(
            lambda r, w: _proxy_handler(r, w, port_http),
            "0.0.0.0",
            port_https,
            ssl=ssl_ctx,
        )
        tasks.append(asyncio.create_task(proxy.serve_forever()))
        print(f"[agent] HTTP :{port_http}  HTTPS :{port_https} (SSL proxy → HTTP)")
    else:
        print(f"[agent] HTTP :{port_http}  (no certs, HTTPS disabled)")

    config = uvicorn.Config("nekoni_agent.main:app", host="0.0.0.0", port=port_http)
    server = uvicorn.Server(config)
    tasks.append(asyncio.create_task(server.serve()))

    await asyncio.gather(*tasks)


asyncio.run(main())
