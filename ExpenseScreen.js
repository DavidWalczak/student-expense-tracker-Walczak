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
  Alert,
} from "react-native";
import * as SQLite from "expo-sqlite";

// Global database instance
let db;

export default function ExpenseScreen() {
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [runningTotal, setRunningTotal] = useState(0);

  // Open DB asynchronously once
  const initDB = async () => {
    db = await SQLite.openDatabaseAsync("expenses.db");

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        note TEXT,
        date TEXT
      );
    `);
  };

  // Load all expenses
  const loadExpenses = async () => {
    try {
      const rows = await db.getAllAsync(
        "SELECT * FROM expenses ORDER BY id DESC;"
      );

      setExpenses(rows);

      const total = rows.reduce(
        (acc, row) => acc + (parseFloat(row.amount) || 0),
        0
      );
      setRunningTotal(total);
    } catch (e) {
      console.error("loadExpenses error:", e);
    }
  };

  // Input validation
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

  // Add new expense
  const addExpense = async () => {
    if (!validateInputs()) return;

    const amountNumber = parseFloat(amount);

    try {
      await db.runAsync(
        "INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?)",
        [amountNumber, category.trim(), note.trim() || null, date || null]
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

  // Save edit
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
          date || null,
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

  // Delete with confirmation
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

  const resetForm = () => {
    setAmount("");
    setCategory("");
    setNote("");
    setDate("");
    setEditingId(null);
  };

  const renderExpense = ({ item }) => (
    <View style={styles.expenseRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.expenseAmount}>
          ${Number(item.amount).toFixed(2)}
        </Text>
        <Text style={styles.expenseCategory}>{item.category}</Text>
        {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
        {item.date ? (
          <Text style={styles.expenseNote}>Date: {item.date}</Text>
        ) : null}
      </View>

      <TouchableOpacity onPress={() => startEditing(item)}>
        <Text style={styles.edit}>✎</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => deleteExpense(item.id)}>
        <Text style={styles.delete}>✕</Text>
      </TouchableOpacity>
    </View>
  );


  // Run DB setup once
  useEffect(() => {
    (async () => {
      await initDB();
      await loadExpenses();
    })();
  }, []);

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

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpense}
        ListEmptyComponent={
          <Text style={styles.empty}>No expenses yet.</Text>
        }
      />

      <Text style={styles.totalDisplay}>
        Total Spent: ${runningTotal.toFixed(2)}
      </Text>
      <Text style={styles.footer}>Expenses are saved locally with SQLite.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#111827" },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 16,
  },
  form: {
    marginBottom: 16,
    gap: 8,
  },
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
  expenseAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fbbf24",
  },
  expenseCategory: {
    fontSize: 14,
    color: "#e5e7eb",
  },
  expenseNote: {
    fontSize: 12,
    color: "#9ca3af",
  },
  edit: {
    color: "#60a5fa",
    fontSize: 20,
    marginLeft: 12,
  },
  delete: {
    color: "#f87171",
    fontSize: 20,
    marginLeft: 12,
  },
  empty: {
    color: "#9ca3af",
    marginTop: 24,
    textAlign: "center",
  },
  footer: {
    textAlign: "center",
    color: "#6b7280",
    marginTop: 12,
    fontSize: 12,
  },
  totalDisplay: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "700",
    color: "#fbbf24",
    textAlign: "center",
  },
});