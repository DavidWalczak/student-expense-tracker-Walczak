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
  Modal,
  Pressable,
} from 'react-native';
import * as SQLite from 'expo-sqlite';

// Open database
const db = SQLite.openDatabaseSync('expenses.db');

// Async wrapper for executeSql
function executeSqlAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        tx.executeSql(
          sql,
          params,
          (_, result) => resolve(result),
          (_, error) => reject(error)
        );
      },
      txError => reject(txError)
    );
  });
}

export default function ExpenseScreen() {
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [runningTotal, setRunningTotal] = useState(0);

  // Sorting
  const [sortColumn, setSortColumn] = useState('id');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Load expenses
  const loadExpenses = async () => {
    try {
      const result = await executeSqlAsync(
        `SELECT * FROM expenses ORDER BY ${sortColumn} ${sortOrder};`
      );
      const rows = result.rows._array;
      setExpenses(rows);
      setRunningTotal(rows.reduce((acc, item) => acc + Number(item.amount || 0), 0));
    } catch (e) {
      console.error('loadExpenses error:', e);
    }
  };

  // Reset form
  const resetForm = () => {
    setAmount('');
    setCategory('');
    setNote('');
    setDate('');
    setEditingId(null);
  };

  // Validation
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

  // Add expense
  const addExpense = async () => {
    if (!validateInputs()) return;
    try {
      await executeSqlAsync(
        'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?);',
        [parseFloat(amount), category.trim(), note.trim() || null, date.trim() || null]
      );
      resetForm();
      await loadExpenses();
    } catch (e) {
      console.error('addExpense error:', e);
      Alert.alert('Database Error', 'Failed to add expense.');
    }
  };

  // Start edit
  const startEditing = expense => {
    setEditingId(expense.id);
    setAmount(String(expense.amount));
    setCategory(expense.category);
    setNote(expense.note || '');
    setDate(expense.date || '');
  };

  // Save edit
  const editExpense = async () => {
    if (!editingId) return;
    if (!validateInputs()) return;
    try {
      await executeSqlAsync(
        'UPDATE expenses SET amount = ?, category = ?, note = ?, date = ? WHERE id = ?;',
        [parseFloat(amount), category.trim(), note.trim() || null, date.trim() || null, editingId]
      );
      resetForm();
      await loadExpenses();
    } catch (e) {
      console.error('editExpense error:', e);
      Alert.alert('Database Error', 'Failed to update expense.');
    }
  };

  // Delete with confirmation
  const deleteExpense = id => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await executeSqlAsync('DELETE FROM expenses WHERE id = ?;', [id]);
            await loadExpenses();
          } catch (e) {
            console.error('deleteExpense error:', e);
            Alert.alert('Database Error', 'Failed to delete expense.');
          }
        },
      },
    ]);
  };

  // Render expense row
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

  // Initialize database
  useEffect(() => {
    (async () => {
      try {
        await executeSqlAsync(`
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
        console.error('DB setup error:', e);
        Alert.alert('Database Error', 'Failed to initialize DB.');
      }
    })();
  }, []);

  // Confirm sort
  const confirmSort = async () => {
    setSortModalVisible(false);
    await loadExpenses();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Student Expense Tracker</Text>

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

      {/* Sort button */}
      <Button title="Sort" onPress={() => setSortModalVisible(true)} />

      {/* Sort modal */}
      <Modal transparent visible={sortModalVisible} animationType="slide">
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={{ fontWeight: '700', marginBottom: 12 }}>Sort Expenses</Text>
            {['id', 'category', 'date', 'amount'].map(col => (
              <Pressable key={col} style={styles.modalButton} onPress={() => setSortColumn(col)}>
                <Text style={sortColumn === col ? { fontWeight: '700' } : {}}>{col}</Text>
              </Pressable>
            ))}
            {['ASC', 'DESC'].map(order => (
              <Pressable key={order} style={styles.modalButton} onPress={() => setSortOrder(order)}>
                <Text style={sortOrder === order ? { fontWeight: '700' } : {}}>{order}</Text>
              </Pressable>
            ))}
            <Button title="Confirm" onPress={confirmSort} />
            <Button title="Cancel" onPress={() => setSortModalVisible(false)} />
          </View>
        </View>
      </Modal>

      {/* Expense list */}
      <FlatList
        data={expenses}
        keyExtractor={item => item.id.toString()}
        renderItem={renderExpense}
        ListEmptyComponent={<Text style={styles.empty}>No expenses yet.</Text>}
      />

      <Text style={styles.totalDisplay}>Total Spent: ${runningTotal.toFixed(2)}</Text>
      <Text style={styles.footer}>Expenses are saved locally using SQLite.</Text>
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#111827' },
  heading: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 16 },
  form: { marginBottom: 16, gap: 8 },
  input: { padding: 10, backgroundColor: '#1f2937', color: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#374151', marginBottom: 8 },
  expenseRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', padding: 12, borderRadius: 8, marginBottom: 8 },
  expenseAmount: { fontSize: 18, fontWeight: '700', color: '#fbbf24' },
  expenseCategory: { fontSize: 14, color: '#e5e7eb' },
  expenseNote: { fontSize: 12, color: '#9ca3af' },
  edit: { color: '#60a5fa', fontSize: 20, marginLeft: 12 },
  delete: { color: '#f87171', fontSize: 20, marginLeft: 12 },
  empty: { color: '#9ca3af', marginTop: 24, textAlign: 'center' },
  footer: { textAlign: 'center', color: '#6b7280', marginTop: 12, fontSize: 12 },
  totalDisplay: { marginTop: 16, fontSize: 20, fontWeight: '700', color: '#fbbf24', textAlign: 'center' },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '80%' },
  modalButton: { padding: 10, marginVertical: 4, backgroundColor: '#e5e7eb', borderRadius: 6 },
});
