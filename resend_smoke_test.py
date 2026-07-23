#!/usr/bin/env python3
import json
import os
import urllib.request

api_token = os.environ["EMAIL_API_TOKEN"]
to_email = os.environ["SMOKE_TEST_TO"]
url = "https://api.resend.com/emails"

payload = {
    "from": "Aurora HY Support <support@mail.aurorahy.com>",
    "to": [to_email],
    "subject": "Resend Smoke Test",
    "text": "Resend Smoke Test",
}

request = urllib.request.Request(
    url,
    data=json.dumps(payload).encode("utf-8"),
    method="POST",
    headers={"Authorization": f"Bearer {api_token}", "Content-Type": "application/json"},
)

with urllib.request.urlopen(request, timeout=20) as response:
    print(response.status)
    print(response.read().decode("utf-8"))
