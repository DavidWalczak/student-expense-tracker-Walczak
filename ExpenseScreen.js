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
  ScrollView,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { LineChart } from "react-native-chart-kit";

dayjs.extend(isoWeek);

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  // ---------- State: core ----------
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [editingId, setEditingId] = useState(null);

  // filters & sorting (for expense list)
  const [filter, setFilter] = useState("All");
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("DESC");
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const [runningTotal, setRunningTotal] = useState(0);

  // menu & screen selection
  const [showMenu, setShowMenu] = useState(false);
  const [activeScreen, setActiveScreen] = useState("expenses"); // 'expenses' | 'charts'

  // Chart-specific state
  // NOTE: chartSelected is a Set of lowercase category keys
  const [chartMultiselectModalVisible, setChartMultiselectModalVisible] = useState(false);
  const [chartSelectedCategories, setChartSelectedCategories] = useState(new Set());
  const [chartShowAllToggle, setChartShowAllToggle] = useState(true); // helper for UI select all / none

  // Chart display window
  const [chartDaysWindow, setChartDaysWindow] = useState(30); // show up to last 30 days by default

  // ---------- Database setup & loading ----------
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

  // Reset chart filters when leaving chart screen
  useEffect(() => {
    if (activeScreen !== "charts") {
      // reset chart selections
      setChartSelectedCategories(new Set());
      setChartShowAllToggle(true);
      setChartMultiselectModalVisible(false);
    }
  }, [activeScreen]);

  const loadExpenses = async () => {
    try {
      const rows = (await db.getAllAsync("SELECT * FROM expenses;")) || [];

      // Apply date filter (This Week / This Month)
      const filtered = rows.filter((exp) => {
        if (!exp.date) return true;
        const expDate = dayjs(exp.date);
        const today = dayjs();

        if (filter === "This Week") {
          return (
            expDate.isoWeek() === today.isoWeek() &&
            expDate.year() === today.year()
          );
        } else if (filter === "This Month") {
          return (
            expDate.month() === today.month() && expDate.year() === today.year()
          );
        }
        return true;
      });

      // Apply sorting
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

      // Calculate running total
      const total = filtered.reduce(
        (sum, exp) => sum + parseFloat(exp.amount || 0),
        0
      );
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
        [
          parseFloat(amount),
          category.trim(),
          note.trim() || null,
          date || dayjs().format("YYYY-MM-DD"),
        ]
      );
      resetForm();
      loadExpenses();
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
  };

  const editExpense = async () => {
    if (!validateInputs()) return;

    try {
      await db.runAsync(
        `UPDATE expenses
         SET amount=?, category=?, note=?, date=?
         WHERE id=?`,
        [
          parseFloat(amount),
          category.trim(),
          note.trim() || null,
          date || dayjs().format("YYYY-MM-DD"),
          editingId,
        ]
      );
      resetForm();
      loadExpenses();
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

  // ---------- Render item ----------
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
  // categories extracted from current DB expenses (preserve original capitalization by taking first-seen)
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

  // Build daily totals for chart, considering only selected categories (case-insensitive).
  // If chartSelectedCategories is empty => show all categories.
  const dailyTotals = useMemo(() => {
    const map = {}; // date -> total
    const selected = chartSelectedCategories && chartSelectedCategories.size > 0
      ? new Set(Array.from(chartSelectedCategories).map((s) => s.toLowerCase()))
      : null; // null means all

    expenses.forEach((e) => {
      if (!e) return;
      const cat = (e.category || "").toLowerCase();
      if (selected && !selected.has(cat)) return;

      const d = e.date || dayjs().format("YYYY-MM-DD");
      if (!map[d]) map[d] = 0;
      map[d] += Number(e.amount || 0);
    });

    // convert to sorted array of {date, total} for the last chartDaysWindow days
    const allDates = Object.keys(map).sort((a, b) => (a > b ? 1 : -1));
    // If there are no dates, return empty arrays
    if (allDates.length === 0) return { labels: [], values: [] };

    // Option: ensure continuous dates for last N days even if zero (so chart x-axis covers consistent window)
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

  // Chart display conversion
  const chartLabels = dailyTotals.labels.map((d) => {
    // show MM-DD for labels to avoid long text
    return dayjs(d).format("MM-DD");
  });
  const chartValues = dailyTotals.values;

  // chart size
  const screenWidth = Math.min(Dimensions.get("window").width - 32, 960);
  const chartConfig = {
    backgroundGradientFrom: "#0f1724",
    backgroundGradientTo: "#0b1220",
    decimalPlaces: 2,
    color: (opacity = 1) => `rgba(96,165,250, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(156,163,175, ${opacity})`,
    propsForDots: {
      r: "3",
      strokeWidth: "0",
    },
  };

  // ---------- Multiselect handlers (checkbox modal) ----------
  const toggleCategorySelection = (catOriginal) => {
    // catOriginal is original-case; convert to lower for key
    const key = (catOriginal || "").toLowerCase();
    setChartSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setChartShowAllToggle(false);
      return next;
    });
  };

  const selectAllCategories = () => {
    // select all (except the 'All' label)
    const setAll = new Set();
    categories.forEach((c) => {
      if (c === "All") return;
      setAll.add(c.toLowerCase());
    });
    setChartSelectedCategories(setAll);
    setChartShowAllToggle(true);
  };

  const clearCategorySelection = () => {
    setChartSelectedCategories(new Set());
    setChartShowAllToggle(false);
  };

  // ---------- UI ----------

  return (
    <SafeAreaView style={styles.container}>
      {/* Hamburger Button */}
      <TouchableOpacity
        onPress={() => setShowMenu(true)}
        style={styles.hamburger}
      >
        <Text style={{ fontSize: 30, color: "#fff" }}>☰</Text>
      </TouchableOpacity>

      {/* Slide-out Menu Modal */}
      <Modal visible={showMenu} transparent animationType="fade">
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>Menu</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setActiveScreen("expenses");
                setShowMenu(false);
              }}
            >
              <Text style={styles.menuItemText}>Expenses</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setActiveScreen("charts");
                setShowMenu(false);
              }}
            >
              <Text style={styles.menuItemText}>Charts</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { marginTop: 20 }]}
              onPress={() => {
                resetForm();
                setShowMenu(false);
              }}
            >
              <Text style={[styles.menuItemText, { color: "#fbbf24" }]}>
                Clear Form
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ---------- Expenses Screen (no ScrollView wrapper around FlatList) ---------- */}
      {activeScreen === "expenses" ? (
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Student Expense Tracker</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Amount (e.g. 12.50)"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <TextInput
              style={styles.input}
              placeholder="Category (Food, Books, Rent...)"
              placeholderTextColor="#9ca3af"
              value={category}
              onChangeText={setCategory}
            />
            <TextInput
              style={styles.input}
              placeholder="Note (optional)"
              placeholderTextColor="#9ca3af"
              value={note}
              onChangeText={setNote}
            />
            <TextInput
              style={styles.input}
              placeholder="Date (YYYY-MM-DD)"
              placeholderTextColor="#9ca3af"
              value={date}
              onChangeText={setDate}
            />

            <Button
              title={editingId ? "Save Changes" : "Add Expense"}
              onPress={editingId ? editExpense : addExpense}
            />
          </View>

          {/* Filters */}
          <View style={styles.filterRow}>
            {["All", "This Week", "This Month"].map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.filterButton, filter === f && styles.filterActive]}
              >
                <Text style={{ color: "#fff" }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sort Dropdown */}
          <View style={{ marginBottom: 12 }}>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setDropdownVisible(true)}
            >
              <Text style={{ color: "#fff" }}>
                Sort by: {sortField} ({sortDirection})
              </Text>
            </TouchableOpacity>

            <Modal transparent visible={dropdownVisible} animationType="fade">
              <TouchableOpacity
                style={styles.dropdownOverlay}
                onPress={() => setDropdownVisible(false)}
              >
                <View style={styles.dropdownMenu}>
                  {["date", "amount", "category"].map((field) => (
                    <TouchableOpacity
                      key={field}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setSortField(field);
                        setDropdownVisible(false);
                      }}
                    >
                      <Text style={styles.dropdownText}>{field}</Text>
                    </TouchableOpacity>
                  ))}

                  <View style={{ height: 1, backgroundColor: "#555", marginVertical: 8 }} />

                  {["ASC", "DESC"].map((dir) => (
                    <TouchableOpacity
                      key={dir}
                      style={styles.dropdownOption}
                      onPress={() => {
                        setSortDirection(dir);
                        setDropdownVisible(false);
                      }}
                    >
                      <Text style={styles.dropdownText}>{dir}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </TouchableOpacity>
            </Modal>
          </View>

          {/* FlatList (scrollable) */}
          <FlatList
            data={expenses}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderExpense}
            ListEmptyComponent={<Text style={styles.empty}>No expenses yet.</Text>}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 120, paddingTop: 12 }}
          />

          {/* Running Total */}
          <Text style={styles.totalDisplay}>
            Total: ${runningTotal.toFixed(2)}
          </Text>
        </View>
      ) : (
        /* ---------- Charts Screen (full implementation - Option B1) ---------- */
        <View style={{ flex: 1 }}>
          <Text style={[styles.heading, { marginTop: 16 }]}>Expense Trend (Daily Totals)</Text>

          {/* Chart multi-select button */}
          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setChartMultiselectModalVisible(true)}
            >
              <Text style={{ color: "#fff" }}>
                {chartSelectedCategories.size === 0 ? "Categories: All" : `Categories: ${Array.from(chartSelectedCategories).join(", ")}`}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Multiselect modal */}
          <Modal
            visible={chartMultiselectModalVisible}
            transparent
            animationType="fade"
          >
            <TouchableOpacity
              style={styles.dropdownOverlay}
              onPress={() => setChartMultiselectModalVisible(false)}
            >
              <View style={[styles.dropdownMenu, { width: 320, maxHeight: 360 }]}>
                <Text style={{ color: "#fff", marginBottom: 8, fontWeight: "700" }}>Select categories</Text>

                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <TouchableOpacity onPress={selectAllCategories}>
                    <Text style={{ color: "#60a5fa" }}>Select All</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={clearCategorySelection}>
                    <Text style={{ color: "#f87171" }}>Clear</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: 260 }}>
                  {categories.filter(c => c !== "All").map((c) => {
                    const key = c.toLowerCase();
                    const checked = chartSelectedCategories.has(key);
                    return (
                      <TouchableOpacity
                        key={c}
                        style={styles.checkboxRow}
                        onPress={() => toggleCategorySelection(c)}
                      >
                        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                          {checked && <Text style={styles.checkboxTick}>✓</Text>}
                        </View>
                        <Text style={{ color: "#fff", marginLeft: 8 }}>{c}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={{ marginTop: 12 }}>
                  <Button title="Done" onPress={() => setChartMultiselectModalVisible(false)} />
                </View>
              </View>
            </TouchableOpacity>
          </Modal>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View style={{ backgroundColor: "#0b1220", padding: 12, borderRadius: 12 }}>
              {chartValues && chartValues.length > 0 ? (
                <>
                  <LineChart
                    data={{
                      labels: chartLabels,
                      datasets: [{ data: chartValues }],
                    }}
                    width={Math.min(Dimensions.get("window").width - 32, 960)}
                    height={300}
                    yAxisLabel="$"
                    chartConfig={chartConfig}
                    bezier
                    style={{ borderRadius: 12 }}
                    fromZero
                  />

                  <View style={{ marginTop: 10 }}>
                    <Text style={{ color: "#e5e7eb", fontSize: 14 }}>
                      Showing last {chartDaysWindow} days • Total: ${chartValues.reduce((s, n) => s + n, 0).toFixed(2)}
                    </Text>
                    <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 6 }}>
                      Filter: {chartSelectedCategories.size === 0 ? "All categories" : Array.from(chartSelectedCategories).join(", ")}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={{ color: "#9ca3af", padding: 12 }}>No data for selected categories / date range.</Text>
              )}
            </View>
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

//----------- Styles -----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1117" },

  hamburger: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 99,
    padding: 6,
  },

  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-start",
  },

  menu: {
    width: 260,
    padding: 20,
    backgroundColor: "#111827",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: 40,
  },

  menuTitle: { color: "#fff", fontSize: 20, marginBottom: 10 },
  menuItem: { paddingVertical: 10 },
  menuItemText: { color: "#fff", fontSize: 16 },

  heading: { fontSize: 22, fontWeight: "700", color: "#fff", marginTop: 56, marginBottom: 12, paddingHorizontal: 16 },

  form: { marginBottom: 16, gap: 8, paddingHorizontal: 16 },
  input: {
    padding: 10,
    backgroundColor: "#0f1724",
    color: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 8,
  },

  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f1724",
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },

  expenseAmount: { fontSize: 18, fontWeight: "700", color: "#fbbf24" },
  expenseCategory: { fontSize: 14, color: "#e5e7eb" },
  expenseNote: { fontSize: 12, color: "#9ca3af" },
  edit: { color: "#60a5fa", fontSize: 20, marginLeft: 12 },
  delete: { color: "#f87171", fontSize: 20, marginLeft: 12 },
  empty: { color: "#9ca3af", marginTop: 24, textAlign: "center" },

  filterRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 12,
    paddingHorizontal: 8,
  },

  filterButton: {
    padding: 8,
    backgroundColor: "#1f2937",
    borderRadius: 8,
  },
  filterActive: { backgroundColor: "#60a5fa" },

  dropdownButton: {
    padding: 10,
    backgroundColor: "#0f1724",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginHorizontal: 16,
  },

  dropdownOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },

  dropdownMenu: {
    width: 220,
    backgroundColor: "#0f1724",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  dropdownOption: { padding: 10 },
  dropdownText: { color: "#fff", fontSize: 16 },

  totalDisplay: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fbbf24",
    textAlign: "center",
    marginVertical: 12,
  },

  // multiselect checkbox UI
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#374151",
    backgroundColor: "#0f1724",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#60a5fa",
    borderColor: "#60a5fa",
  },
  checkboxTick: {
    color: "#0b1117",
    fontWeight: "700",
    fontSize: 12,
  },
});