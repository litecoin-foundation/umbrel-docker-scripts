import base64
import hashlib
import hmac
import json
import time
from typing import Optional

from fastapi import HTTPException, Request, status

from .config import runtime_state, settings

TOKEN_TTL_SECONDS = 86400  # 24 hours


def _sign(payload_b64: str) -> str:
    sig = hmac.new(runtime_state.session_secret, payload_b64.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).decode("ascii").rstrip("=")


def create_token() -> dict:
    exp = int(time.time()) + TOKEN_TTL_SECONDS
    payload = json.dumps({"sub": "admin", "exp": exp}, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")
    signature = _sign(payload_b64)
    return {
        "token": f"{payload_b64}.{signature}",
        "expires_at": exp,
    }


def verify_token(token: Optional[str]) -> bool:
    if not token or "." not in token:
        return False
    try:
        payload_b64, sig = token.split(".", 1)
        expected_sig = _sign(payload_b64)
        if not hmac.compare_digest(sig, expected_sig):
            return False
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
        return int(payload.get("exp", 0)) > int(time.time())
    except Exception:
        return False


def verify_password(password: str) -> bool:
    if not settings.admin_password:
        return False
    return hmac.compare_digest(password.encode("utf-8"), settings.admin_password.encode("utf-8"))


def extract_bearer_token(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return None


def is_authenticated(request: Request) -> bool:
    return verify_token(extract_bearer_token(request))


async def require_admin(request: Request) -> None:
    if not is_authenticated(request):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
