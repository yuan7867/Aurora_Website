#!/usr/bin/env python3
"""
Aurora HY Support Auto Reply V1.1

Purpose:
    Poll the CEO Gmail mailbox that receives Cloudflare Email Routing mail for
    support@aurorahy.com, then send one official Aurora HY support acknowledgement
    through Resend per sender per 24 hours.

Required environment variables:
    SUPPORT_IMAP_USER          Gmail address that receives routed support mail.
    SUPPORT_IMAP_PASSWORD      Gmail app password. Do not use the normal login password.
    EMAIL_API_TOKEN            Resend API token.

Optional environment variables:
    SUPPORT_IMAP_HOST          Default: imap.gmail.com
    SUPPORT_IMAP_MAILBOX       Default: INBOX
    SUPPORT_IMAP_SEARCH        Fixed: ALL. IMAP read/unread flags are not business state.
    SUPPORT_IMAP_LIMIT         Default: 50
    SUPPORT_FROM               Default: Aurora HY Support <support@mail.aurorahy.com>
    SUPPORT_REPLY_TO           Default: support@aurorahy.com
    SUPPORT_ROUTE_ADDRESS      Default: support@aurorahy.com
    SUPPORT_STATE_FILE         Default: .support_auto_reply_state.json
    SUPPORT_RESEND_URL         Default: https://api.resend.com/emails
    SUPPORT_LOOP_SECONDS       Default: 60

Examples:
    Dry-run one pass:
        python support_auto_reply.py --dry-run --once

    Run continuously:
        python support_auto_reply.py --loop

Security:
    The script never sends from, replies to, or exposes a private Gmail address.
    The Resend token and Gmail app password are read only from environment variables.
"""

from __future__ import annotations

import argparse
import datetime as dt
import email
import hashlib
import html
import imaplib
import json
import os
import subprocess
import sys
import time
from email.header import decode_header, make_header
from email.message import Message
from email.policy import default
from email.utils import getaddresses, parseaddr
from pathlib import Path
from typing import Any


AUTO_REPLY_SUBJECT = "[Auto Reply] We have received your message"

AUTO_REPLY_TEXT = """Dear Customer,

Thank you for contacting Aurora HY.

This is an automated acknowledgement confirming that we have successfully received your email.

Our team will review your enquiry and respond as soon as possible.

Business Hours
Monday - Friday
9:00 AM - 6:00 PM (Malaysia Time)

If your enquiry relates to an order, please include:

- Order Number
- Product Name
- Screenshot (if applicable)

Website
https://aurorahy.com

Thank you for your patience.

Best regards,

Yuan
Founder & CEO

Aurora HY
support@aurorahy.com
"""

AUTO_REPLY_HTML = """\
<p>Dear Customer,</p>
<p>Thank you for contacting Aurora HY.</p>
<p>This is an automated acknowledgement confirming that we have successfully received your email.</p>
<p>Our team will review your enquiry and respond as soon as possible.</p>
<p><strong>Business Hours</strong><br>
Monday - Friday<br>
9:00 AM - 6:00 PM (Malaysia Time)</p>
<p>If your enquiry relates to an order, please include:</p>
<ul>
  <li>Order Number</li>
  <li>Product Name</li>
  <li>Screenshot (if applicable)</li>
</ul>
<p><strong>Website</strong><br>
<a href="https://aurorahy.com">https://aurorahy.com</a></p>
<p>Thank you for your patience.</p>
<p>Best regards,</p>
<p>Yuan<br>
Founder &amp; CEO</p>
<p>Aurora HY<br>
support@aurorahy.com</p>
"""

SUPPORT_DOMAIN_BLOCKLIST = {"aurorahy.com", "mail.aurorahy.com"}


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def env(name: str, default_value: str = "") -> str:
    return os.environ.get(name, default_value).strip()


def normalize_address(address: str) -> str:
    return parseaddr(address)[1].strip().lower()


def mask_address(address: str) -> str:
    local, _, domain = address.partition("@")
    if not local or not domain:
        return "unknown"
    visible = local[:2] if len(local) > 2 else local[:1]
    return f"{visible}***@{domain}"


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"senders": {}, "message_ids": {}, "uids": {}}

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"senders": {}, "message_ids": {}, "uids": {}}

    if not isinstance(data, dict):
        return {"senders": {}, "message_ids": {}, "uids": {}}

    data.setdefault("senders", {})
    data.setdefault("message_ids", {})
    data.setdefault("uids", {})
    return data


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")


def decode_subject(message: Message) -> str:
    raw = message.get("Subject", "")
    try:
        return str(make_header(decode_header(raw)))
    except Exception:
        return raw


def get_recipient_headers(message: Message) -> list[tuple[str, str]]:
    header_names = [
        "To",
        "Delivered-To",
        "X-Original-To",
        "Envelope-To",
        "X-Forwarded-To",
        "Original-Recipient",
    ]
    values: list[tuple[str, str]] = []
    for name in header_names:
        for value in message.get_all(name, []):
            values.append((name, str(value)))
    return values


def find_support_route(message: Message, support_address: str) -> tuple[str, str] | None:
    expected = support_address.lower()

    for header_name, header_value in get_recipient_headers(message):
        normalized_value = header_value.lower()
        parsed_addresses = [addr.lower() for _, addr in getaddresses([header_value])]

        if expected in parsed_addresses or expected in normalized_value:
            return header_name, support_address

    return None


def get_reply_target(message: Message) -> str:
    reply_to = normalize_address(message.get("Reply-To", ""))
    if reply_to:
        return reply_to
    return normalize_address(message.get("From", ""))


def is_own_or_internal_sender(address: str) -> bool:
    _, _, domain = address.partition("@")
    return domain.lower() in SUPPORT_DOMAIN_BLOCKLIST


def is_auto_generated(message: Message) -> bool:
    auto_submitted = message.get("Auto-Submitted", "").strip().lower()
    if auto_submitted and auto_submitted != "no":
        return True

    precedence = message.get("Precedence", "").strip().lower()
    if precedence in {"bulk", "junk", "list"}:
        return True

    suppress = message.get("X-Auto-Response-Suppress", "").strip().lower()
    if suppress and suppress != "none":
        return True

    subject = decode_subject(message).strip().lower()
    if subject.startswith("[auto reply]") or subject.startswith("automatic reply"):
        return True

    return False


def already_replied_recently(state: dict[str, Any], sender: str, now: dt.datetime) -> bool:
    sent_at_raw = state.get("senders", {}).get(sender)
    if not sent_at_raw:
        return False

    try:
        sent_at = dt.datetime.fromisoformat(sent_at_raw)
    except ValueError:
        return False

    if sent_at.tzinfo is None:
        sent_at = sent_at.replace(tzinfo=dt.timezone.utc)

    return now - sent_at < dt.timedelta(hours=24)


def idempotency_key(sender: str, now: dt.datetime) -> str:
    window = now.strftime("%Y-%m-%d")
    digest = hashlib.sha256(f"{sender}:{window}".encode("utf-8")).hexdigest()[:32]
    return f"support-auto-reply/{digest}"


def build_resend_payload(to_address: str, from_address: str, reply_to: str) -> dict[str, Any]:
    return {
        "from": from_address,
        "to": [to_address],
        "reply_to": reply_to,
        "subject": AUTO_REPLY_SUBJECT,
        "text": AUTO_REPLY_TEXT,
        "html": AUTO_REPLY_HTML,
    }


def sanitize_request_payload(payload: dict[str, Any]) -> dict[str, Any]:
    sanitized = dict(payload)
    sanitized["to"] = [mask_address(address) for address in payload.get("to", [])]
    return sanitized


def send_resend_email(
    *,
    api_url: str,
    api_token: str,
    payload: dict[str, Any],
    idempotency: str,
    timeout_seconds: int = 20,
) -> dict[str, Any]:
    print("Website Email Service")
    print("Dispatcher:")
    print("commerce-api/src/dispatchers/emailDispatcher.js")
    print("From:")
    print(payload.get("from", ""))
    print("Reply-To:")
    print(payload.get("reply_to", ""))
    print("To:")
    print(", ".join(payload.get("to", [])))
    print("Subject:")
    print(payload.get("subject", ""))
    print("Request JSON")
    print(json.dumps(sanitize_request_payload(payload), indent=2, sort_keys=True))

    root = Path(__file__).resolve().parent
    helper = root / "commerce-api" / "src" / "cli" / "sendSupportAutoReply.js"
    helper_input = {
        "idempotencyKey": idempotency,
        "to": payload.get("to", []),
        "subject": payload.get("subject", ""),
        "html": payload.get("html", ""),
        "text": payload.get("text", ""),
    }
    helper_env = os.environ.copy()
    helper_env["EMAIL_API_URL"] = api_url
    helper_env["SUPPORT_AUTO_REPLY_FROM"] = payload.get("from", "")
    helper_env["SUPPORT_AUTO_REPLY_REPLY_TO"] = payload.get("reply_to", "")

    completed = subprocess.run(
        ["node", str(helper)],
        input=json.dumps(helper_input),
        text=True,
        capture_output=True,
        cwd=str(root / "commerce-api"),
        env=helper_env,
        timeout=timeout_seconds,
        check=False,
    )

    if completed.stdout:
        print(completed.stdout.strip())
    if completed.stderr:
        print(completed.stderr.strip(), file=sys.stderr)

    if completed.returncode != 0:
        raise RuntimeError(f"Website email service failed with exit code {completed.returncode}.")

    return json.loads(completed.stdout or "{}")


def mark_message_handled(state: dict[str, Any], message_id: str, uid: str, now: dt.datetime) -> None:
    handled_at = now.isoformat()
    if message_id:
        state.setdefault("message_ids", {})[message_id] = handled_at
    if uid:
        state.setdefault("uids", {})[uid] = handled_at


def process_message(
    *,
    mailbox: imaplib.IMAP4_SSL,
    uid: bytes,
    raw_message: bytes,
    state: dict[str, Any],
    state_file: Path,
    dry_run: bool,
    config: dict[str, str],
) -> str:
    message = email.message_from_bytes(raw_message, policy=default)
    now = utc_now()
    support_address = config["support_route_address"]
    sender = get_reply_target(message)
    message_id = message.get("Message-ID", "").strip()
    uid_text = uid.decode("utf-8", errors="replace")

    if not sender:
        mark_message_handled(state, message_id, uid_text, now)
        save_state(state_file, state)
        return "skipped:no_sender"

    if message_id and message_id in state.get("message_ids", {}):
        return "skipped:message_already_handled"

    if uid_text and uid_text in state.get("uids", {}):
        return "skipped:uid_already_handled"

    route_match = find_support_route(message, support_address)
    if not route_match:
        mark_message_handled(state, message_id, uid_text, now)
        save_state(state_file, state)
        return "skipped:not_support_route"

    matched_header, matched_address = route_match
    print("Support Detection")
    print("Matched Header:")
    print(matched_header)
    print(matched_address)

    if is_own_or_internal_sender(sender):
        mark_message_handled(state, message_id, uid_text, now)
        save_state(state_file, state)
        return "skipped:internal_sender"

    if is_auto_generated(message):
        mark_message_handled(state, message_id, uid_text, now)
        save_state(state_file, state)
        return "skipped:auto_generated"

    if already_replied_recently(state, sender, now):
        mark_message_handled(state, message_id, uid_text, now)
        save_state(state_file, state)
        return f"skipped:24h_limit:{mask_address(sender)}"

    payload = build_resend_payload(
        to_address=sender,
        from_address=config["from_address"],
        reply_to=config["reply_to"],
    )
    key = idempotency_key(sender, now)

    if dry_run:
        return f"dry_run:would_reply:{mask_address(sender)}"

    send_resend_email(
        api_url=config["resend_url"],
        api_token=config["resend_token"],
        payload=payload,
        idempotency=key,
    )

    state.setdefault("senders", {})[sender] = now.isoformat()
    mark_message_handled(state, message_id, uid_text, now)
    save_state(state_file, state)

    return f"sent:{mask_address(sender)}"


def require_config(config: dict[str, str], *, dry_run: bool) -> None:
    required = ["imap_user", "imap_password"]
    if not dry_run:
        required.append("resend_token")

    missing = [name for name in required if not config.get(name)]
    if missing:
        raise SystemExit(f"Missing required environment variables: {', '.join(missing)}")

    if "gmail.com" in config["from_address"].lower() or "gmail.com" in config["reply_to"].lower():
        raise SystemExit("Private Gmail addresses are forbidden in From or Reply-To.")


def run_once(*, dry_run: bool, config: dict[str, str], state_file: Path) -> int:
    require_config(config, dry_run=dry_run)
    state = load_state(state_file)

    with imaplib.IMAP4_SSL(config["imap_host"]) as mailbox:
        mailbox.login(config["imap_user"], config["imap_password"])
        select_status, select_data = mailbox.select(config["imap_mailbox"])
        if select_status != "OK":
            raise RuntimeError(f"IMAP mailbox select failed: {config['imap_mailbox']}")

        mailbox_total = select_data[0].decode("utf-8", errors="replace") if select_data and select_data[0] else "0"
        print("Selected Mailbox:")
        print(config["imap_mailbox"])
        print("IMAP Search Criteria:")
        print(config["imap_search"])
        print("Mailbox total:")
        print(mailbox_total)
        print("Last UID:")
        print("not_used")

        status, data = mailbox.uid("SEARCH", None, config["imap_search"])
        if status != "OK":
            raise RuntimeError("IMAP search failed.")

        uids = data[0].split() if data and data[0] else []
        try:
            imap_limit = max(1, int(config["imap_limit"]))
        except ValueError:
            imap_limit = 50
        recent_uids = uids[-imap_limit:]
        print("Search returned:")
        print(len(uids))
        print("Recent UID limit:")
        print(imap_limit)
        print("UID list:")
        print(" ".join(uid.decode("utf-8", errors="replace") for uid in recent_uids) if recent_uids else "<empty>")

        processed = 0

        for uid in recent_uids:
            status, fetched = mailbox.uid("FETCH", uid, "(RFC822)")
            if status != "OK" or not fetched:
                continue

            for item in fetched:
                if not isinstance(item, tuple):
                    continue
                result = process_message(
                    mailbox=mailbox,
                    uid=uid,
                    raw_message=item[1],
                    state=state,
                    state_file=state_file,
                    dry_run=dry_run,
                    config=config,
                )
                print(result)
                processed += 1

        return processed


def build_config() -> dict[str, str]:
    return {
        "imap_host": env("SUPPORT_IMAP_HOST", "imap.gmail.com"),
        "imap_user": env("SUPPORT_IMAP_USER"),
        "imap_password": env("SUPPORT_IMAP_PASSWORD"),
        "imap_mailbox": env("SUPPORT_IMAP_MAILBOX", "INBOX"),
        "imap_search": "ALL",
        "imap_limit": env("SUPPORT_IMAP_LIMIT", "50"),
        "from_address": env("SUPPORT_FROM", "Aurora HY Support <support@mail.aurorahy.com>"),
        "reply_to": env("SUPPORT_REPLY_TO", "support@aurorahy.com"),
        "support_route_address": env("SUPPORT_ROUTE_ADDRESS", "support@aurorahy.com"),
        "resend_url": env("SUPPORT_RESEND_URL", "https://api.resend.com/emails"),
        "resend_token": env("EMAIL_API_TOKEN"),
        "loop_seconds": env("SUPPORT_LOOP_SECONDS", "60"),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Aurora HY support auto reply via Gmail IMAP and Resend.")
    parser.add_argument("--dry-run", action="store_true", help="Read messages but do not send or update state.")
    parser.add_argument("--once", action="store_true", help="Run one polling pass and exit. This is the default.")
    parser.add_argument("--loop", action="store_true", help="Poll continuously.")
    parser.add_argument(
        "--state-file",
        default=env("SUPPORT_STATE_FILE", ".support_auto_reply_state.json"),
        help="Path to the 24-hour reply state file.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = build_config()
    state_file = Path(args.state_file)
    loop = args.loop and not args.once

    while True:
        processed = run_once(dry_run=args.dry_run, config=config, state_file=state_file)
        print(f"processed={processed}")

        if not loop:
            return 0

        try:
            sleep_seconds = max(10, int(config["loop_seconds"]))
        except ValueError:
            sleep_seconds = 60
        time.sleep(sleep_seconds)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("stopped")
        raise SystemExit(130)
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        raise SystemExit(1)
