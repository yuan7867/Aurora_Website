import hashlib


def file_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def verify_sha256(path, expected_sha256):
    return file_sha256(path) == str(expected_sha256 or "").strip().upper()
