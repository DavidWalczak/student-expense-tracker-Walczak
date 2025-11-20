// ExpenseScreen.js
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
  Alert,
} from 'react-native';
import * as SQLite from 'expo-sqlite';

// Open SQLite database
const db = SQLite.openDatabase('expenses.db');

export default function ExpenseScreen() {
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [editingId, setEditingId] = useState(null);

  // Filters
  const [filter, setFilter] = useState('All'); // 'All', 'Week', 'Month'

  // Totals
  const [total, setTotal] = useState(0);
  const [categoryTotals, setCategoryTotals] = useState({});

  // Sort
  const [sortColumn, setSortColumn] = useState('id');
  const [sortOrder, setSortOrder] = useState('DESC');

  /** Initialize DB */
  useEffect(() => {
    db.transaction(tx => {
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          note TEXT,
          date TEXT
        );`
      );
    }, e => console.error('DB init error', e), loadExpenses);
  }, [filter, sortColumn, sortOrder]);

  /** Helper: Get start of week/month as YYYY-MM-DD */
  const getStartOfWeek = () => {
    const now = new Date();
    const day = now.getDay(); // 0 (Sun) - 6 (Sat)
    const diff = now.getDate() - day; // adjust to Sunday
    const start = new Date(now.setDate(diff));
    return start.toISOString().split('T')[0];
  };

  const getStartOfMonth = () => {
    const now = new Date();
    now.setDate(1);
    return now.toISOString().split('T')[0];
  };

  /** Load expenses with filter */
  const loadExpenses = () => {
    let whereClause = '';
    if (filter === 'Week') {
      const startOfWeek = getStartOfWeek();
      whereClause = `WHERE date >= '${startOfWeek}'`;
    } else if (filter === 'Month') {
      const startOfMonth = getStartOfMonth();
      whereClause = `WHERE date >= '${startOfMonth}'`;
    }

    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM expenses ${whereClause} ORDER BY ${sortColumn} ${sortOrder};`,
        [],
        (_, { rows }) => {
          const data = rows._array;
          setExpenses(data);
          calculateTotals(data);
        },
        (_, error) => console.error('loadExpenses error', error)
      );
    });
  };

  /** Calculate overall and category totals */
  const calculateTotals = data => {
    const totalAmount = data.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    setTotal(totalAmount);

    const catTotals = {};
    data.forEach(item => {
      catTotals[item.category] = (catTotals[item.category] || 0) + Number(item.amount);
    });
    setCategoryTotals(catTotals);
  };

  /** Reset form */
  const resetForm = () => {
    setAmount('');
    setCategory('');
    setNote('');
    setDate('');
    setEditingId(null);
  };

  /** Validate inputs */
  const validateInputs = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a number greater than 0.');
      return false;
    }
    if (!category.trim()) {
      Alert.alert('Category Required', 'Please enter a category.');
      return false;
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Invalid Date', 'Date must be in YYYY-MM-DD format.');
      return false;
    }
    return true;
  };

  /** Add expense */
  const addExpense = () => {
    if (!validateInputs()) return;
    db.transaction(tx => {
      tx.executeSql(
        'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?);',
        [parseFloat(amount), category.trim(), note.trim() || null, date.trim() || null],
        loadExpenses,
        (_, error) => console.error('addExpense error', error)
      );
    });
    resetForm();
  };

  /** Start editing */
  const startEditing = expense => {
    setEditingId(expense.id);
    setAmount(String(expense.amount));
    setCategory(expense.category);
    setNote(expense.note || '');
    setDate(expense.date || '');
  };

  /** Save edits */
  const editExpense = () => {
    if (!editingId || !validateInputs()) return;
    db.transaction(tx => {
      tx.executeSql(
        'UPDATE expenses SET amount = ?, category = ?, note = ?, date = ? WHERE id = ?;',
        [parseFloat(amount), category.trim(), note.trim() || null, date.trim() || null, editingId],
        loadExpenses,
        (_, error) => console.error('editExpense error', error)
      );
    });
    resetForm();
  };

  /** Delete expense */
  const deleteExpense = id => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          db.transaction(tx => {
            tx.executeSql('DELETE FROM expenses WHERE id = ?;', [id], loadExpenses);
          });
        },
      },
    ]);
  };

  /** Render expense row */
  const renderExpense = ({ item }) => (
    <View style={styles.expenseRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.expenseAmount}>${Number(item.amount).toFixed(2)}</Text>
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

      {/* Filter Buttons */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 }}>
        {['All', 'Week', 'Month'].map(f => (
          <Button
            key={f}
            title={f}
            onPress={() => setFilter(f)}
            color={filter === f ? '#fbbf24' : '#374151'}
          />
        ))}
      </View>

      {/* Form */}
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
          placeholder="Category"
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
          placeholder="Date (YYYY-MM-DD) (optional)"
          placeholderTextColor="#9ca3af"
          value={date}
          onChangeText={setDate}
        />
        <Button title={editingId ? 'Save Changes' : 'Add Expense'} onPress={editingId ? editExpense : addExpense} />
      </View>

      {/* Expense List */}
      <FlatList
        data={expenses}
        keyExtractor={item => item.id.toString()}
        renderItem={renderExpense}
        ListEmptyComponent={<Text style={styles.empty}>No expenses yet.</Text>}
      />

      {/* Totals */}
      <View style={{ marginTop: 16 }}>
        <Text style={styles.totalDisplay}>Total Spent: ${total.toFixed(2)}</Text>
        <Text style={{ fontWeight: '700', color: '#e5e7eb', marginTop: 8 }}>Totals by Category:</Text>
        {Object.keys(categoryTotals).map(cat => (
          <Text key={cat} style={styles.categoryTotal}>
            {cat}: ${categoryTotals[cat].toFixed(2)}
          </Text>
        ))}
      </View>

      <Text style={styles.footer}>Expenses are saved locally using SQLite.</Text>
    </SafeAreaView>
  );
}

  const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#111827' },
  heading: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 16 },
  form: { marginBottom: 16, gap: 8 },
  input: { padding: 10, backgroundColor: '#1f2937', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#374151', marginBottom: 8 },
  expenseRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', padding: 12, borderRadius: 8, marginBottom: 8 },
  expenseAmount: { fontSize: 18, fontWeight: '700', color: '#fbbf24' },
  expenseCategory: { fontSize: 14, color: '#e5e7eb' },
  expenseNote: { fontSize: 12, color: '#9ca3af' },
  categoryTotal: { fontSize: 14, color: '#fbbf24', marginLeft: 8 },
  edit: { color: '#60a5fa', fontSize: 20, marginLeft: 12 },
  delete: { color: '#f87171', fontSize: 20, marginLeft: 12 },
  empty: { color: '#9ca3af', marginTop: 24, textAlign: 'center' },
  footer: { textAlign: 'center', color: '#6b7280', marginTop: 12, fontSize: 12 },
  totalDisplay: { marginTop: 16, fontSize: 20, fontWeight: '700', color: '#fbbf24', textAlign: 'center' },
});