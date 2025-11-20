// ExpenseScreen.js
import React, { useEffect, useState } from "react";
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
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

export default function ExpenseScreen() {
  const db = useSQLiteContext();

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

      // Apply date filter
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

        return sortDirection === "ASC" ? (x > y ? 1 : -1) : x < y ? 1 : -1;
      });

      setExpenses(filtered);
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

  return (
    <SafeAreaView style={styles.container}>
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
      <View style={{ flexDirection: "row", justifyContent: "space-around", marginVertical: 12 }}>
        {["All", "This Week", "This Month"].map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.filterButton,
              filter === f && styles.filterActive,
            ]}
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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#111827" },
  heading: { fontSize: 24, fontWeight: "700", color: "#fff", marginBottom: 16 },
  form: { marginBottom: 16, gap: 8 },
  input: {
    padding: 10,
    backgroundColor: "#1f2937",
    color: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
    marginBottom: 8,
  },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expenseAmount: { fontSize: 18, fontWeight: "700", color: "#fbbf24" },
  expenseCategory: { fontSize: 14, color: "#e5e7eb" },
  expenseNote: { fontSize: 12, color: "#9ca3af" },
  edit: { color: "#60a5fa", fontSize: 20, marginLeft: 12 },
  delete: { color: "#f87171", fontSize: 20, marginLeft: 12 },
  empty: { color: "#9ca3af", marginTop: 24, textAlign: "center" },
  filterButton: {
    padding: 8,
    backgroundColor: "#374151",
    borderRadius: 8,
  },
  filterActive: { backgroundColor: "#60a5fa" },
  dropdownButton: {
    padding: 10,
    backgroundColor: "#1f2937",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  dropdownOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  dropdownMenu: {
    width: 200,
    backgroundColor: "#1f2937",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#374151",
  },
  dropdownOption: { padding: 10 },
  dropdownText: { color: "#fff", fontSize: 16 },
});