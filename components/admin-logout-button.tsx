"use client";

export default function AdminLogoutButton() {
  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-2xl bg-red-500/90 px-4 py-2 text-sm text-white hover:bg-red-600 transition"
    >
      로그아웃
    </button>
  );
}