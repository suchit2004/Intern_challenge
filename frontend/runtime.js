// Global State
let compiledSchema = null;
let activePage = "";
let activeRole = "Guest";
let isPremiumPaid = false;

// Mock database functions
function getTableRecords(t) { return JSON.parse(localStorage.getItem(`mock_db_${t}`)) || []; }
function saveTableRecords(t, r) { localStorage.setItem(`mock_db_${t}`, JSON.stringify(r)); syncDbVisualizer(); }
function insertDbRecord(t, r) {
  const recs = getTableRecords(t);
  const nextId = recs.length > 0 ? Math.max(...recs.map(x => x.id || 0)) + 1 : 1;
  const newRec = { id: nextId, ...r };
  recs.push(newRec);
  saveTableRecords(t, recs);
  return newRec;
}
function deleteDbRecord(t, id) {
  saveTableRecords(t, getTableRecords(t).filter(x => x.id !== parseInt(id)));
}

function executeMockApi(path, method, body = null) {
  if (!compiledSchema || !compiledSchema.api_schema) return { success: false, error: "No API schema." };
  const endpoint = compiledSchema.api_schema.endpoints.find(e => e.path === path && e.method === method);
  if (!endpoint) return { success: false, error: "404 Route Not Found" };

  if (endpoint.authRequired && !endpoint.allowedRoles.includes(activeRole)) {
    return { success: false, error: "403 Forbidden: Role unauthorized." };
  }

  const action = endpoint.dbAction;
  if (!action) return { success: true };

  const tableName = action.targetTable.toLowerCase();
  if (action.type === 'select') return { success: true, data: getTableRecords(tableName) };
  if (action.type === 'insert') return { success: true, data: insertDbRecord(tableName, body) };
  if (action.type === 'delete') {
    deleteDbRecord(tableName, body.id);
    return { success: true };
  }
  return { success: false };
}

function syncDbVisualizer() {}