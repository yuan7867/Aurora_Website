def format_update_prompt(current_version, latest):
    notes = "\n".join(f"- {item}" for item in latest.get("release_notes", []))
    later = "" if latest.get("force_update") else "\nLater"
    return (
        "Aurora Update Available\n\n"
        f"Current Version: {current_version}\n"
        f"Latest Version: {latest.get('version')}\n\n"
        "Release Notes\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"{notes or '- Maintenance release'}\n\n"
        "Update Now"
        f"{later}"
    )
