import { useState } from "react";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  LogOut,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import "../styles/premium-layout.css";

const DEFAULT_NAV = [];

function initials(value, fallback = "CN") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  return text
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function PremiumLayout({
  children,
  currentPage = "Dashboard",
  navItems = DEFAULT_NAV,
  roleLabel = "Organization",
  showPageHeading = false,
}) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const organizationName = user?.organization_name || "CallNexa";
  const userInitials = initials(user?.name || user?.email, "AW");

  async function handleLogout() {
    await logout();
    window.location.href = roleLabel === "Super Admin" ? "/admin" : "/login";
  }

  function handleSearchKeyDown(event) {
    if (event.key === "Escape") setSearch("");
    if (event.key === "Enter" && search.trim()) {
      navigate(`/call-logs?search=${encodeURIComponent(search.trim())}`);
    }
  }

  return (
    <div className="premium-shell">
      <div className="premium-shell__container">
        <aside className="premium-shell__sidebar" aria-label="Primary navigation">
          <NavLink to="/dashboard" className="premium-shell__brand" aria-label="CallNexa home">
            <span className="premium-shell__brand-mark">N</span>
            <span className="premium-shell__brand-name">CallNexa</span>
          </NavLink>

          <nav className="premium-shell__nav" aria-label={`${roleLabel} navigation`}>
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={label}
                aria-label={label}
                className={({ isActive }) =>
                  `premium-shell__nav-item${isActive ? " is-active" : ""}`
                }
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="premium-shell__sidebar-footer">
            <button
              type="button"
              className="premium-shell__icon-button"
              onClick={toggleTheme}
              title={theme === "light" ? "Use dark theme" : "Use light theme"}
              aria-label={theme === "light" ? "Use dark theme" : "Use light theme"}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              type="button"
              className="premium-shell__icon-button premium-shell__icon-button--danger"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </aside>

        <section className="premium-shell__workspace">
          <header className="premium-shell__topbar">
            <div className="premium-shell__topbar-left">
              <button
                type="button"
                className="premium-shell__menu-button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Toggle navigation"
                aria-expanded={menuOpen}
              >
                {menuOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
              <div className="premium-shell__page-switcher">
                <button
                  type="button"
                  className="premium-shell__page-switcher-button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-expanded={menuOpen}
                >
                  {currentPage}
                  <ChevronDown size={14} />
                </button>
                <span className="premium-shell__role-label">{roleLabel}</span>
              </div>
            </div>

            <div className="premium-shell__topbar-center">
              <div className="premium-shell__search">
                <Search size={15} aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Look up representative, record ID, or phone line..."
                  aria-label="Search calls and records"
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                    <span aria-hidden="true">×</span>
                  </button>
                )}
              </div>
            </div>

            <div className="premium-shell__topbar-right">
              <button type="button" className="premium-shell__compact-button" title="Applications" aria-label="Applications">
                <Grid2X2 size={17} />
              </button>
              <div className="premium-shell__notification-wrap">
                <button
                  type="button"
                  className="premium-shell__compact-button"
                  onClick={() => setNotificationsOpen((open) => !open)}
                  aria-label="Notifications"
                  aria-expanded={notificationsOpen}
                >
                  <Bell size={17} />
                  <span className="premium-shell__notification-dot" />
                </button>
                {notificationsOpen && (
                  <div className="premium-shell__popover">
                    <strong>Notifications</strong>
                    <span>No new notifications</span>
                  </div>
                )}
              </div>
              <div className="premium-shell__account" title={user?.email || roleLabel}>
                <span className="premium-shell__avatar">{userInitials}</span>
                <span className="premium-shell__account-copy">
                  <strong>{organizationName}</strong>
                  <small>{user?.email || roleLabel}</small>
                </span>
              </div>
            </div>
          </header>

          <div className={`premium-shell__mobile-nav${menuOpen ? " is-open" : ""}`}>
              {navItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}>
                  <Icon size={17} />
                  {label}
                </NavLink>
              ))}
              <button type="button" onClick={handleLogout}>
                <LogOut size={17} />
                Sign out
              </button>
            </div>

          <main className="premium-shell__page">
            {showPageHeading && (
              <div className="premium-shell__heading">
                <div>
                  <h1>{currentPage}</h1>
                  <p>Everything important, in one calm workspace.</p>
                </div>
                <span>{organizationName} • {roleLabel}</span>
              </div>
            )}
            {children}
          </main>
        </section>
      </div>
    </div>
  );
}
