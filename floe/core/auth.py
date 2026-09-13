"""
Gates the package behind a Floe-issued API key.

Every replay command needs a valid key before doing anything — set
FLOE_API_KEY to one from Floe's dashboard (Settings > API Keys). Uses only
the standard library (urllib) rather than requests/httpx, since this needs
to run before anything else in the package does, including argument
parsing for commands that don't otherwise need any HTTP client.
"""
import json
import os
import urllib.error
import urllib.request

# Floe is hosted at joinfloe.com — this is what every install verifies its
# key against out of the box. Override with FLOE_API_URL for local
# development against `npm run dev` in floe-app (http://localhost:3000).
DEFAULT_FLOE_URL = "https://joinfloe.com"


class InvalidApiKey(Exception):
    """Raised when FLOE_API_KEY is missing or Floe rejects it."""


def verify_api_key(api_key: str = None, floe_url: str = None) -> None:
    """
    Verifies the configured API key against Floe. Raises InvalidApiKey on
    any failure (missing key, rejected key, or Floe unreachable) — callers
    let this propagate into a clean CLI error rather than catching it.
    """
    api_key = api_key or os.environ.get("FLOE_API_KEY")
    floe_url = floe_url or os.environ.get("FLOE_API_URL", DEFAULT_FLOE_URL)

    if not api_key:
        raise InvalidApiKey(
            "No API key configured. Set FLOE_API_KEY to a key from your "
            "Floe dashboard (Settings → API Keys)."
        )

    request = urllib.request.Request(
        f"{floe_url.rstrip('/')}/api/verify-key",
        method="POST",
        headers={"Authorization": f"Bearer {api_key}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            body = json.loads(response.read())
    except urllib.error.HTTPError as exc:
        try:
            body = json.loads(exc.read())
        except (json.JSONDecodeError, ValueError):
            body = {}
        raise InvalidApiKey(body.get("error", "That API key was rejected.")) from exc
    except urllib.error.URLError as exc:
        raise InvalidApiKey(f"Couldn't reach Floe to verify the API key: {exc.reason}") from exc

    if not body.get("valid"):
        raise InvalidApiKey(body.get("error", "That API key was rejected."))
