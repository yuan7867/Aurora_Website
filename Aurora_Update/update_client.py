import json
from urllib.request import Request, urlopen


class UpdateClient:
    def __init__(self, api_base_url, product, timeout=5):
        self.api_base_url = api_base_url.rstrip("/")
        self.product = product
        self.timeout = timeout

    def latest(self):
        request = Request(
            f"{self.api_base_url}/api/update/latest/{self.product}",
            headers={"Accept": "application/json", "User-Agent": "Aurora-Updater/1.0"},
            method="GET",
        )
        with urlopen(request, timeout=self.timeout) as response:
            return json.loads(response.read().decode("utf-8"))
