// Final interactive browser runtime script file with complete operations
let compiledSchema = null;
let activePage = "";
let activeRole = "Guest";
let isPremiumPaid = false;

const MOCK_DATA_TEMPLATES = {
  users: [{ id: 1, name: "Suchit Jundare", email: "suchit@bankverse.com", role: "Admin" }],
  contacts: [{ id: 1, name: "John Doe", email: "john@example.com", phone: "+1 555-0199" }]
};

function initLocalDb(dbSchema) {
  if (!dbSchema || !dbSchema.tables) return;
  dbSchema.tables.forEach(table => {
    const key = `mock_db_${table.name.toLowerCase()}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(MOCK_DATA_TEMPLATES[table.name.toLowerCase()] || []));
    }
  });
  syncDbVisualizer();
}

function getTableRecords(tableName) {
  return JSON.parse(localStorage.getItem(`mock_db_${tableName.toLowerCase()}`)) || [];
}

function saveTableRecords(tableName, records) {
  localStorage.setItem(`mock_db_${tableName.toLowerCase()}`, JSON.stringify(records));
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

// REST simulator
function executeMockApi(path, method, body = null) {
  if (!compiledSchema) return { success: false, error: "Schema not loaded." };
  const endpoint = compiledSchema.api_schema.endpoints.find(e => e.path === path && e.method === method);
  if (!endpoint) return { success: false, error: "404 Not Found" };
  if (endpoint.authRequired && !endpoint.allowedRoles.includes(activeRole)) return { success: false, error: "403 Forbidden" };
  const t = endpoint.dbAction ? endpoint.dbAction.targetTable.toLowerCase() : "";
  if (endpoint.dbAction) {
    if (endpoint.dbAction.type === 'select') return { success: true, data: getTableRecords(t) };
    if (endpoint.dbAction.type === 'insert') return { success: true, data: insertDbRecord(t, body) };
    if (endpoint.dbAction.type === 'delete') {
      saveTableRecords(t, getTableRecords(t).filter(r => r.id !== parseInt(body.id)));
      return { success: true };
    }
  }
  return { success: true };
}

function renderApp(schema) {
  const canvas = document.getElementById('app-canvas');
  canvas.innerHTML = "";
  const pages = schema.ui_schema.pages || [];
  if (pages.length === 0) return;
  const appContainer = document.createElement('div');
  appContainer.className = 'live-app-container';
  const sidebar = document.createElement('aside');
  sidebar.className = 'live-app-sidebar';
  sidebar.innerHTML = `<div class="sidebar-title">${schema.projectName}</div><ul class="nav-list" id="sim-nav-list"></ul>`;
  appContainer.appendChild(sidebar);
  const content = document.createElement('div');
  content.className = 'live-app-content';
  content.innerHTML = `<header class="live-app-header"><h3 id="sim-page-title">Page</h3><div id="sim-user-status">Role: 	ext${activeRole}</div></header><div class="live-app-body" id="sim-page-body"></div>`;
  appContainer.appendChild(content);
  canvas.appendChild(appContainer);
  rebuildSidebarNav();
  switchPage(pages[0].name);
}

function rebuildSidebarNav() {
  const navList = document.getElementById('sim-nav-list');
  if (!navList || !compiledSchema) return;
  navList.innerHTML = "";
  compiledSchema.ui_schema.pages.forEach(p => {
    if (!p.rolesAllowed.includes(activeRole)) return;
    const li = document.createElement('li');
    li.innerHTML = `<button class="nav-item-btn" onclick="switchPage('	ext${p.name}')">	ext${p.name}</button>`;
    navList.appendChild(li);
  });
}

function switchPage(name) {
  activePage = name;
  document.getElementById('sim-page-title').innerText = name;
  renderPageContent(name);
}

function renderPageContent(pageName) {
  const body = document.getElementById('sim-page-body');
  if (!body) return;
  body.innerHTML = "";
  const page = compiledSchema.ui_schema.pages.find(p => p.name === pageName);
  if (!page.rolesAllowed.includes(activeRole)) {
    body.innerHTML = "<h3>Access Denied</h3>";
    return;
  }
  const pg = compiledSchema.business_rules?.premiumGating;
  if (pg && pg.enabled && pg.gatedPages.includes(pageName) && !isPremiumPaid) {
    body.innerHTML = `<h3>Premium Feature Locked</h3><button class="btn btn-primary" onclick="openCheckoutModal()">Upgrade ($19/mo)</button>`;
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'widgets-grid';
  body.appendChild(grid);
  page.widgets.forEach(w => {
    if (w.type === 'metric') {
      const card = document.createElement('div');
      card.className = 'widget-metric';
      card.innerHTML = `<h4>	ext${w.title}</h4><div class="metric-value">	ext${getTableRecords(w.targetTable).length}</div>`;
      grid.appendChild(card);
    } else if (w.type === 'table') {
      const card = document.createElement('div');
      card.className = 'widget-table';
      const recs = getTableRecords(w.targetTable);
      card.innerHTML = `<h4>	ext${w.title}</h4>`;
      if (recs.length > 0) {
        const tbl = document.createElement('table');
        const hd = Object.keys(recs[0]).filter(k => k !== 'id');
        tbl.innerHTML = "<tr>" + hd.map(h => `<th>	ext${h}</th>`).join('') + "<th>Actions</th></tr>";
        recs.forEach(r => {
          tbl.innerHTML += "<tr>" + hd.map(h => `<td>	ext${r[h]}</td>`).join('') + `<td><button onclick="handleDeleteRow('	ext${w.targetTable}','	ext${r.id}')">Delete</button></td></tr>`;
        });
        card.appendChild(tbl);
      } else { card.innerHTML += "<p>No data</p>"; }
      body.appendChild(card);
    } else if (w.type === 'form') {
      const card = document.createElement('div');
      card.className = 'widget-form';
      card.innerHTML = `<h4>	ext${w.title}</h4>`;
      const form = document.createElement('form');
      w.formFields.forEach(f => {
        form.innerHTML += `<div class="form-group"><label>	ext${f.label}</label><input type="text" name="	ext${f.name}"></div>`;
      });
      const btn = document.createElement('button');
      btn.innerText = "Submit";
      form.appendChild(btn);
      form.onsubmit = (e) => {
        e.preventDefault();
        const fd = {};
        form.querySelectorAll('input').forEach(i => fd[i.name] = i.value);
        executeMockApi(w.submitApi, 'POST', fd);
        renderPageContent(activePage);
      };
      card.appendChild(form);
      body.appendChild(card);
    }
  });
}

function handleDeleteRow(tableName, id) {
  executeMockApi(`/api/	ext${tableName.toLowerCase()}`, 'DELETE', { id });
  renderPageContent(activePage);
}

function syncDbVisualizer() {
  const container = document.getElementById('db-tables-container');
  if (!container || !compiledSchema) return;
  container.innerHTML = "";
  compiledSchema.db_schema.tables.forEach(t => {
    const recs = getTableRecords(t.name);
    const box = document.createElement('div');
    box.className = 'db-table-box';
    box.innerHTML = `<div class="db-table-title">	ext${t.name.toLowerCase()} (	ext${recs.length} records)</div>`;
    container.appendChild(box);
  });
}

function openCheckoutModal() { document.getElementById('checkout-modal').style.display = 'flex'; }
function closeCheckoutModal() { document.getElementById('checkout-modal').style.display = 'none'; }
document.getElementById('close-checkout').onclick = closeCheckoutModal;
document.getElementById('pay-confirm-btn').onclick = () => {
  isPremiumPaid = true;
  document.getElementById('sim-premium-checkbox').checked = true;
  closeCheckoutModal();
  rebuildSidebarNav();
  renderPageContent(activePage);
};

document.getElementById('sim-role-select').onchange = (e) => { activeRole = e.target.value; rebuildSidebarNav(); renderPageContent(activePage); };
document.getElementById('sim-premium-checkbox').onchange = (e) => { isPremiumPaid = e.target.checked; rebuildSidebarNav(); renderPageContent(activePage); };

document.getElementById('compile-btn').onclick = async () => {
  const prompt = document.getElementById('prompt-input').value;
  const provider = document.getElementById('provider-select').value;
  const apiKey = document.getElementById('api-key-input').value;
  const btn = document.getElementById('compile-btn');
  btn.disabled = true;
  btn.innerText = "Compiling...";
  const logs = document.getElementById('logs-container');
  logs.innerHTML = "";
  try {
    const res = await fetch('/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, provider, apiKey })
    });
    const data = await res.json();
    data.logs.forEach(l => {
      logs.innerHTML += `<div>[	ext${l.stage}] 	ext${l.message}</div>`;
    });
    if (res.ok && data.success) {
      compiledSchema = data.schemas;
      document.querySelector('#schema-pre code').innerText = JSON.stringify(compiledSchema, null, 2);
      const roleSelect = document.getElementById('sim-role-select');
      roleSelect.innerHTML = "";
      compiledSchema.auth_schema.roles.forEach(r => {
        roleSelect.innerHTML += `<option value="	ext${r}">	ext${r}</option>`;
      });
      activeRole = compiledSchema.auth_schema.defaultRole;
      roleSelect.value = activeRole;
      initLocalDb(compiledSchema.db_schema);
      renderApp(compiledSchema);
    }
  } catch (err) {
    alert("Connection Error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Compile App";
  }
};
