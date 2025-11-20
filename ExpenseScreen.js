import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [totalSpent, setTotalSpent] = useState(0);

  //======== LOAD EXPENSES ========
  const loadExpenses = async () => {
    const rows = await db.getAllAsync('SELECT * FROM expenses ORDER BY id DESC;');
    setExpenses(rows);
    calculateTotal(rows);
  };

  //======== CALCULATE TOTAL EXPENSES ========
  const calculateTotal = (rows) => {
    const sum = rows.reduce((acc, item) => acc + Number(item.amount), 0);
    setTotalSpent(sum);
  };

  //======== ADD EXPENSE ========
  const addExpense = async () => {
    const amountNumber = parseFloat(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) return;

    const trimmedCategory = category.trim();

    if (!trimmedCategory) return;

    await db.runAsync(
      'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?);',
      [amountNumber, trimmedCategory, note.trim() || null, date || null]
    );

    resetForm();
    loadExpenses();
  };

  //======== DELETE EXPENSE ========
  const deleteExpense = async (id) => {
    await db.runAsync('DELETE FROM expenses WHERE id = ?;', [id]);
    loadExpenses();
  };

  //======== START EDITING ========
  const startEditing = (expense) => {
    setEditingId(expense.id);
    setAmount(String(expense.amount));
    setCategory(expense.category);
    setNote(expense.note || '');
    setDate(expense.date || '');
  };

  //======== SAVE EDIT CHANGES ========
  const editExpense = async () => {
    if (!editingId) return;

    const amountNumber = parseFloat(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) return;

    await db.runAsync(
      `UPDATE expenses 
       SET amount = ?, category = ?, note = ?, date = ?
       WHERE id = ?;`,
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
  };

  //======== RESET FORM ========
  const resetForm = () => {
    setAmount('');
    setCategory('');
    setNote('');
    setDate('');
    setEditingId(null);
  };

  //======== RENDER A ROW ========
  const renderExpense = ({ item }) => (
    <View style={styles.expenseRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.expenseAmount}>${Number(item.amount).toFixed(2)}</Text>
        <Text style={styles.expenseCategory}>{item.category}</Text>
        {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
        {item.date ? <Text style={styles.expenseNote}>Date: {item.date}</Text> : null}
      </View>

      {/* Edit Button */}
      <TouchableOpacity onPress={() => startEditing(item)}>
        <Text style={styles.edit}>✎</Text>
      </TouchableOpacity>

      {/* Delete Button */}
      <TouchableOpacity onPress={() => deleteExpense(item.id)}>
        <Text style={styles.delete}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  //======== INITIAL SETUP ========
  useEffect(() => {
    async function setup() {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          note TEXT,
          date TEXT,
          total REAL
        );
      `);
      await loadExpenses();
    }

    setup();
  }, []);

  //======== UI ========
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

        {editingId ? (
          <Button title="Save Changes" onPress={editExpense} />
        ) : (
          <Button title="Add Expense" onPress={addExpense} />
        )}
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpense}
        ListEmptyComponent={<Text style={styles.empty}>No expenses yet.</Text>}
      />

      {/* TOTAL EXPENSE DISPLAY */}
      <Text style={styles.totalText}>
        Total Spent: ${totalSpent.toFixed(2)}
      </Text>

      <Text style={styles.footer}>
        Expenses are stored locally using SQLite.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#111827' },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  form: {
    marginBottom: 16,
    gap: 8,
  },
  input: {
    padding: 10,
    backgroundColor: '#1f2937',
    color: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fbbf24',
  },
  expenseCategory: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  expenseNote: {
    fontSize: 12,
    color: '#9ca3af',
  },
  edit: {
    color: '#60a5fa',
    fontSize: 20,
    marginHorizontal: 12,
  },
  delete: {
    color: '#f87171',
    fontSize: 20,
  },
  empty: {
    color: '#9ca3af',
    marginTop: 24,
    textAlign: 'center',
  },
  totalText: {
    color: '#fbbf24',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 12,
    fontSize: 12,
  },
});