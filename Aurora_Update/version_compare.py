def _parts(version):
    clean = str(version or "").strip().lstrip("vV")
    return [int(part) if part.isdigit() else 0 for part in clean.split(".")]


def compare_versions(left, right):
    left_parts = _parts(left)
    right_parts = _parts(right)
    length = max(len(left_parts), len(right_parts))
    left_parts.extend([0] * (length - len(left_parts)))
    right_parts.extend([0] * (length - len(right_parts)))

    if left_parts < right_parts:
        return -1
    if left_parts > right_parts:
        return 1
    return 0


def is_update_required(current_version, latest_version, minimum_version=None, force_update=False):
    if force_update:
        return True
    if minimum_version and compare_versions(current_version, minimum_version) < 0:
        return True
    return compare_versions(current_version, latest_version) < 0
