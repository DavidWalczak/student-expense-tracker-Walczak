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
} from 'react-native';
import * as SQLite from 'expo-sqlite';

let db;

export default function ExpenseScreen() {
  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [runningTotal, setRunningTotal] = useState(0);

  // SORTING STATE
  const [sortColumn, setSortColumn] = useState('id'); // confirmed sort
  const [sortOrder, setSortOrder] = useState('DESC'); // confirmed sort
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // TEMPORARY SORT SELECTION IN MODAL
  const [tempSortColumn, setTempSortColumn] = useState(sortColumn);
  const [tempSortOrder, setTempSortOrder] = useState(sortOrder);

  // ------------------------------------------------------
  // EXPO SQLite ASYNC HELPERS
  // ------------------------------------------------------
  async function openDB() {
    db = await SQLite.openDatabaseAsync('expenses.db');
  }

  async function execSqlAsync(sql, params = []) {
    try {
      return await db.execAsync(sql, params);
    } catch (e) {
      console.error('execSqlAsync error', e);
      throw e;
    }
  }

  async function getAllAsync(sql, params = []) {
    try {
      const result = await db.getAllAsync(sql, params);
      return result;
    } catch (e) {
      console.error('getAllAsync error', e);
      throw e;
    }
  }

  // ------------------------------------------------------
  // LOAD EXPENSES WITH SORTING
  // ------------------------------------------------------
  const loadExpenses = async () => {
    try {
      const rows = await getAllAsync(
        `SELECT * FROM expenses ORDER BY ${sortColumn} ${sortOrder};`
      );
      setExpenses(rows);
      const total = rows.reduce((acc, item) => acc + Number(item.amount || 0), 0);
      setRunningTotal(total);
    } catch (e) {
      console.error('loadExpenses error:', e);
    }
  };

  // ------------------------------------------------------
  // VALIDATION
  // ------------------------------------------------------
  const validateInputs = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
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

  // ------------------------------------------------------
  // ADD EXPENSE
  // ------------------------------------------------------
  const addExpense = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a number greater than 0.');
      return; // stop before hitting the DB
    }
    if (!category.trim()) {
      Alert.alert('Category Required', 'Please enter a category.');
      return;
    }

    try {
      await execSqlAsync(
        'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?);',
        [amt, category.trim(), note.trim() || null, date || null]
      );
      resetForm();
      await loadExpenses();
    } catch (e) {
      console.error('addExpense error:', e);
      Alert.alert('Database Error', 'Failed to add expense.');
    }
  };

  // ------------------------------------------------------
  // EDIT EXPENSE
  // ------------------------------------------------------
  const startEditing = (item) => {
    setEditingId(item.id);
    setAmount(String(item.amount));
    setCategory(item.category);
    setNote(item.note || '');
    setDate(item.date || '');
  };

  const editExpense = async () => {
    const amt = parseFloat(amount);
    if (!editingId || isNaN(amt) || amt <= 0) return;

    try {
      await execSqlAsync(
        'UPDATE expenses SET amount=?, category=?, note=?, date=? WHERE id=?;',
        [amt, category.trim(), note.trim() || null, date || null, editingId]
      );
      resetForm();
      await loadExpenses();
    } catch (e) {
      console.error('editExpense error:', e);
    }
  };

  // ------------------------------------------------------
  // DELETE EXPENSE
  // ------------------------------------------------------
  const deleteExpense = (id) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await execSqlAsync('DELETE FROM expenses WHERE id=?;', [id]);
            await loadExpenses();
          } catch (e) {
            console.error('deleteExpense error:', e);
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setNote('');
    setDate('');
    setEditingId(null);
  };

  // ------------------------------------------------------
  // CONFIRM SORT
  // ------------------------------------------------------
  const confirmSort = async () => {
    setSortColumn(tempSortColumn);
    setSortOrder(tempSortOrder);
    setSortModalVisible(false);
    await loadExpenses();
  };

  // ------------------------------------------------------
  // INITIALIZE DB
  // ------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        await openDB();
        await execSqlAsync(`
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
        Alert.alert('Database Error', 'Failed to initialize database.');
      }
    })();
  }, []);

  // ------------------------------------------------------
  // RENDER EXPENSE ROW
  // ------------------------------------------------------
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

  // ------------------------------------------------------
  // RENDER
  // ------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Student Expense Tracker</Text>

      {/* FORM */}
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
          placeholder="Date (YYYY-MM-DD)"
          placeholderTextColor="#9ca3af"
          value={date}
          onChangeText={setDate}
        />
        <Button
          title={editingId ? 'Save Changes' : 'Add Expense'}
          onPress={editingId ? editExpense : addExpense}
        />
      </View>

      {/* SORT MODAL BUTTON */}
      <View style={{ marginBottom: 16 }}>
        <Button title="Sort / Filter" onPress={() => setSortModalVisible(true)} />
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpense}
        ListEmptyComponent={<Text style={styles.empty}>No expenses yet.</Text>}
      />

      <Text style={styles.totalDisplay}>Total Spent: ${runningTotal.toFixed(2)}</Text>

      {/* SORT MODAL */}
      <Modal visible={sortModalVisible} transparent animationType="slide">
        <View style={styles.modalView}>
          <Text style={{ fontSize: 18, marginBottom: 12, color: '#fff' }}>Sort By:</Text>

          {['amount', 'category', 'date'].map((col) => (
            <View key={col} style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ flex: 1, textTransform: 'capitalize', color: '#fff' }}>{col}</Text>
              <TouchableOpacity
                style={[
                  styles.sortButton,
                  tempSortColumn === col && tempSortOrder === 'ASC' && styles.selectedSort,
                ]}
                onPress={() => {
                  setTempSortColumn(col);
                  setTempSortOrder('ASC');
                }}
              >
                <Text>Asc</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sortButton,
                  tempSortColumn === col && tempSortOrder === 'DESC' && styles.selectedSort,
                ]}
                onPress={() => {
                  setTempSortColumn(col);
                  setTempSortOrder('DESC');
                }}
              >
                <Text>Desc</Text>
              </TouchableOpacity>
            </View>
          ))}

          <Button title="Confirm Sort" onPress={confirmSort} />
          <Button title="Cancel" onPress={() => setSortModalVisible(false)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#111827' },
  heading: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 16 },
  form: { marginBottom: 16, gap: 8 },
  input: {
    padding: 10,
    backgroundColor: '#1f2937',
    color: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 8,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expenseAmount: { fontSize: 18, fontWeight: '700', color: '#fbbf24' },
  expenseCategory: { fontSize: 14, color: '#e5e7eb' },
  expenseNote: { fontSize: 12, color: '#9ca3af' },
  edit: { color: '#60a5fa', fontSize: 20, marginLeft: 12 },
  delete: { color: '#f87171', fontSize: 20, marginLeft: 12 },
  empty: { color: '#9ca3af', marginTop: 24, textAlign: 'center' },
  totalDisplay: { marginTop: 16, fontSize: 20, fontWeight: '700', color: '#fbbf24', textAlign: 'center' },
  modalView: {
    marginTop: 100,
    marginHorizontal: 20,
    padding: 20,
    backgroundColor: '#1f2937',
    borderRadius: 12,
  },
  sortButton: {
    padding: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    marginLeft: 8,
  },
  selectedSort: {
    backgroundColor: '#fbbf24',
  },
});