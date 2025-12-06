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
  Dimensions
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { Svg, Polyline, Line, Text as SvgText, Circle } from "react-native-svg";

dayjs.extend(isoWeek);

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  // UI state
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState("All");
  const [sortField, setSortField] = useState("date");
  const [sortDirection, setSortDirection] = useState("DESC");
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [runningTotal, setRunningTotal] = useState(0);

  // Menu / screen state (custom drawer)
  const [showMenu, setShowMenu] = useState(false);
  const [activeScreen, setActiveScreen] = useState("expenses"); // 'expenses' | 'charts'

  // Chart filter modal
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [chartCategory, setChartCategory] = useState("All");

  // Setup table on first render
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

  // Reload expenses when filter or sorting changes
  useEffect(() => {
    loadExpenses();
  }, [filter, sortField, sortDirection]);

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

    const amountNumber = parseFloat(amount);
    try {
      await db.runAsync(
        "INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?)",
        [
          amountNumber,
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
    const amountNumber = parseFloat(amount);

    try {
      await db.runAsync(
        `UPDATE expenses
         SET amount=?, category=?, note=?, date=?
         WHERE id=?`,
        [
          amountNumber,
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

  const renderExpense = ({ item }) => (
    <View style={styles.expenseRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.expenseAmount}>
          ${Number(item.amount).toFixed(2)}
        </Text>
        <Text style={styles.expenseCategory}>{item.category}</Text>
        {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
        {item.date ? <Text style={styles.expenseNote}>Date: {item.date}</Text> : null}
      </View>

      <TouchableOpacity onPress={() => startEditing(item)}>
        <Text style={styles.edit}>✎</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => deleteExpense(item.id)}>
        <Text style={styles.delete}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  // --- Chart data and helpers ---

  // categories (case-normalized for filter UI but display original)
  const categories = useMemo(() => {
    const set = new Map(); // preserve first-seen capitalization
    expenses.forEach((e) => {
      const key = (e.category || "").trim();
      if (!key) return;
      const lower = key.toLowerCase();
      if (!set.has(lower)) set.set(lower, key);
    });
    return ["All", ...Array.from(set.values())];
  }, [expenses]);

  // Group expenses by date (YYYY-MM-DD) and sum amounts, applying chartCategory filter case-insensitively
  const groupedByDate = useMemo(() => {
    const map = {};
    expenses.forEach((e) => {
      if (!e) return;
      if (chartCategory && chartCategory !== "All") {
        // case-insensitive match
        if ((e.category || "").toLowerCase() !== chartCategory.toLowerCase()) return;
      }
      const d = e.date || dayjs().format("YYYY-MM-DD");
      if (!map[d]) map[d] = 0;
      map[d] += Number(e.amount || 0);
    });
    return map; // { "2025-12-01": 34.5 ... }
  }, [expenses, chartCategory]);

  // Sorted dates and values
  const { chartLabels, chartValues } = useMemo(() => {
    const dates = Object.keys(groupedByDate).sort((a, b) => (a > b ? 1 : -1));
    const labels = dates;
    const values = dates.map((d) => Number(groupedByDate[d] || 0));
    return { chartLabels: labels, chartValues: values };
  }, [groupedByDate]);

  // Limit points to the most recent N to avoid too-crowded X-axis
  const MAX_POINTS = 30;
  const compactLabels = chartLabels.slice(-MAX_POINTS);
  const compactValues = chartValues.slice(-MAX_POINTS);

  // Chart geometry
  const screenWidth = Math.min(Dimensions.get("window").width - 32, 720);
  const CHART_W = screenWidth;
  const CHART_H = 200;
  const PAD = 20;

  // convert values to SVG points
  const pointsString = (() => {
    if (compactValues.length === 0) return "";
    const max = Math.max(...compactValues, 10); // avoid division by 0, min scale 10
    const min = Math.min(...compactValues, 0);
    const range = max - min || 1;

    return compactValues
      .map((v, i) => {
        const x =
          PAD + (i / Math.max(1, compactValues.length - 1)) * (CHART_W - PAD * 2);
        const y = PAD + (1 - (v - min) / range) * (CHART_H - PAD * 2);
        return `${x},${y}`;
      })
      .join(" ");
  })();

  // small helper to format x-axis labels (show some labels only to avoid clutter)
  const xLabelIndexes = (() => {
    const n = compactLabels.length;
    if (n <= 6) return compactLabels.map((_, i) => i);
    // choose up to 6 evenly spaced indices
    const step = Math.ceil(n / 6);
    const idxs = [];
    for (let i = 0; i < n; i += step) idxs.push(i);
    if (!idxs.includes(n - 1)) idxs.push(n - 1);
    return idxs;
  })();

  // ----------------- JSX -----------------
  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Hamburger */}
      <TouchableOpacity
        onPress={() => setShowMenu(true)}
        style={styles.hamburger}
      >
        <Text style={{ fontSize: 30, color: "#fff" }}>☰</Text>
      </TouchableOpacity>

      {/* Slide-out menu */}
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
                // quick action: clear form
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

      {/* Expense Screen */}
      {activeScreen === "expenses" ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
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

          <FlatList
            data={expenses}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderExpense}
            ListEmptyComponent={<Text style={styles.empty}>No expenses yet.</Text>}
            style={{ marginBottom: 8 }}
            contentContainerStyle={{ paddingBottom: 120 }}
          />

          {/* Running Total */}
          <Text style={styles.totalDisplay}>
            Total: ${runningTotal.toFixed(2)}
          </Text>
        </ScrollView>
      ) : (
        /* Charts Screen */
        <View style={{ flex: 1 }}>
          <Text style={[styles.heading, { marginTop: 16 }]}>Expense Trend</Text>

          {/* Category filter button */}
          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setCategoryModalVisible(true)}
            >
              <Text style={{ color: "#fff" }}>
                Category: {chartCategory}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Category modal */}
          <Modal
            visible={categoryModalVisible}
            transparent
            animationType="fade"
          >
            <TouchableOpacity
              style={styles.dropdownOverlay}
              onPress={() => setCategoryModalVisible(false)}
            >
              <View style={[styles.dropdownMenu, { width: 260 }]}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={styles.dropdownOption}
                    onPress={() => {
                      setChartCategory(c);
                      setCategoryModalVisible(false);
                    }}
                  >
                    <Text style={styles.dropdownText}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View style={{ backgroundColor: "#0b1220", padding: 12, borderRadius: 12 }}>
              {compactValues.length > 0 ? (
                <>
                  <Svg width={CHART_W} height={CHART_H}>
                    {/* X axis */}
                    <Line
                      x1={PAD}
                      y1={CHART_H - PAD}
                      x2={CHART_W - PAD}
                      y2={CHART_H - PAD}
                      stroke="#374151"
                      strokeWidth={1}
                    />
                    {/* Y axis */}
                    <Line
                      x1={PAD}
                      y1={PAD}
                      x2={PAD}
                      y2={CHART_H - PAD}
                      stroke="#374151"
                      strokeWidth={1}
                    />

                    {/* Grid lines & Y labels (3 horizontal lines) */}
                    {(() => {
                      const max = Math.max(...compactValues, 10);
                      const min = Math.min(...compactValues, 0);
                      const stepCount = 3;
                      const range = max - min || 1;
                      return Array.from({ length: stepCount + 1 }).map((_, i) => {
                        const t = i / stepCount;
                        const y = PAD + t * (CHART_H - PAD * 2);
                        const val = (max - t * range).toFixed(2);
                        return (
                          <React.Fragment key={`g${i}`}>
                            <Line
                              x1={PAD}
                              y1={y}
                              x2={CHART_W - PAD}
                              y2={y}
                              stroke="#1f2937"
                              strokeWidth={1}
                            />
                            <SvgText
                              x={4}
                              y={y + 4}
                              fill="#9ca3af"
                              fontSize="10"
                            >
                              {val}
                            </SvgText>
                          </React.Fragment>
                        );
                      });
                    })()}

                    {/* Data polyline */}
                    {pointsString ? (
                      <Polyline
                        points={pointsString}
                        fill="none"
                        stroke="#60a5fa"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    ) : null}

                    {/* Points */}
                    {compactValues.map((v, i) => {
                      const max = Math.max(...compactValues, 10);
                      const min = Math.min(...compactValues, 0);
                      const range = max - min || 1;
                      const x =
                        PAD + (i / Math.max(1, compactValues.length - 1)) * (CHART_W - PAD * 2);
                      const y = PAD + (1 - (v - min) / range) * (CHART_H - PAD * 2);
                      return (
                        <Circle
                          key={`pt-${i}`}
                          cx={x}
                          cy={y}
                          r={3}
                          fill="#fbbf24"
                        />
                      );
                    })}

                    {/* X labels (sparse) */}
                    {xLabelIndexes.map((idx) => {
                      const label = compactLabels[idx];
                      const x =
                        PAD + (idx / Math.max(1, compactLabels.length - 1)) * (CHART_W - PAD * 2);
                      return (
                        <SvgText
                          key={`xl-${idx}`}
                          x={x}
                          y={CHART_H - PAD + 14}
                          fontSize="10"
                          fill="#9ca3af"
                          textAnchor="middle"
                        >
                          {label}
                        </SvgText>
                      );
                    })}
                  </Svg>

                  {/* Small legend & summary */}
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ color: "#e5e7eb", fontSize: 14 }}>
                      Showing {compactLabels.length} points • Total: ${compactValues.reduce((s, n) => s + n, 0).toFixed(2)}
                    </Text>
                    <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 6 }}>
                      Filter: {chartCategory}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={{ color: "#9ca3af", padding: 12 }}>
                  No data for selected category / date range.
                </Text>
              )}
            </View>
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------------- Styles ----------------
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
});