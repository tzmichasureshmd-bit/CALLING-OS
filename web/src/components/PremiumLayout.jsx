import { useState, useMemo } from "react";
import { Home, BarChart3, Folder, Calendar, Settings, Sun, Moon } from "lucide-react";
import "../styles/premium-layout.css";

export default function PremiumLayout({ children, pageTitle = "Schedule", onThemeToggle }) {
  const [activeNav, setActiveNav] = useState("calendar");

  return (
    <div className="premium-layout">
      <div className="dashboard-container">
        {/* Gradient Background */}
        <div className="dashboard-gradient-bg"></div>

        {/* Left Sidebar */}
        <div className="premium-sidebar">
          <div className="sidebar-icon-group">
            <button
              className={`sidebar-icon-btn ${activeNav === "home" ? "active" : ""}`}
              onClick={() => setActiveNav("home")}
              title="Home"
            >
              <Home size={20} />
            </button>
            <button
              className={`sidebar-icon-btn ${activeNav === "analytics" ? "active" : ""}`}
              onClick={() => setActiveNav("analytics")}
              title="Analytics"
            >
              <BarChart3 size={20} />
            </button>
            <button
              className={`sidebar-icon-btn ${activeNav === "files" ? "active" : ""}`}
              onClick={() => setActiveNav("files")}
              title="Files"
            >
              <Folder size={20} />
            </button>
            <button
              className={`sidebar-icon-btn ${activeNav === "calendar" ? "active" : ""}`}
              onClick={() => setActiveNav("calendar")}
              title="Calendar"
            >
              <Calendar size={20} />
            </button>
            <button
              className={`sidebar-icon-btn ${activeNav === "settings" ? "active" : ""}`}
              onClick={() => setActiveNav("settings")}
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </div>

          <div className="sidebar-spacer"></div>

          <div className="sidebar-theme-group">
            <button
              className="sidebar-icon-btn"
              onClick={onThemeToggle}
              title="Theme"
            >
              <Sun size={20} />
            </button>
            <button
              className="sidebar-icon-btn"
              title="Dark Mode"
            >
              <Moon size={20} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="dashboard-content">
          {/* Top Navigation */}
          <div className="top-nav-bar">
            <div className="nav-left">
              <div className="brand-logo">N</div>
            </div>

            <div className="nav-center">
              <button className="dropdown-btn">
                Schedule <span>▼</span>
              </button>
              <div className="search-bar">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Look up representative, record ID, or phone line..."
                />
              </div>
            </div>

            <div className="nav-right">
              <button className="icon-btn" title="Apps">
                ⊞
              </button>
              <button className="icon-btn" title="Notifications">
                🔔
              </button>
              <div className="user-avatar">AW</div>
            </div>
          </div>

          {/* Page Content */}
          <div className="page-content">
            {/* Page Header */}
            <div className="page-header">
              <h1 className="page-title">{pageTitle}</h1>
              <div className="page-meta">Squad Beta • 10:15 AM EST</div>
            </div>

            {/* Schedule Controls */}
            <div className="schedule-controls">
              <div className="date-selector">
                <button className="date-nav-btn">←</button>
                <span className="date-label">18 Mar</span>
                <button className="date-nav-btn">→</button>
              </div>

              <div className="view-selector">
                <button className="view-option active">Single Day</button>
                <button className="view-option">7 Days</button>
              </div>

              <button className="create-btn">+ Create Booking</button>
            </div>

            {/* Calendar Grid */}
            <div className="calendar-grid">
              {/* Time Column */}
              <div className="time-column">
                {[
                  "8:00 am",
                  "8:30 am",
                  "9:00 am",
                  "9:30 am",
                  "10:00 am",
                  "10:30 am",
                  "11:00 am",
                  "11:30 am",
                ].map((time) => (
                  <div key={time} className="time-slot">
                    {time}
                  </div>
                ))}
              </div>

              {/* Schedule Columns */}
              <div className="schedule-columns">
                {[0, 1, 2].map((colIdx) => (
                  <div key={colIdx} className="schedule-column">
                    <div className="column-slots">
                      {Array(8)
                        .fill(0)
                        .map((_, idx) => (
                          <div key={idx} className="time-row"></div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Current Time Indicator */}
              <div
                className="current-time-indicator"
                style={{
                  top: `calc(20px + ${5.5 * 50}px)`,
                }}
              >
                <div className="current-time-label">10:45 am</div>
              </div>

              {/* Booking Cards */}
              <BookingCard
                name="Sarah"
                title="Alignment Sync"
                time="8:00–8:30"
                rep="Alex Wright"
                color="card-yellow"
                style={{
                  top: `calc(20px + ${0 * 50}px)`,
                  left: "calc(80px + 5%)",
                  width: "calc((100% - 80px) / 3 - 10px)",
                  height: "50px",
                }}
              />
              <BookingCard
                name="Marcus"
                title="Client Assist"
                time="8:00–8:30"
                rep="Hannah Lee"
                color="card-blue"
                style={{
                  top: `calc(20px + ${0 * 50}px)`,
                  left: "calc(80px + 38%)",
                  width: "calc((100% - 80px) / 3 - 10px)",
                  height: "50px",
                }}
              />
              <BookingCard
                name="Liam"
                title="Technical Help"
                time="8:30–9:00"
                rep="Alex Chen"
                color="card-green"
                style={{
                  top: `calc(20px + ${1 * 50}px)`,
                  left: "calc(80px + 71%)",
                  width: "calc((100% - 80px) / 3 - 10px)",
                  height: "50px",
                }}
              />
              <BookingCard
                name="Sophia"
                title="Introductory..."
                time="10:00–10:30"
                rep="Alex Wright"
                color="card-pink"
                style={{
                  top: `calc(20px + ${4 * 50}px)`,
                  left: "calc(80px + 5%)",
                  width: "calc((100% - 80px) / 3 - 10px)",
                  height: "50px",
                }}
              />
              <BookingCard
                name="Daniel"
                title="Project Transfer"
                time="11:00–11:30"
                rep="Alex Wright"
                color="card-yellow"
                style={{
                  top: `calc(20px + ${6 * 50}px)`,
                  left: "calc(80px + 71%)",
                  width: "calc((100% - 80px) / 3 - 10px)",
                  height: "50px",
                }}
              />
            </div>

            {/* Floating Booking Panel */}
            <FloatingBookingPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingCard({ name, title, time, rep, color, style }) {
  return (
    <div className={`booking-card ${color}`} style={style}>
      <div className="booking-header">
        <div className="booking-avatar">{name.charAt(0)}</div>
        <div className="booking-info">
          <div className="booking-name">{name}</div>
          <div className="booking-title">{title}</div>
        </div>
      </div>
      <div className="booking-details">
        <span className="booking-time">{time}</span>
        <span className="booking-indicator"></span>
      </div>
      <div className="booking-rep">{rep}</div>
    </div>
  );
}

function FloatingBookingPanel() {
  return (
    <div className="floating-panel">
      <input
        type="text"
        className="panel-input"
        placeholder="Type Session Title..."
      />

      <div className="input-with-icon">
        <span className="input-icon">📅</span>
        <input type="text" placeholder="Tuesday, 18 May" />
      </div>

      <div className="input-with-icon">
        <span className="input-icon">🕐</span>
        <input type="text" placeholder="10:15 AM" />
      </div>

      <div className="input-with-icon">
        <span className="input-icon">📍</span>
        <input type="text" placeholder="1 Lexington Ave" />
      </div>

      <div className="participants-row">
        <div className="participant-avatar">AW</div>
        <div className="participant-avatar">MK</div>
        <div className="participant-avatar">LH</div>
        <button className="add-participant-btn">+</button>
      </div>

      <button className="panel-button">
        Create Booking <span>+</span>
      </button>
    </div>
  );
}
