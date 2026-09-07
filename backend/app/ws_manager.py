"""
WebSocket connection manager.
Keeps a set of active WebSocket connections per organization.
The heartbeat endpoint calls broadcast_device() after every update.
"""
import asyncio
import json
from collections import defaultdict
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # org_id -> set of WebSocket
        self._conns: dict[str, set[WebSocket]] = defaultdict(set)

    def connect(self, org_id: str, ws: WebSocket):
        self._conns[org_id].add(ws)

    def disconnect(self, org_id: str, ws: WebSocket):
        self._conns[org_id].discard(ws)

    async def broadcast(self, org_id: str, payload: dict):
        dead = set()
        for ws in list(self._conns.get(org_id, [])):
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._conns[org_id].discard(ws)


manager = ConnectionManager()
