import { useEffect, useState } from "react";
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
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { fetchNotifications, markRead, markAllRead } from "../api/notifications.js";
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
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setNotificationsLoading(true);
      try { const items = await fetchNotifications({ employee: (user?.role || "").toUpperCase() === "EMPLOYEE" }); if (active) setNotifications(items); }
      finally { if (active) setNotificationsLoading(false); }
    }
    load();
    const interval = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(interval); };
  }, [user?.role]);

  const unreadNotifications = notifications.filter((item) => !item.read);

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
        <section className="premium-shell__workspace">
          <header className="premium-shell__topbar">
            <NavLink to="/dashboard" className="premium-shell__topbar-brand" aria-label="CallNexa home">
              <img src="/logo.png" alt="CallNexa" />
            </NavLink>
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
                  onClick={() => navigate("/dashboard")}
                  title="Go to dashboard"
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
              <button type="button" className="premium-shell__compact-button" title="Open navigation" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
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
                  {unreadNotifications.length > 0 && <span className="premium-shell__notification-dot" />}
                </button>
                {notificationsOpen && (
                  <div className="premium-shell__popover">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><strong>Notifications</strong>{notifications.length > 0 && <button type="button" onClick={() => { markAllRead(notifications); setNotifications((items) => items.map((item) => ({ ...item, read: true }))); }} style={{ border: 0, background: "none", color: "var(--accent)", cursor: "pointer", fontSize: 11 }}>Mark all read</button>}</div>
                    {notificationsLoading && <span>Loading…</span>}
                    {!notificationsLoading && notifications.length === 0 && <span>No new notifications</span>}
                    {!notificationsLoading && notifications.slice(0, 8).map((item) => <button key={item.id} type="button" onClick={() => { markRead([item.id]); setNotifications((items) => items.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry)); if (item.to) navigate(item.to); setNotificationsOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", border: 0, borderRadius: 8, padding: "8px 0", background: "transparent", color: "var(--text-primary)", cursor: "pointer", opacity: item.read ? 0.65 : 1 }}><strong style={{ display: "block", fontSize: 12 }}>{item.title}</strong><span style={{ display: "block", marginTop: 2, fontSize: 11, color: "var(--text-muted)" }}>{item.sub || ""}</span></button>)}
                  </div>
                )}
              </div>
              <div className="premium-shell__account-wrap">
                <button
                  type="button"
                  className="premium-shell__account premium-shell__account-button"
                  onClick={() => setProfileOpen((open) => !open)}
                  aria-label="Open profile menu"
                  aria-expanded={profileOpen}
                >
                  <span className="premium-shell__avatar">{userInitials}</span>
                  <span className="premium-shell__account-copy">
                    <strong>{organizationName}</strong>
                    <small>{user?.email || roleLabel}</small>
                  </span>
                  <ChevronDown size={13} />
                </button>
                {profileOpen && (
                  <div className="premium-shell__profile-popover">
                    <div className="premium-shell__profile-heading">
                      <span className="premium-shell__avatar premium-shell__avatar--large">{userInitials}</span>
                      <div>
                        <strong>{user?.name || organizationName}</strong>
                        <small>{user?.email || "Local account"}</small>
                      </div>
                    </div>
                    <div className="premium-shell__profile-role">{roleLabel}</div>
                    <NavLink to="/settings" onClick={() => setProfileOpen(false)}>Open settings</NavLink>
                    <button type="button" onClick={handleLogout}>
                      <LogOut size={15} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className={`premium-shell__mobile-nav${menuOpen ? " is-open" : ""}`}>
              {navItems.map(({ to, label, icon: Icon, end, children: subPages = [] }) => (
                <div key={to}>
                  <NavLink to={to} end={end} onClick={() => setMenuOpen(false)}>
                    <Icon size={17} />
                    {label}
                  </NavLink>
                  {subPages.map((page) => (
                    <NavLink key={page.to} to={page.to} onClick={() => setMenuOpen(false)} className="premium-shell__mobile-subnav">
                      {page.label}
                    </NavLink>
                  ))}
                </div>
              ))}
              <button type="button" onClick={handleLogout}>
                <LogOut size={17} />
                Sign out
              </button>
            </div>

          <div className="premium-shell__body">
            <aside className="premium-shell__sidebar" aria-label="Primary navigation">
              <nav className="premium-shell__nav" aria-label={`${roleLabel} navigation`}>
                {navItems.map(({ to, label, icon: Icon, end, children: subPages = [] }) => {
                  const groupActive = location.pathname === to || subPages.some((page) => location.pathname === page.to);
                  return (
                    <div className="premium-shell__nav-group" key={to}>
                      <NavLink
                        to={to}
                        end={end}
                        title={label}
                        aria-label={label}
                        className={`premium-shell__nav-item${groupActive ? " is-active" : ""}`}
                      >
                        <Icon size={18} strokeWidth={1.8} />
                        <span>{label}</span>
                      </NavLink>
                      {subPages.length > 0 && (
                        <div className="premium-shell__submenu">
                          <strong>{label}</strong>
                          {subPages.map((page) => (
                            <NavLink key={page.to} to={page.to} className={({ isActive }) => isActive ? "is-active" : ""}>
                              {page.label}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
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
          </div>
        </section>
      </div>
    </div>
  );
}
