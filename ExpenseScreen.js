// ExpenseScreen.js
import React, { useEffect, useState, useMemo } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Dimensions,
  Platform,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { LineChart } from "react-native-chart-kit";

dayjs.extend(isoWeek);

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  // ---------- State ----------
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [filter, setFilter] = useState("All");
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("DESC");

  const [runningTotal, setRunningTotal] = useState(0);
  const [activeScreen, setActiveScreen] = useState("form"); // 'form' | 'dashboard'

  // Chart state
  const [chartMultiselectModalVisible, setChartMultiselectModalVisible] = useState(false);
  const [chartSelectedCategories, setChartSelectedCategories] = useState(new Set());
  const [chartShowAllToggle, setChartShowAllToggle] = useState(true);
  const [chartDaysWindow, setChartDaysWindow] = useState(30);
  const [timeDropdownVisible, setTimeDropdownVisible] = useState(false);

  const timeOptions = [7, 30, 90, 180, 360];

  // ---------- Database ----------
  useEffect(() => {
    async function setup() {
      try {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            note TEXT,
            date TEXT
          );
        `);
        await loadExpenses();
      } catch (e) {
        console.error("DB setup error:", e);
      }
    }
    setup();
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [filter, sortField, sortDirection]);

  const loadExpenses = async () => {
    try {
      const rows = (await db.getAllAsync("SELECT * FROM expenses;")) || [];

      const filtered = rows.filter((exp) => {
        if (!exp.date) return true;
        const expDate = dayjs(exp.date);
        const today = dayjs();
        if (filter === "This Week") {
          return expDate.isoWeek() === today.isoWeek() && expDate.year() === today.year();
        } else if (filter === "This Month") {
          return expDate.month() === today.month() && expDate.year() === today.year();
        }
        return true;
      });

      filtered.sort((a, b) => {
        let x = a[sortField];
        let y = b[sortField];

        if (sortField === "amount") {
          x = parseFloat(x);
          y = parseFloat(y);
        }
        if (sortField === "date") {
          x = x || "";
          y = y || "";
        }

        if (x === y) return 0;
        return sortDirection === "ASC" ? (x > y ? 1 : -1) : x < y ? 1 : -1;
      });

      setExpenses(filtered);
      const total = filtered.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
      setRunningTotal(total);
    } catch (e) {
      console.error("loadExpenses error:", e);
    }
  };

  // ---------- CRUD ----------
  const validateInputs = () => {
    const amountNumber = parseFloat(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid number > 0.");
      return false;
    }
    if (!category.trim()) {
      Alert.alert("Category Required", "Please enter a category.");
      return false;
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert("Invalid Date", "Use YYYY-MM-DD format.");
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setAmount("");
    setCategory("");
    setNote("");
    setDate("");
    setEditingId(null);
  };

  const addExpense = async () => {
    if (!validateInputs()) return;

    try {
      await db.runAsync(
        "INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?)",
        [parseFloat(amount), category.trim(), note.trim() || null, date || dayjs().format("YYYY-MM-DD")]
      );
      resetForm();
      loadExpenses();
      setActiveScreen("dashboard");
    } catch (e) {
      console.error("addExpense error:", e);
      Alert.alert("Database Error", "Could not add expense.");
    }
  };

  const startEditing = (expense) => {
    setEditingId(expense.id);
    setAmount(String(expense.amount));
    setCategory(expense.category);
    setNote(expense.note || "");
    setDate(expense.date || "");
    setActiveScreen("form");
  };

  const editExpense = async () => {
    if (!validateInputs()) return;

    try {
      await db.runAsync(
        `UPDATE expenses
         SET amount=?, category=?, note=?, date=?
         WHERE id=?`,
        [parseFloat(amount), category.trim(), note.trim() || null, date || dayjs().format("YYYY-MM-DD"), editingId]
      );
      resetForm();
      loadExpenses();
      setActiveScreen("dashboard");
    } catch (e) {
      console.error("editExpense error:", e);
      Alert.alert("Database Error", "Could not update expense.");
    }
  };

  const deleteExpense = (id) => {
    Alert.alert("Delete Entry", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await db.runAsync("DELETE FROM expenses WHERE id=?", [id]);
            loadExpenses();
          } catch (e) {
            console.error("deleteExpense error:", e);
            Alert.alert("Database Error", "Could not delete expense.");
          }
        },
      },
    ]);
  };

  // ---------- List helpers ----------
  const renderExpense = ({ item }) => (
    <View style={styles.expenseRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.expenseAmount}>${Number(item.amount).toFixed(2)}</Text>
        <Text style={styles.expenseCategory}>{item.category}</Text>
        {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
        {item.date ? <Text style={styles.expenseNote}>Date: {item.date}</Text> : null}
      </View>
      <TouchableOpacity onPress={() => startEditing(item)} style={{ marginRight: 12 }}>
        <Text style={styles.edit}>✎</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => deleteExpense(item.id)}>
        <Text style={styles.delete}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  // ---------- Chart helpers ----------
  const categories = useMemo(() => {
    const seen = new Map();
    expenses.forEach((e) => {
      const k = (e.category || "").trim();
      if (!k) return;
      const lower = k.toLowerCase();
      if (!seen.has(lower)) seen.set(lower, k);
    });
    return ["All", ...Array.from(seen.values())];
  }, [expenses]);

  const dailyTotals = useMemo(() => {
    const map = {};
    const selected = chartSelectedCategories.size > 0 ? new Set(Array.from(chartSelectedCategories).map((s) => s.toLowerCase())) : null;
    expenses.forEach((e) => {
      if (!e) return;
      const cat = (e.category || "").toLowerCase();
      if (selected && !selected.has(cat)) return;

      const d = e.date || dayjs().format("YYYY-MM-DD");
      if (!map[d]) map[d] = 0;
      map[d] += Number(e.amount || 0);
    });

    const allDates = Object.keys(map).sort((a, b) => (a > b ? 1 : -1));
    if (!allDates.length) return { labels: [], values: [] };

    const end = dayjs(allDates[allDates.length - 1]);
    const start = end.subtract(chartDaysWindow - 1, "day");
    const labels = [];
    const values = [];
    for (let i = 0; i < chartDaysWindow; i++) {
      const d = start.add(i, "day").format("YYYY-MM-DD");
      labels.push(d);
      values.push(Number(map[d] || 0));
    }
    return { labels, values };
  }, [expenses, chartSelectedCategories, chartDaysWindow]);

  const screenWidth = Math.min(Dimensions.get("window").width - 32, 960);
  const chartConfig = {
    backgroundGradientFrom: "#0f1724",
    backgroundGradientTo: "#0b1220",
    decimalPlaces: 2,
    color: (opacity = 1) => `rgba(96,165,250, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(156,163,175, ${opacity})`,
    propsForDots: { r: "3", strokeWidth: "0" },
  };

  const chartValues = dailyTotals.values;

  // ---------- Dashboard: Chart + List ----------
  const renderDashboard = () => {
    const maxLabels = 8; // maximum x-axis labels to display
    const step = Math.ceil(dailyTotals.labels.length / maxLabels);
    const thinnedLabels = dailyTotals.labels.map((lbl, idx) => (idx % step === 0 ? dayjs(lbl).format("MM-DD") : ""));

    return (
      <View style={{ flex: 1 }}>
        {/* Chart */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <LineChart
            data={{ labels: thinnedLabels, datasets: [{ data: chartValues }] }}
            width={Dimensions.get("window").width - 32}
            height={250}
            yAxisLabel="$"
            chartConfig={chartConfig}
            fromZero
            style={{ borderRadius: 12 }}
          />
          <Text style={{ color: "#e5e7eb", fontSize: 14, marginTop: 8 }}>
            Total in chart: ${chartValues.reduce((s, n) => s + n, 0).toFixed(2)}
          </Text>
        </View>

        {/* Filters */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12 }}>
          <TouchableOpacity style={styles.dropdownButton} onPress={() => setChartMultiselectModalVisible(true)}>
            <Text style={{ color: "#fff" }}>
              {chartSelectedCategories.size === 0 ? "Categories: All" : `Categories: ${Array.from(chartSelectedCategories).join(", ")}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownButton} onPress={() => setTimeDropdownVisible(true)}>
            <Text style={{ color: "#fff" }}>Last {chartDaysWindow} days</Text>
          </TouchableOpacity>
        </View>

        {/* Expense List (scrollable only) */}
        <FlatList
          style={{ flex: 1, marginTop: 16 }}
          data={expenses}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderExpense}
          ListEmptyComponent={<Text style={styles.empty}>No expenses yet.</Text>}
          contentContainerStyle={{ paddingBottom: 120 }}
        />

        {/* Running total */}
        <Text style={styles.totalDisplay}>Total: ${runningTotal.toFixed(2)}</Text>
      </View>
    );
  };

  // ---------- Main ----------
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#111827" }}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Student Expense Tracker</Text>
      </View>

      {/* Tab Selector */}
      <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 8 }}>
        {["form", "dashboard"].map((tab) => (
          <TouchableOpacity key={tab} onPress={() => setActiveScreen(tab)}>
            <Text style={{ color: activeScreen === tab ? "#60a5fa" : "#fff", fontWeight: "600" }}>
              {tab === "form" ? "Add Expense" : "Dashboard"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeScreen === "form" ? (
        <View style={{ flex: 1, padding: 16 }}>
          <TextInput style={styles.input} placeholder="Amount" placeholderTextColor="#9ca3af" keyboardType="numeric" value={amount} onChangeText={setAmount} />
          <TextInput style={styles.input} placeholder="Category" placeholderTextColor="#9ca3af" value={category} onChangeText={setCategory} />
          <TextInput style={styles.input} placeholder="Note" placeholderTextColor="#9ca3af" value={note} onChangeText={setNote} />
          <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" placeholderTextColor="#9ca3af" value={date} onChangeText={setDate} />
          <Button title={editingId ? "Save Changes" : "Add Expense"} onPress={editingId ? editExpense : addExpense} />
        </View>
      ) : (
        renderDashboard()
      )}

      {/* Category Multiselect Modal */}
      <Modal visible={chartMultiselectModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setChartMultiselectModalVisible(false)}>
          <View style={[styles.dropdownMenu, { width: 320, maxHeight: 360 }]}>
            <Text style={{ color: "#fff", marginBottom: 8, fontWeight: "700" }}>Select categories</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <TouchableOpacity onPress={() => {
                const setAll = new Set();
                categories.forEach(c => { if(c !== "All") setAll.add(c.toLowerCase()) });
                setChartSelectedCategories(setAll);
                setChartShowAllToggle(true);
              }}>
                <Text style={{ color: "#60a5fa" }}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setChartSelectedCategories(new Set()); setChartShowAllToggle(false); }}>
                <Text style={{ color: "#f87171" }}>Clear</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={categories.filter(c => c !== "All")}
              keyExtractor={(item) => item}
              style={{ maxHeight: 260 }}
              renderItem={({ item: c }) => {
                const key = c.toLowerCase();
                const checked = chartSelectedCategories.has(key);
                return (
                  <TouchableOpacity key={c} style={styles.checkboxRow} onPress={() => {
                    const next = new Set(chartSelectedCategories);
                    if (next.has(key)) next.delete(key); else next.add(key);
                    setChartSelectedCategories(next);
                  }}>
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked && <Text style={styles.checkboxTick}>✓</Text>}</View>
                    <Text style={{ color: "#fff", marginLeft: 8 }}>{c}</Text>
                  </TouchableOpacity>
                );
              }}
            />
            <View style={{ marginTop: 12 }}><Button title="Done" onPress={() => setChartMultiselectModalVisible(false)} /></View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Time Dropdown Modal */}
      <Modal visible={timeDropdownVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setTimeDropdownVisible(false)}>
          <View style={[styles.dropdownMenu, { width: 180 }]}>
            {timeOptions.map(opt => (
              <TouchableOpacity key={opt} style={styles.dropdownOption} onPress={() => { setChartDaysWindow(opt); setTimeDropdownVisible(false); }}>
                <Text style={styles.dropdownText}>{opt} days</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

//----------- Styles -----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1117" },
  hamburger: { fontSize: 28, color: "#fff" },
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-start" },
  menu: { width: 260, padding: 20, backgroundColor: "#111827", borderTopRightRadius: 12, borderBottomRightRadius: 12, marginTop: 40 },
  menuTitle: { color: "#fff", fontSize: 20, marginBottom: 10 },
  menuItem: { paddingVertical: 10 },
  menuItemText: { color: "#fff", fontSize: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 12, paddingHorizontal: 16 },
  form: { marginBottom: 16, gap: 8, paddingHorizontal: 16 },
  input: { padding: 10, backgroundColor: "#0f1724", color: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#1f2937", marginBottom: 8 },
  expenseRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#0f1724", padding: 12, borderRadius: 8, marginHorizontal: 16, marginBottom: 8 },
  topBar: { paddingTop: Platform.OS === "ios" ? 40 : 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#111827", flexDirection: "row", alignItems: "center", gap: 12 },
  expenseAmount: { fontSize: 18, fontWeight: "700", color: "#fbbf24" },
  expenseCategory: { fontSize: 14, color: "#e5e7eb" },
  expenseNote: { fontSize: 12, color: "#9ca3af" },
  edit: { color: "#60a5fa", fontSize: 20, marginLeft: 12 },
  delete: { color: "#f87171", fontSize: 20, marginLeft: 12 },
  empty: { color: "#9ca3af", marginTop: 24, textAlign: "center" },
  filterRow: { flexDirection: "row", justifyContent: "space-around", marginVertical: 12, paddingHorizontal: 8 },
  filterButton: { padding: 8, backgroundColor: "#1f2937", borderRadius: 8 },
  filterActive: { backgroundColor: "#60a5fa" },
  dropdownButton: { padding: 10, backgroundColor: "#0f1724", borderRadius: 8, borderWidth: 1, borderColor: "#1f2937", marginHorizontal: 16 },
  dropdownOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  dropdownMenu: { width: 220, backgroundColor: "#0f1724", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#1f2937" },
  dropdownOption: { padding: 10 },
  dropdownText: { color: "#fff", fontSize: 16 },
  totalDisplay: { fontSize: 18, fontWeight: "700", color: "#fbbf24", textAlign: "center", marginVertical: 12 },
  checkboxRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 3, borderWidth: 1, borderColor: "#374151", backgroundColor: "#0f1724", justifyContent: "center", alignItems: "center" },
  checkboxChecked: { backgroundColor: "#60a5fa", borderColor: "#60a5fa" },
  checkboxTick: { color: "#0b1117", fontWeight: "700", fontSize: 12 },
});
