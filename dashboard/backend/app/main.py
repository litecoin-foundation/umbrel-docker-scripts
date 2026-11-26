import asyncio
import contextlib
import time
from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .auth import create_token, is_authenticated, verify_password, verify_token
from .config import settings
from .routers import explorer, mempool, network, node, tools
from .rpc import rpc_client
from .zmq_listener import run_zmq_listener, ws_hub

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


class LoginRequest(BaseModel):
    password: str


async def _telemetry_loop(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            if ws_hub.client_count > 0:
                data = await node.build_live_overview()
                await ws_hub.broadcast({"type": "telemetry", "ts": int(time.time()), "data": data})
        except asyncio.CancelledError:
            break
        except Exception:
            pass
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=3.0)
        except asyncio.TimeoutError:
            pass


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    stop_event = asyncio.Event()
    zmq_task = asyncio.create_task(run_zmq_listener(stop_event))
    telemetry_task = asyncio.create_task(_telemetry_loop(stop_event))
    try:
        yield
    finally:
        stop_event.set()
        zmq_task.cancel()
        telemetry_task.cancel()
        await asyncio.gather(zmq_task, telemetry_task, return_exceptions=True)
        await rpc_client.close()


app = FastAPI(
    title="Litecoin Node — Material 3 Glass Suite",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def full_lock_middleware(request: Request, call_next):
    path = request.url.path
    if settings.lock_entire_dashboard and path.startswith("/api/"):
        allowed = path == "/api/health" or path.startswith("/api/auth/")
        if not allowed and not is_authenticated(request):
            return JSONResponse(
                status_code=401,
                content={"detail": "Dashboard is locked. Please sign in."},
            )
    return await call_next(request)


@app.get("/api/auth/status")
async def auth_status(request: Request) -> dict:
    return {
        "authenticated": is_authenticated(request),
        "lock_entire_dashboard": settings.lock_entire_dashboard,
        "admin_configured": bool(settings.admin_password),
    }


@app.post("/api/auth/login")
async def auth_login(req: LoginRequest) -> dict:
    if not verify_password(req.password):
        return JSONResponse(status_code=401, content={"detail": "Invalid admin password"})  # type: ignore[return-value]
    return create_token()


app.include_router(node.router)
app.include_router(mempool.router)
app.include_router(explorer.router)
app.include_router(network.router)
app.include_router(tools.router)


@app.websocket("/ws/live")
async def websocket_live(ws: WebSocket) -> None:
    if settings.lock_entire_dashboard:
        token = ws.query_params.get("token")
        if not verify_token(token):
            await ws.close(code=4401)
            return
    await ws_hub.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await ws_hub.disconnect(ws)
    except Exception:
        await ws_hub.disconnect(ws)


if STATIC_DIR.exists():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(str(candidate))
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return JSONResponse(status_code=404, content={"detail": "Frontend bundle not found"})
