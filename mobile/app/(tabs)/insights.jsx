import { useState } from "react";
import { View, Text, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { palette, useTheme } from "../../src/theme";
import { AppHeader, Card, RangeChip } from "../../src/components";
import { LineChart, StackedBars, Donut, ProgressBar } from "../../src/charts";
import { INSIGHTS } from "../../src/mockData";

export default function Insights() {
  const [range] = useState("7 Days");
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const w = width - 32 - 32;
  const d = INSIGHTS;

  const Legend = ({ items }) => (
    <View style={{ flexDirection: "row", gap: 16, marginBottom: 8, marginTop: 2 }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: it.color }} />
          <Text style={{ fontSize: 11.5, color: theme.muted }}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
  const Labels = ({ labels }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", width: w, marginTop: 6 }}>
      {labels.map((l) => <Text key={l} style={{ fontSize: 10.5, color: theme.dim }}>{l}</Text>)}
    </View>
  );
  const title = { fontSize: 15, fontWeight: "700", color: theme.primary, marginBottom: 4 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <AppHeader title="Insights" right={<RangeChip label={range} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
        <Card style={{ marginBottom: 14 }}>
          <Text style={title}>Total vs Connected Calls</Text>
          <Legend items={[{ label: "Total", color: palette.violet }, { label: "Connected", color: palette.teal }]} />
          <LineChart width={w} height={170} series={[{ data: d.totalVsConnected.total, color: palette.violet }, { data: d.totalVsConnected.connected, color: palette.teal }]} />
          <Labels labels={d.totalVsConnected.labels} />
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <Text style={title}>Call Outcomes</Text>
          <Legend items={[{ label: "Connected", color: palette.teal }, { label: "Missed", color: palette.red }, { label: "Rejected", color: palette.amber }]} />
          <StackedBars width={w} height={170} data={d.outcomes.data} keys={["connected", "missed", "rejected"]} colors={[palette.teal, palette.red, palette.amber]} />
          <Labels labels={d.outcomes.labels} />
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <Text style={title}>Duration Distribution</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 6 }}>
            <Donut segments={d.duration} size={130} stroke={24} />
            <View style={{ flex: 1, gap: 10 }}>
              {d.duration.map((s) => (
                <View key={s.label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
                    <Text style={{ fontSize: 13, color: theme.secondary }}>{s.label}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: theme.primary }}>{s.value}%</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text style={title}>Top Callers</Text>
            <RangeChip label="7 Days" />
          </View>
          {d.topCallers.map((t, i) => (
            <View key={t.name} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: i === d.topCallers.length - 1 ? 0 : 14 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: theme.dim, width: 16 }}>{i + 1}</Text>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: palette.teal + "22", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: palette.teal }}>{t.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: "600", color: theme.primary }}>{t.name}</Text>
                  <Text style={{ fontSize: 12.5, fontWeight: "700", color: theme.secondary }}>{t.calls} calls</Text>
                </View>
                <ProgressBar percent={t.pct} color={i === 0 ? palette.teal : palette.violet} width={w - 64} height={6} />
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
