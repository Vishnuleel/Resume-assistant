"""Tiny in-memory, per-IP rate limiter for the public deployment.

One process on a free host doesn't need Redis: a sliding window of timestamps per
(client, bucket) is enough to stop someone hammering the server.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, limits: dict[str, int], window: float = 60.0) -> None:
        self.limits = limits  # bucket -> max requests per window
        self.window = window
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, client: str, bucket: str, now: float | None = None) -> float | None:
        """Record a request. Returns None if allowed, else seconds until the next free slot."""
        now = time.monotonic() if now is None else now
        limit = self.limits[bucket]
        with self._lock:
            hits = self._hits[(client, bucket)]
            while hits and now - hits[0] >= self.window:
                hits.popleft()
            if len(hits) >= limit:
                return self.window - (now - hits[0])
            hits.append(now)
            if len(self._hits) > 10_000:  # forget idle clients so memory stays bounded
                for key in [k for k, v in self._hits.items() if not v]:
                    del self._hits[key]
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
