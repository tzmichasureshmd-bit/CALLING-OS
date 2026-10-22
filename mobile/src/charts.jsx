import { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";
import Svg, {
  Circle, Path, Rect, Line, G, Defs, LinearGradient as SvgGradient, Stop,
} from "react-native-svg";
import { palette, useTheme } from "./theme";

// ── Animated SVG circle (for RadialRing) ─────────────────────────────────────
// react-native-svg doesn't support Animated natively, so we drive via state
import { useState } from "react";

// ── RadialRing — animated draw from 0 to percent ─────────────────────────────
export function RadialRing({ percent = 68, size = 110, stroke = 11, label = "Connected" }) {
  const { theme } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [animPct, setAnimPct] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: percent,
      duration: 900,
      useNativeDriver: false,
      easing: Easing.out(Easing.cubic),
    }).start();
    const id = anim.addListener(({ value }) => setAnimPct(value));
    return () => anim.removeListener(id);
  }, [percent]);

  const dash = (animPct / 100) * c;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.teal} />
            <Stop offset="1" stopColor={palette.violet} />
          </SvgGradient>
        </Defs>
        {/* Track */}
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.surface2} strokeWidth={stroke} fill="none" />
        {/* Animated fill */}
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="url(#ringGrad)" strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: theme.primary }}>{Math.round(animPct)}%</Text>
        <Text style={{ fontSize: 10, color: theme.muted, marginTop: 1 }}>{label}</Text>
      </View>
    </View>
  );
}

// ── Sparkline — fixed stable gradient ID ─────────────────────────────────────
let _sparkId = 0;
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

export function Sparkline({ data, color = palette.teal, width = 120, height = 40 }) {
  const idRef = useRef(`sp_${++_sparkId}`);
  const id = idRef.current;
  const d = buildLinePath(data, width, height);
  const areaD = `${d} L${width - 4},${height - 4} L4,${height - 4} Z`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.28" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Path d={areaD} fill={`url(#${id})`} />
      <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// ── MiniBars ──────────────────────────────────────────────────────────────────
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

// ── Animated progress bar ─────────────────────────────────────────────────────
export function ProgressBar({ percent, color = palette.teal, width = 120, height = 6 }) {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: percent,
      duration: 700,
      useNativeDriver: false,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [percent]);

  const barWidth = anim.interpolate({ inputRange: [0, 100], outputRange: [0, width] });

  return (
    <View style={{ width, height, borderRadius: height / 2, backgroundColor: theme.surface2, overflow: "hidden" }}>
      <Animated.View style={{ width: barWidth, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

// ── Animated bar chart (7-day activity) ──────────────────────────────────────
export function AnimatedBars({ data, width, height = 56 }) {
  const { theme } = useTheme();
  const anims = useRef(data.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    anims.forEach(a => a.setValue(0));
    Animated.stagger(60, anims.map((a, i) =>
      Animated.timing(a, {
        toValue: 1,
        duration: 500,
        delay: i * 30,
        useNativeDriver: false,
        easing: Easing.out(Easing.back(1.2)),
      })
    )).start();
  }, [JSON.stringify(data.map(d => d.total))]);

  const maxTotal = Math.max(...data.map(x => x.total), 1);
  const barW = (width - (data.length - 1) * 6) / data.length;

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height }}>
      {data.map((d, i) => {
        const targetH = Math.max((d.total / maxTotal) * (height - 20), d.total > 0 ? 4 : 2);
        const isToday = i === data.length - 1;
        const barH = anims[i].interpolate({ inputRange: [0, 1], outputRange: [2, targetH] });
        return (
          <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <Animated.View style={{
              width: "100%", height: barH, borderRadius: 4,
              backgroundColor: isToday ? palette.teal : palette.teal + "44",
            }} />
            <Text style={{ fontSize: 9.5, color: isToday ? palette.teal : theme.dim, fontWeight: isToday ? "700" : "400" }}>
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Donut ─────────────────────────────────────────────────────────────────────
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

// ── Multi-line chart ──────────────────────────────────────────────────────────
export function LineChart({ series, width, height = 170 }) {
  const { theme } = useTheme();
  const pad = 8;
  const all = series.flatMap(s => s.data);
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

// ── Stacked bars ──────────────────────────────────────────────────────────────
export function StackedBars({ data, keys, colors, width, height = 170 }) {
  const totals = data.map(d => keys.reduce((s, k) => s + (d[k] || 0), 0));
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
