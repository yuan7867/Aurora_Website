import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen

from .sha256 import verify_sha256
from .update_client import UpdateClient
from .version_compare import is_update_required


class UpdateService:
    def __init__(self, api_base_url, product, current_exe_path, timeout=30):
        self.client = UpdateClient(api_base_url, product, timeout=timeout)
        self.current_exe_path = Path(current_exe_path)
        self.timeout = timeout

    def check(self, current_version):
        latest = self.client.latest()
        latest["needs_update"] = is_update_required(
            current_version,
            latest.get("version"),
            latest.get("minimum_version"),
            latest.get("force_update", False),
        )
        return latest

    def download(self, latest):
        filename = self.current_exe_path.name
        target = Path(tempfile.gettempdir()) / f"aurora-update-{latest['product']}-{latest['version']}-{filename}"
        request = Request(latest["download_url"], headers={"User-Agent": "Aurora-Updater/1.0"}, method="GET")
        with urlopen(request, timeout=self.timeout) as response, open(target, "wb") as output:
            shutil.copyfileobj(response, output)

        if not verify_sha256(target, latest["sha256"]):
            target.unlink(missing_ok=True)
            raise ValueError("Downloaded update failed SHA256 verification.")

        return target

    def replace_exe(self, downloaded_path):
        backup_path = self.current_exe_path.with_suffix(self.current_exe_path.suffix + ".bak")
        self.current_exe_path.parent.mkdir(parents=True, exist_ok=True)

        if self.current_exe_path.exists():
            os.replace(self.current_exe_path, backup_path)

        try:
            os.replace(downloaded_path, self.current_exe_path)
        except Exception:
            if backup_path.exists():
                os.replace(backup_path, self.current_exe_path)
            raise

        return backup_path

    def restart(self, args=None):
        command = [str(self.current_exe_path)]
        if args:
            command.extend(args)
        return subprocess.Popen(command)

    def install_and_restart(self, latest, args=None):
        downloaded = self.download(latest)
        backup = self.replace_exe(downloaded)
        process = self.restart(args=args)
        return {
            "status": "restarted",
            "backup": str(backup),
            "pid": process.pid,
        }
