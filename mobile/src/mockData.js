// CALLOS NOVA mobile — mock data for the logged-in employee.
import { palette } from "./theme";

export const EMPLOYEE = {
  name: "Rahul Sharma",
  email: "rahul.sharma@acme.com",
  companyCode: "TZM-2026-5823",
  companyName: "Tzmicha IT Solutions",
  simName: "SIM 1",
  simPhone: "7731998508",
  device: "V2303",
  avatar: null,
};

export const RANGES = ["Today", "Yesterday", "Last Week", "Last 30"];

// Home hero + KPIs
export const HOME = {
  totalCalls: 84,
  connectedPct: 68,
  connected: 57,
  talkTime: "3h 42m",
  missed: 12,
  avgDuration: "02:36",
  deltas: { total: 18, talk: 12, connected: 16, missed: -11, avg: 7 },
  spark: {
    total: [40, 52, 48, 61, 55, 72, 84],
    connected: [22, 31, 28, 40, 37, 49, 57],
    missed: [8, 6, 9, 5, 7, 10, 12],
    talk: [120, 150, 140, 180, 170, 210, 222],
  },
  week: { labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], data: [68, 84, 72, 90, 76, 45, 51] },
  callMix: [
    { label: "Incoming", value: 35, color: palette.teal },
    { label: "Outgoing", value: 48, color: palette.violet },
    { label: "Missed", value: 17, color: palette.red },
  ],
  momentum: { streak: "7 days", bestDay: "90 calls", bestDaySub: "Thu, 5 Sep", avgDuration: "02:36" },
};

// Calls grouped by day
export const CALLS = [
  { id: "1", type: "outgoing", name: "John Smith", phone: "+91 87654 43210", duration: "04:32", time: "09:42 AM", ago: "2m ago", sim: "SIM 1", recording: false },
  { id: "2", type: "incoming", name: "Priya Sharma", phone: "+91 87654 32109", duration: "06:18", time: "09:12 AM", ago: "32m ago", sim: "SIM 2", recording: true },
  { id: "3", type: "outgoing", name: "Acme Enterprises", phone: "+91 93412 99887", duration: "01:32", time: "08:42 AM", ago: "57m ago", sim: "SIM 1", recording: false },
  { id: "4", type: "missed", name: "Rohan Mehta", phone: "+91 91234 56789", duration: "00:00", time: "08:15 AM", ago: "1h 21m ago", sim: "SIM 1", recording: false },
  { id: "5", type: "incoming", name: "Neha Verma", phone: "+91 99123 45678", duration: "07:42", time: "07:38 PM", ago: "Yesterday", sim: "SIM 1", recording: true, day: "Yesterday" },
  { id: "6", type: "outgoing", name: "Karan Patel", phone: "+91 88990 11223", duration: "03:08", time: "06:21 PM", ago: "Yesterday", sim: "SIM 1", recording: false, day: "Yesterday" },
  { id: "7", type: "missed", name: "Vikram Singh", phone: "+91 90011 22334", duration: "00:00", time: "05:47 PM", ago: "Yesterday", sim: "SIM 2", recording: false, day: "Yesterday" },
  { id: "8", type: "outgoing", name: "Global Enterprises", phone: "+91 99887 77665", duration: "05:11", time: "04:50 PM", ago: "Yesterday", sim: "SIM 1", recording: true, day: "Yesterday" },
];

// Insights
export const INSIGHTS = {
  totalVsConnected: {
    labels: ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"],
    total: [62, 70, 58, 40, 44, 78, 84],
    connected: [30, 42, 36, 22, 26, 50, 57],
  },
  outcomes: {
    labels: ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"],
    data: [
      { connected: 30, missed: 8, rejected: 4 },
      { connected: 42, missed: 6, rejected: 3 },
      { connected: 36, missed: 9, rejected: 5 },
      { connected: 22, missed: 7, rejected: 2 },
      { connected: 26, missed: 5, rejected: 3 },
      { connected: 50, missed: 10, rejected: 4 },
      { connected: 57, missed: 12, rejected: 5 },
    ],
  },
  duration: [
    { label: "0 - 1 min", value: 18, color: palette.teal },
    { label: "1 - 3 min", value: 32, color: palette.violet },
    { label: "3 - 5 min", value: 26, color: palette.cyan },
    { label: "5+ min", value: 24, color: palette.amber },
  ],
  topCallers: [
    { name: "Rahul Sharma", calls: 128, pct: 100 },
    { name: "Priya Sharma", calls: 96, pct: 75 },
    { name: "Karan Patel", calls: 72, pct: 56 },
    { name: "Neha Verma", calls: 64, pct: 50 },
    { name: "Vikram Singh", calls: 48, pct: 38 },
  ],
};

export const PERMISSIONS = [
  { key: "callLog", label: "Call Log", status: "allowed" },
  { key: "contacts", label: "Contacts", status: "allowed" },
  { key: "recording", label: "Recording", status: "allowed" },
];
