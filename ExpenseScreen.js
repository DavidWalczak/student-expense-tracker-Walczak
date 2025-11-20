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
  const [runningTotal, setRunningTotal] = useState(0);
  

  const loadExpenses = async () => {
    const rows = await db.getAllAsync('SELECT * FROM expenses ORDER BY id DESC;');

    setExpenses(rows);
    calculateTotal(rows);
  };

  //========Add Expense Function========

    const addExpense = async () => {
    const amountNumber = parseFloat(amount);

    if (isNaN(amountNumber) || amountNumber <= 0) {
      // Basic validation: ignore invalid or non-positive amounts
      return;
    }

    const trimmedCategory = category.trim();
    const trimmedNote = note.trim();

    if (!trimmedCategory) {
      // Category is required
      return;
    }

    await db.runAsync(
        'INSERT INTO expenses (amount, category, note, date, total) VALUES (?, ?, ?, ?, ?);',
        [amountNumber, trimmedCategory, trimmedNote || null, date || null, totalExpense || null]
    );

    setAmount('');
    setCategory('');
    setNote('');
    setDate('');

    loadExpenses();
  };

  //========RUNNING TOTAL FUNCTION========

  const calculateTotal = (rows) => {
    const sum = rows.reduce((acc, item) => acc + Number(item.amount), 0);
    setRunningTotal(sum);
  };

  //========DELETE EXPENSES========

    const deleteExpense = async (id) => {
    await db.runAsync('DELETE FROM expenses WHERE id = ?;', [id]);
    loadExpenses();
  };

  //========TILE CREATION========

    const renderExpense = ({ item }) => (
    <View style={styles.expenseRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.expenseAmount}>${Number(item.amount).toFixed(2)}</Text>
        <Text style={styles.expenseCategory}>{item.category}</Text>
        {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
        {item.date ? <Text style={styles.expenseNote}>Date: {item.date}</Text> : null}
        {item.total ? (
        <Text style={styles.expenseNote}>Daily Total: ${Number(item.total).toFixed(2)}</Text>
        ) : null}
      </View>

      <TouchableOpacity onPress={() => deleteExpense(item.id)}>
        <Text style={styles.delete}>✕</Text>
      </TouchableOpacity>
        <TouchableOpacity onPress={() => startEditing(item)}>
        <Text style={{ color: '#60a5fa', fontSize: 16, marginRight: 12 }}>✎</Text>
        </TouchableOpacity>
    </View>
  );

  //========EDIT EXPENSE========

  const editExpense = async () => {
        if (!editingId) return;

        const amountNumber = parseFloat(amount);
        if (isNaN(amountNumber) || amountNumber <= 0) return;

        const trimmedCategory = category.trim();
        const trimmedNote = note.trim();

        await db.runAsync(
            `UPDATE expenses 
            SET amount = ?, category = ?, note = ?, date = ?, total = ?
            WHERE id = ?;`,
            [
            amountNumber,
            trimmedCategory,
            trimmedNote || null,
            date || null,
            totalExpense || null,
            editingId,
            ]
        );

        // Reset after saving
        setAmount('');
        setCategory('');
        setNote('');
        setDate('');
        setEditingId(null);

        loadExpenses();
    };

    const startEditing = (expense) => {
        setEditingId(expense.id);
        setAmount(String(expense.amount));
        setCategory(expense.category);
        setNote(expense.note || '');
        setDate(expense.date || '');
    };

  //========DATA TABLE SCHEMA CREATION========

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
                );`);
            await loadExpenses();
        }

        setup();
    }, []);

  //========RETURN FUNCTION========

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
        placeholder="Date (YYYY-MM-DD) (Optional)"
        placeholderTextColor="#9ca3af"
        value={date}
        onChangeText={setDate}
        />
        <Button title="Add Expense" onPress={addExpense} />
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
      <Text style={styles.footer}>
        Enter your expenses and they’ll be saved locally with SQLite.
      </Text>
    </SafeAreaView>
  );
};

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
  delete: {
    color: '#f87171',
    fontSize: 20,
    marginLeft: 12,
  },
  empty: {
    color: '#9ca3af',
    marginTop: 24,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 12,
    fontSize: 12,
  },
  totalDisplay: {
  marginTop: 16,
  fontSize: 20,
  fontWeight: '700',
  color: '#fbbf24',
  textAlign: 'center',
  },
});
