import hashlib
import http.server
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path

from Aurora_Update.sha256 import verify_sha256
from Aurora_Update.update_dialog import format_update_prompt
from Aurora_Update.update_service import UpdateService
from Aurora_Update.version_compare import compare_versions, is_update_required


class UpdatePlatformTest(unittest.TestCase):
    def test_version_compare_and_force_update(self):
        self.assertEqual(compare_versions("2.4.1", "2.4.0"), 1)
        self.assertEqual(compare_versions("2.4", "2.4.0"), 0)
        self.assertTrue(is_update_required("2.3.7", "2.4.1", "2.3.8"))
        self.assertTrue(is_update_required("2.4.1", "2.4.1", force_update=True))
        self.assertFalse(is_update_required("2.4.1", "2.4.1"))

    def test_sha256_verification(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "Aurora.exe"
            path.write_bytes(b"aurora-release")
            expected = hashlib.sha256(b"aurora-release").hexdigest().upper()
            self.assertTrue(verify_sha256(path, expected))
            self.assertFalse(verify_sha256(path, "00"))

    def test_update_prompt_hides_later_when_forced(self):
        prompt = format_update_prompt("2.4.0", {
            "version": "2.4.1",
            "force_update": True,
            "release_notes": ["Improved Exit Engine"],
        })
        self.assertIn("Aurora Update Available", prompt)
        self.assertIn("Update Now", prompt)
        self.assertNotIn("Later", prompt)

    def test_download_replace_restart_and_rollback(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact = root / "release.exe"
            artifact.write_bytes(b"new-release")
            expected = hashlib.sha256(b"new-release").hexdigest().upper()
            current = root / "Aurora_MT5_AI_Trader.exe"
            current.write_bytes(b"old-release")

            handler = http.server.SimpleHTTPRequestHandler
            server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            previous_cwd = Path.cwd()
            try:
                os.chdir(root)
                thread.start()
                port = server.server_address[1]
                latest = {
                    "product": "mt5",
                    "version": "2.4.1",
                    "download_url": f"http://127.0.0.1:{port}/release.exe",
                    "sha256": expected,
                }
                service = UpdateService("http://127.0.0.1:1", "mt5", current)
                downloaded = service.download(latest)
                self.assertTrue(downloaded.exists())
                backup = service.replace_exe(downloaded)
                self.assertEqual(current.read_bytes(), b"new-release")
                self.assertEqual(Path(backup).read_bytes(), b"old-release")
            finally:
                server.shutdown()
                server.server_close()
                os.chdir(previous_cwd)

    def test_failed_replace_rolls_back(self):
        with tempfile.TemporaryDirectory() as directory:
            current = Path(directory) / "Aurora_XAU_Trader.exe"
            current.write_bytes(b"stable")
            service = UpdateService("http://127.0.0.1:1", "xau", current)
            with self.assertRaises(FileNotFoundError):
                service.replace_exe(Path(directory) / "missing.exe")
            self.assertEqual(current.read_bytes(), b"stable")

    def test_restart_launches_process(self):
        service = UpdateService("http://127.0.0.1:1", "mt5", sys.executable)
        process = service.restart(["-c", "pass"])
        self.assertEqual(process.wait(timeout=5), 0)


if __name__ == "__main__":
    unittest.main()
