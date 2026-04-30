/** Initials for “my” avatar in chat (họ tên hoặc username). */
export function userInitials(user) {
  const name = String(user?.fullName || "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  const u = String(user?.username || "").trim();
  return u.slice(0, 2).toUpperCase() || "?";
}

/** Fallback when peer image fails to load. */
export function initialsFromUsername(username) {
  const u = String(username || "").trim();
  return u.slice(0, 2).toUpperCase() || "?";
}
