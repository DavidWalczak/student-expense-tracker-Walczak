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
  Switch,
  Animated,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { LineChart } from "react-native-chart-kit";
import DateTimePicker from "@react-native-community/datetimepicker";

dayjs.extend(isoWeek);

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  // ---------- State ----------
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [editingId, setEditingId] = useState(null);
  const [lastAddedId, setLastAddedId] = useState(null);

  const [filter, setFilter] = useState("All");
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("DESC");

  const [runningTotal, setRunningTotal] = useState(0);
  const [activeScreen, setActiveScreen] = useState("form");

  // Theme & Settings
  const [darkMode, setDarkMode] = useState(true);
  const [currency, setCurrency] = useState("$");
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Chart state
  const [chartMultiselectModalVisible, setChartMultiselectModalVisible] = useState(false);
  const [chartSelectedCategories, setChartSelectedCategories] = useState(new Set());
  const [chartDaysWindow, setChartDaysWindow] = useState(30);
  const [timeDropdownVisible, setTimeDropdownVisible] = useState(false);
  const [chartTouchedX, setChartTouchedX] = useState(null);
  const [chartTouchedValue, setChartTouchedValue] = useState(null);

  // Animations
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(Dimensions.get("window").width));

  const timeOptions = [7, 30, 90, 180, 360];
  const currencies = ["$", "€", "£", "¥"];

  // Screen dimensions
  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;
  const isSmallScreen = screenWidth < 480;

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

  useEffect(() => {
    animateScreenTransition();
  }, [activeScreen]);

  const animateScreenTransition = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: Dimensions.get("window").width, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  };

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
    return true;
  };

  const resetForm = () => {
    setAmount("");
    setCategory("");
    setNote("");
    setDate(dayjs().format("YYYY-MM-DD"));
    setEditingId(null);
    setLastAddedId(null);
  };

  const addExpense = async () => {
    if (!validateInputs()) return;

    try {
      const result = await db.runAsync(
        "INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?)",
        [parseFloat(amount), category.trim(), note.trim() || null, date]
      );
      setLastAddedId(result.lastInsertRowId);
      resetForm();
      loadExpenses();
      animateListItem();
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
        `UPDATE expenses SET amount=?, category=?, note=?, date=? WHERE id=?`,
        [parseFloat(amount), category.trim(), note.trim() || null, date, editingId]
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

  const animateListItem = () => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  };

  // ---------- Date Picker ----------
  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDate(dayjs(selectedDate).format("YYYY-MM-DD"));
    }
  };

// ---------- List helpers ----------
  const renderExpense = ({ item, index }) => {
    const isNewest = item.id === lastAddedId;

    // dynamic colors for light/dark mode
    const expenseAmountColor = darkMode ? "#fbbf24" : "#b45309";
    const expenseCategoryColor = darkMode ? "#e5e7eb" : "#374151";
    const expenseNoteColor = darkMode ? "#9ca3af" : "#6b7280";
    const newestBg = darkMode ? "#1f4a3d" : "#e6ffef";
    const newestBorder = darkMode ? "#10b981" : "#059669";

    return (
      <Animated.View style={[{ opacity: fadeAnim }]}>
        <View style={[styles.expenseRow, isNewest && { backgroundColor: newestBg, borderLeftWidth: 4, borderLeftColor: newestBorder }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.expenseAmount, { color: expenseAmountColor }]}>
              {currency}{Number(item.amount).toFixed(2)}
            </Text>
            <Text style={[styles.expenseCategory, { color: expenseCategoryColor }]}>{item.category}</Text>
            {item.note ? <Text style={[styles.expenseNote, { color: expenseNoteColor }]}>{item.note}</Text> : null}
            {item.date ? <Text style={[styles.expenseNote, { color: expenseNoteColor }]}>Date: {item.date}</Text> : null}
          </View>
          <TouchableOpacity onPress={() => startEditing(item)} style={{ marginRight: 12 }}>
            <Text style={styles.edit}>✎</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteExpense(item.id)}>
            <Text style={styles.delete}>✕</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

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
    const selected =
      chartSelectedCategories.size > 0 ? new Set(Array.from(chartSelectedCategories).map((s) => s.toLowerCase())) : null;
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

    // only daily aggregation now
    for (let i = 0; i < chartDaysWindow; i++) {
      const d = start.add(i, "day").format("YYYY-MM-DD");
      labels.push(d);
      values.push(Number(map[d] || 0));
    }

    return { labels, values };
  }, [expenses, chartSelectedCategories, chartDaysWindow]);

  const chartConfig = {
    backgroundGradientFrom: darkMode ? "#0f1724" : "#ffffff",
    backgroundGradientTo: darkMode ? "#0b1220" : "#f3f4f6",
    decimalPlaces: 2,
    color: (opacity = 1) => (darkMode ? `rgba(96,165,250, ${opacity})` : `rgba(59,130,246, ${opacity})`),
    labelColor: (opacity = 1) => (darkMode ? `rgba(156,163,175, ${opacity})` : `rgba(75,85,99, ${opacity})`),
    propsForDots: { r: "3", strokeWidth: "0" },
  };

  const chartValues = dailyTotals.values;
  const chartWidth = Math.min(screenWidth - 32, 960);

  // ---------- Dashboard: Chart + List ----------
  const renderDashboard = () => {
    const maxLabels = isSmallScreen ? 4 : 8;
    const step = Math.ceil(dailyTotals.labels.length / maxLabels);
    const thinnedLabels = dailyTotals.labels.map((lbl, idx) => (idx % step === 0 ? dayjs(lbl).format("MM-DD") : ""));

    return (
      <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        <View style={{ flex: 1 }}>
          {/* Chart */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <LineChart
              data={{ labels: thinnedLabels, datasets: [{ data: chartValues }] }}
              width={chartWidth}
              height={isSmallScreen ? 200 : 250}
              yAxisLabel={currency}
              chartConfig={chartConfig}
              fromZero
              style={{ borderRadius: 12 }}
              onDataPointClick={({ index, value }) => {
                setChartTouchedX(index);
                setChartTouchedValue(value);
              }}
            />
            {chartTouchedValue !== null && (
              <Text style={{ color: "#60a5fa", fontSize: 12, marginTop: 4, textAlign: "center" }}>
                {dailyTotals.labels[chartTouchedX]}: {currency}{chartTouchedValue.toFixed(2)}
              </Text>
            )}
            <Text style={{ color: darkMode ? "#e5e7eb" : "#374151", fontSize: 14, marginTop: 8 }}>
              Total in chart: {currency}{chartValues.reduce((s, n) => s + n, 0).toFixed(2)}
            </Text>
          </View>

          {/* Filters */}
          <View style={[styles.filterContainer, isSmallScreen && { flexWrap: "wrap" }]}>
            <TouchableOpacity
              style={[
                styles.dropdownButton,
                { backgroundColor: darkMode ? "#0f1724" : "#ffffff", borderColor: darkMode ? "#1f2937" : "#d1d5db" },
              ]}
              onPress={() => setChartMultiselectModalVisible(true)}
            >
              <Text style={{ color: darkMode ? "#fff" : "#000", fontSize: isSmallScreen ? 12 : 14 }}>
                {chartSelectedCategories.size === 0 ? "Categories: All" : `Categories: ${Array.from(chartSelectedCategories).join(", ")}`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dropdownButton,
                { backgroundColor: darkMode ? "#0f1724" : "#ffffff", borderColor: darkMode ? "#1f2937" : "#d1d5db" },
              ]}
              onPress={() => setTimeDropdownVisible(true)}
            >
              <Text style={{ color: darkMode ? "#fff" : "#000", fontSize: isSmallScreen ? 12 : 14 }}>Last {chartDaysWindow} days</Text>
            </TouchableOpacity>
          </View>

          {/* Expense List */}
          <FlatList
            style={{ flex: 1, marginTop: 12 }}
            data={expenses}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderExpense}
            ListEmptyComponent={<Text style={[styles.empty, { color: darkMode ? "#9ca3af" : "#6b7280" }]}>No expenses yet.</Text>}
            contentContainerStyle={{ paddingBottom: 120 }}
          />

          {/* Running total */}
          <Text style={[styles.totalDisplay, { color: darkMode ? "#fbbf24" : "#b45309" }]}>Total: {currency}{runningTotal.toFixed(2)}</Text>
        </View>
      </Animated.View>
    );
  };

  // ---------- Settings Modal ----------
  const renderSettings = () => {
    return (
      <Modal visible={settingsVisible} transparent animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: darkMode ? "#111827" : "#ffffff" }}>
          <View style={{ flex: 1, padding: 16 }}>
            <Text style={[styles.heading, { marginBottom: 20, color: darkMode ? "#fff" : "#000" }]}>Settings</Text>

            {/* Dark Mode */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: darkMode ? "#fff" : "#000" }]}>Dark Mode</Text>
              <Switch value={darkMode} onValueChange={setDarkMode} />
            </View>

            {/* Currency */}
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: darkMode ? "#fff" : "#000" }]}>Currency</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {currencies.map((curr) => (
                  <TouchableOpacity
                    key={curr}
                    onPress={() => setCurrency(curr)}
                    style={[styles.currencyButton, currency === curr && styles.currencyActive, { borderColor: darkMode ? "#1f2937" : "#d1d5db", backgroundColor: currency === curr ? "#60a5fa" : darkMode ? "#0f1724" : "#ffffff" }]}
                  >
                    <Text style={{ color: currency === curr ? "#fff" : darkMode ? "#9ca3af" : "#374151" }}>{curr}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.closeButton} onPress={() => setSettingsVisible(false)}>
              <Text style={{ color: "#fff", fontSize: 16 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  // ---------- Main ----------
  const backgroundColor = darkMode ? "#111827" : "#ffffff";
  const textColor = darkMode ? "#fff" : "#000";

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <View style={[styles.topBar, { backgroundColor: darkMode ? "#111827" : "#f3f4f6" }]}>
        <Text style={[styles.heading, { color: textColor, marginBottom: 0 }]}>Student Expense Tracker</Text>
        <TouchableOpacity onPress={() => setSettingsVisible(true)} style={{ marginLeft: "auto" }}>
          <Text style={{ fontSize: 24 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={[styles.tabContainer, { backgroundColor: darkMode ? "#0f1724" : "#f9fafb" }]}>
        {["form", "dashboard"].map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeScreen === tab && styles.tabActive]} onPress={() => setActiveScreen(tab)}>
            <Text style={{ color: activeScreen === tab ? "#60a5fa" : textColor, fontWeight: "600", fontSize: isSmallScreen ? 12 : 14 }}>
              {tab === "form" ? "Add Expense" : "Dashboard"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeScreen === "form" ? (
        <Animated.View style={[{ flex: 1, padding: 16 }, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
          <TextInput
            style={[styles.input, { color: textColor, backgroundColor: darkMode ? "#0f1724" : "#ffffff", borderColor: darkMode ? "#1f2937" : "#d1d5db" }]}
            placeholder="Amount"
            placeholderTextColor={darkMode ? "#9ca3af" : "#9ca3af"}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />
          <TextInput
            style={[styles.input, { color: textColor, backgroundColor: darkMode ? "#0f1724" : "#ffffff", borderColor: darkMode ? "#1f2937" : "#d1d5db" }]}
            placeholder="Category"
            placeholderTextColor={darkMode ? "#9ca3af" : "#9ca3af"}
            value={category}
            onChangeText={setCategory}
          />
          <TextInput
            style={[styles.input, { color: textColor, backgroundColor: darkMode ? "#0f1724" : "#ffffff", borderColor: darkMode ? "#1f2937" : "#d1d5db" }]}
            placeholder="Note"
            placeholderTextColor={darkMode ? "#9ca3af" : "#9ca3af"}
            value={note}
            onChangeText={setNote}
          />

          {/* Native Date Picker */}
          <TouchableOpacity style={[styles.dateButton, { backgroundColor: darkMode ? "#0f1724" : "#ffffff", borderColor: darkMode ? "#1f2937" : "#d1d5db" }]} onPress={() => setShowDatePicker(true)}>
            <Text style={{ color: textColor }}>{date}</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker value={dayjs(date).toDate()} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} onChange={handleDateChange} />
          )}

          {Platform.OS === "ios" && showDatePicker && (
            <TouchableOpacity style={styles.datePickerDone} onPress={() => setShowDatePicker(false)}>
              <Text style={{ color: "#fff" }}>Done</Text>
            </TouchableOpacity>
          )}

          <Button title={editingId ? "Save Changes" : "Add Expense"} onPress={editingId ? editExpense : addExpense} color="#60a5fa" />
            
          </Animated.View>
        ) : (
          renderDashboard()
        )}

        {/* Category Multiselect Modal */}
      <Modal visible={chartMultiselectModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setChartMultiselectModalVisible(false)}>
          <View style={[styles.dropdownMenu, { backgroundColor: darkMode ? "#0f1724" : "#ffffff", width: isSmallScreen ? 280 : 320 }]}>
            <Text style={{ color: textColor, marginBottom: 8, fontWeight: "700" }}>Select categories</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  const setAll = new Set();
                  categories.forEach((c) => {
                    if (c !== "All") setAll.add(c.toLowerCase());
                  });
                  setChartSelectedCategories(setAll);
                }}
              >
                <Text style={{ color: "#60a5fa" }}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setChartSelectedCategories(new Set())}>
                <Text style={{ color: "#f87171" }}>Clear</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={categories.filter((c) => c !== "All")}
              keyExtractor={(item) => item}
              style={{ maxHeight: isSmallScreen ? 200 : 260 }}
              renderItem={({ item: c }) => {
                const key = c.toLowerCase();
                const checked = chartSelectedCategories.has(key);
                return (
                  <TouchableOpacity
                    key={c}
                    style={styles.checkboxRow}
                    onPress={() => {
                      const next = new Set(chartSelectedCategories);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      setChartSelectedCategories(next);
                    }}
                  >
                    <View style={[styles.checkbox, { borderColor: darkMode ? "#374151" : "#9ca3af", backgroundColor: checked ? undefined : (darkMode ? "#0f1724" : "#ffffff") }, checked && styles.checkboxChecked]}>
                      {checked && <Text style={[styles.checkboxTick, { color: darkMode ? "#0b1117" : "#0b1117" }]}>✓</Text>}
                    </View>
                    <Text style={{ color: textColor, marginLeft: 8 }}>{c}</Text>
                  </TouchableOpacity>
                );
              }}
            />
            <View style={{ marginTop: 12 }}>
              <Button title="Done" onPress={() => setChartMultiselectModalVisible(false)} color="#60a5fa" />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Time Dropdown Modal */}
      <Modal visible={timeDropdownVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setTimeDropdownVisible(false)}>
          <View style={[styles.dropdownMenu, { backgroundColor: darkMode ? "#0f1724" : "#ffffff", width: 180 }]}>
            {timeOptions.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles.dropdownOption}
                onPress={() => {
                  setChartDaysWindow(opt);
                  setTimeDropdownVisible(false);
                }}
              >
                <Text style={[styles.dropdownText, { color: darkMode ? "#fff" : "#000" }]}>{opt} days</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {renderSettings()}
    </SafeAreaView>
  );
}

// ----------- Styles -----------
const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingTop: Platform.OS === "ios" ? 12 : 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heading: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  tabContainer: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#60a5fa" },
  input: { padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
  dateButton: { padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 8, justifyContent: "center" },
  datePickerDone: { backgroundColor: "#60a5fa", padding: 12, borderRadius: 8, marginBottom: 8, alignItems: "center" },
  expenseRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 8, marginHorizontal: 16, marginBottom: 8 },
  newestExpense: { /* replaced by inline dynamic styles */ },
  expenseAmount: { fontSize: 18, fontWeight: "700" },
  expenseCategory: { fontSize: 14 },
  expenseNote: { fontSize: 12 },
  edit: { color: "#60a5fa", fontSize: 20, marginLeft: 12 },
  delete: { color: "#f87171", fontSize: 20, marginLeft: 12 },
  empty: { marginTop: 24, textAlign: "center" },
  filterContainer: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 12, gap: 8 },
  dropdownButton: { padding: 10, borderRadius: 8, borderWidth: 1, flex: 1 },
  aggregationButton: { padding: 6, borderRadius: 6, flex: 1, alignItems: "center" },
  aggregationActive: { backgroundColor: "#60a5fa" },
  dropdownOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)" },
  dropdownMenu: { borderRadius: 10, padding: 10, borderWidth: 1 },
  dropdownOption: { padding: 10 },
  dropdownText: { fontSize: 16 },
  totalDisplay: { fontSize: 18, fontWeight: "700", textAlign: "center", marginVertical: 12 },
  checkboxRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 3, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  checkboxChecked: { backgroundColor: "#60a5fa", borderColor: "#60a5fa" },
  checkboxTick: { fontWeight: "700", fontSize: 12 },
  settingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1 },
  settingLabel: { fontSize: 16, fontWeight: "600" },
  currencyButton: { padding: 8, borderRadius: 6, borderWidth: 1 },
  currencyActive: { backgroundColor: "#60a5fa", borderColor: "#60a5fa" },
  closeButton: { marginTop: 20, padding: 12, backgroundColor: "#60a5fa", borderRadius: 8, alignItems: "center" },
});