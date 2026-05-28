let compiledSchema = null;
let activePage = "";
let activeRole = "Guest";
let isPremiumPaid = false;

const MOCK_DATA_TEMPLATES = {
  users: [{ id: 1, name: "Suchit Jundare", email: "suchit@bankverse.com", role: "Admin" }],
  contacts: [{ id: 1, name: "John Doe", email: "john@example.com" }]
};

function initLocalDb(dbSchema) {
  if (!dbSchema || !dbSchema.tables) return;
  dbSchema.tables.forEach(table => {
    const key = `mock_db_${table.name.toLowerCase()}`;
    if (!localStorage.getItem(key)) {
      const templateData = MOCK_DATA_TEMPLATES[table.name.toLowerCase()] || [];
      localStorage.setItem(key, JSON.stringify(templateData));
    }
  });
  syncDbVisualizer();
}

function getTableRecords(tableName) {
  const key = `mock_db_${tableName.toLowerCase()}`;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function saveTableRecords(tableName, records) {
  const key = `mock_db_${tableName.toLowerCase()}`;
  localStorage.setItem(key, JSON.stringify(records));
  syncDbVisualizer();
}

function insertDbRecord(tableName, record) {
  const records = getTableRecords(tableName);
  const nextId = records.length > 0 ? Math.max(...records.map(r => r.id || 0)) + 1 : 1;
  const newRecord = { id: nextId, ...record };
  records.push(newRecord);
  saveTableRecords(tableName, records);
  return newRecord;
}

function deleteDbRecord(tableName, recordId) {
  let records = getTableRecords(tableName);
  records = records.filter(r => r.id !== parseInt(recordId));
  saveTableRecords(tableName, records);
}

function syncDbVisualizer() {}