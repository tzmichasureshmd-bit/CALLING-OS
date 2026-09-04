import { View, Text } from "react-native";
import Svg, {
  Circle, Path, Rect, Line, G, Defs, LinearGradient, Stop, Polyline,
} from "react-native-svg";
import { palette, useTheme } from "./theme";

// ---------- helpers ----------
function buildLinePath(values, w, h, pad = 4) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = (w - pad * 2) / (values.length - 1 || 1);
  return values.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

// ---------- Radial progress ring (hero "Connected %") ----------
export function RadialRing({ percent = 68, size = 150, stroke = 14, label = "Connected" }) {
  const { theme } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (percent / 100) * c;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.teal} />
            <Stop offset="1" stopColor={palette.violet} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.surface2} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="url(#ring)" strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ fontSize: 34, fontWeight: "800", color: theme.primary }}>{percent}%</Text>
        <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{label}</Text>
      </View>
    </View>
  );
}

// ---------- Sparkline (mini line) ----------
export function Sparkline({ data, color = palette.teal, width = 120, height = 40 }) {
  const d = buildLinePath(data, width, height);
  const id = `sp${Math.round(Math.random() * 99999)}`;
  const areaD = `${d} L${width - 4},${height - 4} L4,${height - 4} Z`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.28" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={areaD} fill={`url(#${id})`} />
      <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// ---------- Mini bars ----------
export function MiniBars({ data, color = palette.amber, width = 120, height = 40 }) {
  const max = Math.max(...data, 1);
  const gap = 3;
  const bw = (width - gap * (data.length - 1)) / data.length;
  return (
    <Svg width={width} height={height}>
      {data.map((v, i) => {
        const bh = Math.max((v / max) * height, 2);
        return <Rect key={i} x={i * (bw + gap)} y={height - bh} width={bw} height={bh} rx={2} fill={color} opacity={0.85} />;
      })}
    </Svg>
  );
}

// ---------- Weekly bar chart with gradient ----------
export function BarChart({ data, labels, width, height = 150 }) {
  const max = Math.max(...data, 1);
  const gap = 12;
  const bw = (width - gap * (data.length - 1)) / data.length;
  const chartH = height - 24;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="barG" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={palette.teal} />
          <Stop offset="1" stopColor={palette.violet} />
        </LinearGradient>
      </Defs>
      {data.map((v, i) => {
        const bh = Math.max((v / max) * chartH, 3);
        const x = i * (bw + gap);
        return (
          <G key={i}>
            <Rect x={x} y={chartH - bh} width={bw} height={bh} rx={6} fill="url(#barG)" />
            <Text />
          </G>
        );
      })}
    </Svg>
  );
}

// ---------- Donut ----------
export function Donut({ segments, size = 130, stroke = 22 }) {
  const { theme } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.surface2} strokeWidth={stroke} fill="none" />
      {segments.map((seg, i) => {
        const len = (seg.value / total) * c;
        const el = (
          <Circle
            key={i}
            cx={size / 2} cy={size / 2} r={r}
            stroke={seg.color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += len;
        return el;
      })}
    </Svg>
  );
}

// ---------- Multi-line chart (Total vs Connected) ----------
export function LineChart({ series, width, height = 170, labels = [] }) {
  const { theme } = useTheme();
  const pad = 8;
  const all = series.flatMap((s) => s.data);
  const max = Math.max(...all, 1);
  const chartH = height - 22;
  const step = (width - pad * 2) / (series[0].data.length - 1 || 1);
  const toPath = (values) => values.map((v, i) => {
    const x = pad + i * step;
    const y = chartH - pad - (v / max) * (chartH - pad * 2);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <Svg width={width} height={height}>
      {[0.25, 0.5, 0.75].map((f, i) => (
        <Line key={i} x1={pad} y1={chartH * f} x2={width - pad} y2={chartH * f} stroke={theme.border} strokeWidth={1} strokeDasharray="3 4" />
      ))}
      {series.map((s, i) => (
        <G key={i}>
          <Path d={toPath(s.data)} stroke={s.color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {s.data.map((v, j) => {
            const x = pad + j * step;
            const y = chartH - pad - (v / max) * (chartH - pad * 2);
            return <Circle key={j} cx={x} cy={y} r={3} fill={theme.surface} stroke={s.color} strokeWidth={2} />;
          })}
        </G>
      ))}
    </Svg>
  );
}

// ---------- Stacked bars ----------
export function StackedBars({ data, keys, colors, width, height = 170 }) {
  const totals = data.map((d) => keys.reduce((s, k) => s + (d[k] || 0), 0));
  const max = Math.max(...totals, 1);
  const gap = 10;
  const bw = (width - gap * (data.length - 1)) / data.length;
  const chartH = height - 20;
  return (
    <Svg width={width} height={height}>
      {data.map((d, i) => {
        let y = chartH;
        const x = i * (bw + gap);
        return (
          <G key={i}>
            {keys.map((k, ki) => {
              const h = ((d[k] || 0) / max) * chartH;
              y -= h;
              const isTop = ki === keys.length - 1;
              return <Rect key={k} x={x} y={y} width={bw} height={Math.max(h, 0)} rx={isTop ? 4 : 0} fill={colors[ki]} />;
            })}
          </G>
        );
      })}
    </Svg>
  );
}

// ---------- Progress bar (leaderboard) ----------
export function ProgressBar({ percent, color = palette.teal, width = 120, height = 6 }) {
  const { theme } = useTheme();
  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} rx={height / 2} fill={theme.surface2} />
      <Rect x={0} y={0} width={(percent / 100) * width} height={height} rx={height / 2} fill={color} />
    </Svg>
  );
}
