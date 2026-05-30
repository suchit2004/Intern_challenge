// Check if the application is loaded via the file:// protocol (double-clicked local file)
if (window.location.protocol === 'file:') {
  console.error("⚠️ Warning: The app is loaded directly via file:// protocol. Relative API fetches will fail. Please open http://localhost:3000 in your browser.");
  
  // Create and insert warning banner directly into body once it starts loading
  const showFileWarningBanner = () => {
    const banner = document.createElement('div');
    banner.style.cssText = `
      background: linear-gradient(135deg, #ff3e3e, #d32f2f);
      color: #ffffff;
      padding: 14px 20px;
      text-align: center;
      font-weight: 600;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100000;
      font-family: 'Inter', sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
      font-size: 14px;
    `;
    banner.innerHTML = `
      <span>⚠️ <strong>Local Access Warning:</strong> You opened index.html directly as a file. The compiler API requires running the local backend.</span>
      <a href="http://localhost:3000" style="color: #fff; text-decoration: underline; background: rgba(255,255,255,0.15); padding: 4px 10px; border-radius: 4px; margin-left: 10px; font-weight: 700; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">Open Local Host (http://localhost:3000)</a>
    `;
    document.body.prepend(banner);
    document.body.style.paddingTop = '60px';
  };

  if (document.body) {
    showFileWarningBanner();
  } else {
    window.addEventListener('DOMContentLoaded', showFileWarningBanner);
  }
}

// Global State for the sandboxed runtime environment
let compiledSchema = null;
let activePage = "";
let activeRole = "Guest";
let isPremiumPaid = false;


// Mock database initial dataset examples
const MOCK_DATA_TEMPLATES = {
  users: [
    { id: 1, name: "Suchit Jundare", email: "suchit@appforge.com", role: "Admin" },
    { id: 2, name: "Alice Smith", email: "alice@demo.com", role: "Member" }
  ],
  contacts: [
    { id: 1, name: "John Doe", email: "john@example.com", phone: "+1 555-0199", company: "Stripe" },
    { id: 2, name: "Sarah Connor", email: "sarah@cyberdyne.org", phone: "+1 555-0800", company: "Skynet" }
  ],
  tasks: [
    { id: 1, title: "Review CRM schemas", status: "Completed", priority: "High" },
    { id: 2, title: "Configure payment checkout integration", status: "In Progress", priority: "Medium" }
  ]
};

// ==========================================================================
// MOCK DATABASE ACCESS ENGINE (LOCAL STORAGE WRAPPER)
// ==========================================================================

function initLocalDb(dbSchema) {
  if (!dbSchema || !dbSchema.tables) return;
  
  dbSchema.tables.forEach(table => {
    const key = `mock_db_${table.name.toLowerCase()}`;
    // Initialize if empty
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

// ==========================================================================
// SIMULATED REST API INTERCEPTOR LAYER
// ==========================================================================

function executeMockApi(path, method, body = null) {
  if (!compiledSchema || !compiledSchema.api_schema) {
    return { success: false, error: "No API schema loaded." };
  }

  // Find endpoint matching path & method
  const endpoint = compiledSchema.api_schema.endpoints.find(
    e => e.path === path && e.method === method.toUpperCase()
  );

  if (!endpoint) {
    return { success: false, error: `404 Not Found: Endpoint ${method} ${path} is not defined.` };
  }

  // Enforce API Access Roles
  const rolesAllowed = endpoint.allowedRoles || [];
  if (endpoint.authRequired && !rolesAllowed.includes(activeRole)) {
    return { 
      success: false, 
      error: `403 Forbidden: Role '${activeRole}' does not have permission to invoke ${method} ${path}. Allowed: [${rolesAllowed.join(', ')}]`
    };
  }

  // Execute Database action defined in API
  const action = endpoint.dbAction;
  if (!action) {
    return { success: true, message: "API call simulated successfully (no DB bind)." };
  }

  const tableName = action.targetTable.toLowerCase();

  try {
    if (action.type === 'select') {
      const records = getTableRecords(tableName);
      return { success: true, data: records };
    }
    
    if (action.type === 'insert') {
      if (!body) return { success: false, error: "Bad Request: Request body is empty." };
      const record = insertDbRecord(tableName, body);
      return { success: true, data: record };
    }

    if (action.type === 'delete') {
      if (!body || !body.id) return { success: false, error: "Bad Request: Missing ID to delete." };
      deleteDbRecord(tableName, body.id);
      return { success: true, message: "Record deleted successfully." };
    }

    return { success: false, error: `DB action type '${action.type}' not supported.` };
  } catch (e) {
    return { success: false, error: `DB Action Failure: ${e.message}` };
  }
}

// ==========================================================================
// RUNTIME LAYOUT DYNAMIC RENDERER
// ==========================================================================

function renderApp(schema) {
  const canvas = document.getElementById('app-canvas');
  canvas.innerHTML = ""; // Clear welcome screen

  const sidebarPages = schema.ui_schema.pages || [];
  if (sidebarPages.length === 0) {
    canvas.innerHTML = `<div class="lock-screen"><h3>No pages defined</h3><p>UI schema contains no pages.</p></div>`;
    return;
  }

  // Create Live App container
  const appContainer = document.createElement('div');
  appContainer.className = 'live-app-container';

  // Create Sidebar
  const sidebar = document.createElement('aside');
  sidebar.className = 'live-app-sidebar';
  
  const projName = schema.projectName || "Generated App";
  sidebar.innerHTML = `<div class="sidebar-title">${projName}</div>`;

  const navList = document.createElement('ul');
  navList.className = 'nav-list';
  navList.id = 'sim-nav-list';
  sidebar.appendChild(navList);
  appContainer.appendChild(sidebar);

  // Create Content Area
  const contentArea = document.createElement('div');
  contentArea.className = 'live-app-content';
  contentArea.innerHTML = `
    <header class="live-app-header">
      <h3 id="sim-page-title">Page</h3>
      <div class="user-status-widget">
        <span class="status-dot"></span>
        <span id="sim-user-status">Role: ${activeRole}</span>
      </div>
    </header>
    <div class="live-app-body" id="sim-page-body"></div>
  `;
  appContainer.appendChild(contentArea);
  canvas.appendChild(appContainer);

  // Populate navigation links matching current role permissions
  rebuildSidebarNav();

  // Set default page
  const defaultPage = sidebarPages[0].name;
  switchPage(defaultPage);
}

function rebuildSidebarNav() {
  const navList = document.getElementById('sim-nav-list');
  if (!navList || !compiledSchema) return;

  navList.innerHTML = "";
  const pages = compiledSchema.ui_schema.pages || [];

  pages.forEach(page => {
    // Check if role is allowed to see the link
    const allowed = page.rolesAllowed || [];
    if (!allowed.includes(activeRole)) return; // Hide navigation link

    const li = document.createElement('li');
    const button = document.createElement('button');
    button.className = `nav-item-btn ${activePage === page.name ? 'active' : ''}`;
    
    // Choose icon
    const icon = page.icon === 'home' ? '🏠' : 
                 page.icon === 'users' ? '👥' : 
                 page.icon === 'chart' ? '📈' : 
                 page.icon === 'credit-card' ? '💳' : 
                 page.icon === 'settings' ? '⚙️' : '📄';

    button.innerHTML = `<span class="nav-icon">${icon}</span> ${page.name}`;
    button.onclick = () => switchPage(page.name);
    li.appendChild(button);
    navList.appendChild(li);
  });

  // Sync user status header text
  const userStatus = document.getElementById('sim-user-status');
  if (userStatus) {
    userStatus.innerText = `Role: ${activeRole}${isPremiumPaid ? " (Premium)" : ""}`;
  }
}

function switchPage(pageName) {
  activePage = pageName;
  // Re-highlight active class in sidebar
  const buttons = document.querySelectorAll('.nav-item-btn');
  buttons.forEach(btn => {
    if (btn.innerText.includes(pageName)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const titleHeader = document.getElementById('sim-page-title');
  if (titleHeader) titleHeader.innerText = pageName;

  renderPageContent(pageName);
}

function renderPageContent(pageName) {
  const pageBody = document.getElementById('sim-page-body');
  if (!pageBody || !compiledSchema) return;

  pageBody.innerHTML = "";

  const page = compiledSchema.ui_schema.pages.find(p => p.name === pageName);
  if (!page) {
    pageBody.innerHTML = `<div class="lock-screen"><h3>Page Not Found</h3><p>Page "${pageName}" is not registered.</p></div>`;
    return;
  }

  // 1. Gating Gatekeeper (Role-based access control check)
  const allowed = page.rolesAllowed || [];
  if (!allowed.includes(activeRole)) {
    pageBody.innerHTML = `
      <div class="lock-screen">
        <span class="lock-screen-icon">🚫</span>
        <h3>Access Denied</h3>
        <p>Your current simulator role (<strong>${activeRole}</strong>) is not authorized to view the "${pageName}" workspace.</p>
        <p class="hint">Use the Active Role dropdown in the header to switch roles.</p>
      </div>
    `;
    return;
  }

  // 2. Business Logic Gatekeeper (Premium Gating Gating)
  const pg = compiledSchema.business_rules?.premiumGating;
  if (pg && pg.enabled && pg.gatedPages.includes(pageName) && !isPremiumPaid) {
    pageBody.innerHTML = `
      <div class="lock-screen premium">
        <span class="lock-screen-icon">🔒</span>
        <h3>Premium Feature Locked</h3>
        <p>The "${pageName}" analytics suite is only accessible to users on the Premium subscription tier.</p>
        <button class="btn btn-primary" onclick="openCheckoutModal()">Upgrade to Premium ($19/mo)</button>
      </div>
    `;
    return;
  }

  // 3. Render Widgets
  const widgets = page.widgets || [];
  if (widgets.length === 0) {
    pageBody.innerHTML = `<p style="color: var(--color-text-muted); font-size:13px;">This page has no widgets to display.</p>`;
    return;
  }

  // Create grid system for widgets
  const widgetGrid = document.createElement('div');
  widgetGrid.className = 'widgets-grid';
  pageBody.appendChild(widgetGrid);

  widgets.forEach(widget => {
    if (widget.type === 'metric') {
      renderMetricWidget(widget, widgetGrid);
    } else if (widget.type === 'table') {
      renderTableWidget(widget, pageBody); // Tables span full width below metrics
    } else if (widget.type === 'form') {
      renderFormWidget(widget, pageBody);
    } else if (widget.type === 'chart') {
      renderChartWidget(widget, pageBody);
    } else if (widget.type === 'payment_button') {
      renderPaymentButtonWidget(widget, pageBody);
    }
  });
}

// Widget Sub-Renderers

function renderMetricWidget(widget, container) {
  const card = document.createElement('div');
  card.className = 'widget-metric';
  
  let val = 0;
  if (widget.targetTable) {
    val = getTableRecords(widget.targetTable).length;
  } else if (widget.dataSourceApi) {
    const res = executeMockApi(widget.dataSourceApi, 'GET');
    if (res.success && res.data) val = res.data.length;
  }

  const icon = widget.title.toLowerCase().includes('contact') ? '👥' :
               widget.title.toLowerCase().includes('user') ? '👤' : 
               widget.title.toLowerCase().includes('payment') || widget.title.toLowerCase().includes('revenue') ? '💰' : '📊';

  card.innerHTML = `
    <div class="metric-info">
      <h4>${widget.title}</h4>
      <div class="metric-value" id="metric-val-${widget.id}">${val}</div>
    </div>
    <div class="metric-icon">${icon}</div>
  `;
  container.appendChild(card);
}

function renderTableWidget(widget, container) {
  const card = document.createElement('div');
  card.className = 'widget-table';

  let records = [];
  if (widget.targetTable) {
    records = getTableRecords(widget.targetTable);
  } else if (widget.dataSourceApi) {
    const res = executeMockApi(widget.dataSourceApi, 'GET');
    if (res.success && res.data) records = res.data;
  }

  card.innerHTML = `
    <div class="widget-title-row">
      <h4>${widget.title}</h4>
      <span class="badge">${records.length} records</span>
    </div>
  `;

  if (records.length === 0) {
    card.innerHTML += `<p style="font-size:12px; color:var(--color-text-muted); padding:10px 0;">No records found in table.</p>`;
    container.appendChild(card);
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';

  const table = document.createElement('table');
  const headers = Object.keys(records[0]).filter(k => k !== 'id');
  
  // Headers row
  let headerHtml = "<tr>";
  headers.forEach(h => {
    headerHtml += `<th>${h}</th>`;
  });
  headerHtml += "<th style='text-align:right;'>Actions</th></tr>";
  table.innerHTML += headerHtml;

  // Data rows
  records.forEach(row => {
    let rowHtml = "<tr>";
    headers.forEach(h => {
      rowHtml += `<td>${row[h]}</td>`;
    });
    rowHtml += `
      <td style="text-align:right;">
        <button class="row-action-btn" onclick="handleDeleteRow('${widget.targetTable || ''}', '${row.id}')">Delete</button>
      </td>
    </tr>`;
    table.innerHTML += rowHtml;
  });

  wrapper.appendChild(table);
  card.appendChild(wrapper);
  container.appendChild(card);
}

function handleDeleteRow(tableName, id) {
  if (!tableName) return;
  // Find endpoint definition to match method (usually DELETE)
  const deleteEndpoint = compiledSchema.api_schema.endpoints.find(
    e => e.dbAction && e.dbAction.targetTable.toLowerCase() === tableName.toLowerCase() && e.method === 'DELETE'
  );

  const path = deleteEndpoint ? deleteEndpoint.path : `/api/${tableName}`;
  const method = deleteEndpoint ? deleteEndpoint.method : 'DELETE';

  const res = executeMockApi(path, method, { id });
  if (res.success) {
    renderPageContent(activePage); // Refresh UI
  } else {
    alert(res.error || "Failed to delete record.");
  }
}

function renderFormWidget(widget, container) {
  const card = document.createElement('div');
  card.className = 'widget-form';
  card.innerHTML = `<h4>${widget.title}</h4>`;

  const form = document.createElement('form');
  form.onsubmit = (e) => {
    e.preventDefault();
    const formData = {};
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => {
      if (input.name) {
        formData[input.name] = input.value;
      }
    });

    // Send to bound Mock API
    const submitApi = widget.submitApi || `/api/${widget.targetTable}`;
    const endpoint = compiledSchema.api_schema.endpoints.find(e => e.path === submitApi && e.method === 'POST');
    const method = endpoint ? endpoint.method : 'POST';

    const res = executeMockApi(submitApi, method, formData);
    if (res.success) {
      form.reset();
      renderPageContent(activePage); // Refresh UI
    } else {
      alert(res.error || "API Submission error.");
    }
  };

  const fields = widget.formFields || [];
  fields.forEach(field => {
    const group = document.createElement('div');
    group.className = 'form-group';
    group.innerHTML = `
      <label for="form-input-${field.name}">${field.label}</label>
      <input type="${field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}" 
             name="${field.name}" id="form-input-${field.name}" ${field.required ? 'required' : ''}>
    `;
    form.appendChild(group);
  });

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn btn-primary';
  submitBtn.type = 'submit';
  submitBtn.innerText = `Submit ${widget.title}`;
  form.appendChild(submitBtn);

  card.appendChild(form);
  container.appendChild(card);
}

function renderChartWidget(widget, container) {
  const card = document.createElement('div');
  card.className = 'widget-chart';
  card.innerHTML = `<h4>${widget.title}</h4>`;

  const chartContainer = document.createElement('div');
  chartContainer.className = 'sim-chart-container';

  // Fetch some metrics from DB
  const tablesInDb = compiledSchema.db_schema.tables.map(t => t.name.toLowerCase());
  
  // Create mock charts representing table distributions
  tablesInDb.forEach((tableName, index) => {
    const recordsCount = getTableRecords(tableName).length;
    // Cap percentage display
    const percentage = Math.min(100, Math.max(10, recordsCount * 15));

    const row = document.createElement('div');
    row.className = 'chart-bar-row';
    row.innerHTML = `
      <span class="chart-bar-label">${tableName.toUpperCase()}</span>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" id="bar-fill-${index}" style="width: 0%;"></div>
      </div>
      <span class="chart-bar-val">${recordsCount}</span>
    `;
    chartContainer.appendChild(row);

    // Trigger bar fill animation
    setTimeout(() => {
      const fill = document.getElementById(`bar-fill-${index}`);
      if (fill) fill.style.width = `${percentage}%`;
    }, 100);
  });

  card.appendChild(chartContainer);
  container.appendChild(card);
}

function renderPaymentButtonWidget(widget, container) {
  const card = document.createElement('div');
  card.className = 'widget-form';
  card.style.maxWidth = '360px';
  card.innerHTML = `
    <h4>${widget.title}</h4>
    <p style="font-size:12px; color:var(--color-text-muted); margin-bottom:12px;">Initiate a payment billing run to upgrade your active status.</p>
    <button class="btn btn-primary btn-block" onclick="openCheckoutModal()">Upgrade Simulator</button>
  `;
  container.appendChild(card);
}

// ==========================================================================
// DB VISUALIZER PANEL
// ==========================================================================

function syncDbVisualizer() {
  const container = document.getElementById('db-tables-container');
  if (!container) return;

  if (!compiledSchema || !compiledSchema.db_schema) {
    container.innerHTML = `<div class="db-placeholder">No active DB schema loaded.</div>`;
    return;
  }

  container.innerHTML = "";
  const tables = compiledSchema.db_schema.tables || [];

  tables.forEach(table => {
    const box = document.createElement('div');
    box.className = 'db-table-box';
    
    // Header
    const records = getTableRecords(table.name);
    box.innerHTML = `<div class="db-table-title">TABLE: ${table.name.toLowerCase()} (${records.length} records)</div>`;

    // Table data
    const recordsWrapper = document.createElement('div');
    recordsWrapper.className = 'table-wrapper';
    
    if (records.length === 0) {
      recordsWrapper.innerHTML = `<p style="font-size:10px; color:var(--color-text-muted); padding:8px 12px; font-family:var(--font-mono)">Empty</p>`;
    } else {
      const tbl = document.createElement('table');
      tbl.style.fontSize = '10px';
      
      const fields = Object.keys(records[0]);
      let header = "<tr>";
      fields.forEach(f => header += `<th>${f}</th>`);
      header += "</tr>";
      tbl.innerHTML += header;

      records.forEach(row => {
        let rowHtml = "<tr>";
        fields.forEach(f => rowHtml += `<td>${row[f]}</td>`);
        rowHtml += "</tr>";
        tbl.innerHTML += rowHtml;
      });
      recordsWrapper.appendChild(tbl);
    }
    box.appendChild(recordsWrapper);
    container.appendChild(box);
  });
}

// Toggle Local DB drawer
document.getElementById('db-header-toggle').onclick = () => {
  const body = document.getElementById('db-visualizer-body');
  const icon = document.querySelector('#db-header-toggle .toggle-icon');
  body.classList.toggle('collapsed');
  icon.classList.toggle('collapsed');
};

// ==========================================================================
// MODAL CONTROLS & CHECKOUT WORKFLOWS
// ==========================================================================

function openCheckoutModal() {
  document.getElementById('checkout-modal').style.display = 'flex';
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').style.display = 'none';
}

document.getElementById('close-checkout').onclick = closeCheckoutModal;

document.getElementById('pay-confirm-btn').onclick = () => {
  isPremiumPaid = true;
  document.getElementById('sim-premium-checkbox').checked = true;
  closeCheckoutModal();
  
  // Auto-upgrade role to PremiumUser if gating requires it
  const pg = compiledSchema?.business_rules?.premiumGating;
  if (pg && pg.premiumRole) {
    activeRole = pg.premiumRole;
    // Sync Role selector UI dropdown options
    const roleSelect = document.getElementById('sim-role-select');
    let exists = false;
    for (let i = 0; i < roleSelect.options.length; i++) {
      if (roleSelect.options[i].value === activeRole) exists = true;
    }
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = activeRole;
      opt.innerText = activeRole;
      roleSelect.appendChild(opt);
    }
    roleSelect.value = activeRole;
  }

  rebuildSidebarNav();
  renderPageContent(activePage);
  alert("🎉 Payment Successful! Gated Analytics unlocked.");
};

// Sync simulator role switches
document.getElementById('sim-role-select').onchange = (e) => {
  activeRole = e.target.value;
  rebuildSidebarNav();
  renderPageContent(activePage);
};

// Sync simulator Premium checkbox switches
document.getElementById('sim-premium-checkbox').onchange = (e) => {
  isPremiumPaid = e.target.checked;
  const pg = compiledSchema?.business_rules?.premiumGating;
  if (isPremiumPaid && pg && pg.premiumRole) {
    activeRole = pg.premiumRole;
    const roleSelect = document.getElementById('sim-role-select');
    if (!roleSelect.innerHTML.includes(activeRole)) {
      const opt = document.createElement('option');
      opt.value = activeRole;
      opt.innerText = activeRole;
      roleSelect.appendChild(opt);
    }
    roleSelect.value = activeRole;
  } else if (!isPremiumPaid) {
    activeRole = "Guest";
    document.getElementById('sim-role-select').value = "Guest";
  }
  rebuildSidebarNav();
  renderPageContent(activePage);
};

// ==========================================================================
// COMPILATION CLIENT ACTIONS & STAGE PROGRESS LOGGING
// ==========================================================================

let currentTab = "db";
const tabButtons = document.querySelectorAll('.tab-btn');
tabButtons.forEach(btn => {
  btn.onclick = () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.getAttribute('data-tab');
    renderSchemaView();
  };
});

function renderSchemaView() {
  const codeBlock = document.querySelector('#schema-pre code');
  if (!compiledSchema) return;

  let schemaToDraw = {};
  if (currentTab === 'full') {
    schemaToDraw = compiledSchema;
  } else {
    const key = `${currentTab}_schema`;
    schemaToDraw = compiledSchema[key] || compiledSchema[currentTab] || { error: `Layer ${currentTab} not found` };
  }

  codeBlock.innerText = JSON.stringify(schemaToDraw, null, 2);
}

document.getElementById('compile-btn').onclick = async () => {
  const prompt = document.getElementById('prompt-input').value.trim();
  const provider = document.getElementById('provider-select').value;
  const apiKey = document.getElementById('api-key-input').value.trim();

  if (!prompt) {
    alert("Please write a prompt before compiling.");
    return;
  }

  const compileBtn = document.getElementById('compile-btn');
  const spinner = compileBtn.querySelector('.spinner');
  const btnText = compileBtn.querySelector('.btn-text');
  compileBtn.disabled = true;
  spinner.style.display = 'inline-block';
  btnText.innerText = "Compiling Pipeline...";

  const logsContainer = document.getElementById('logs-container');
  logsContainer.innerHTML = ""; // Clear log screen

  // Clear stats
  document.getElementById('stat-latency').innerText = "Latency: --s";
  document.getElementById('stat-retries').innerText = "Repair Retries: 0";

  try {
    const res = await fetch('/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, provider, apiKey })
    });

    const data = await res.json();
    
    // Draw compiler logs stage-by-stage
    if (data.logs) {
      data.logs.forEach(entry => {
        addLogEntry(entry);
      });
    }

    if (res.ok && data.success) {
      compiledSchema = data.schemas;
      
      // Update stats
      document.getElementById('stat-latency').innerText = `Latency: ${(data.stats.totalLatencyMs / 1000).toFixed(2)}s`;
      document.getElementById('stat-retries').innerText = `Repair Retries: ${data.stats.repairRetries}`;

      // Show Schema inside Tabs
      renderSchemaView();

      // Populate Role Selector Dropdown
      const roleSelect = document.getElementById('sim-role-select');
      roleSelect.innerHTML = "";
      (compiledSchema.auth_schema.roles || ["Guest"]).forEach(role => {
        const opt = document.createElement('option');
        opt.value = role;
        opt.innerText = role;
        roleSelect.appendChild(opt);
      });
      activeRole = compiledSchema.auth_schema.defaultRole || "Guest";
      roleSelect.value = activeRole;

      // Reset payment status
      isPremiumPaid = false;
      document.getElementById('sim-premium-checkbox').checked = false;

      // Initialize database structure
      localStorage.clear();
      initLocalDb(compiledSchema.db_schema);

      // Render App Inside Simulator
      renderApp(compiledSchema);
    } else {
      addLogEntry({
        stage: "Compiler Error",
        message: data.error || "Compilation failed on a syntax/execution constraint."
      });
      alert(`Compilation failed: ${data.error}`);
    }

  } catch (err) {
    console.error(err);
    addLogEntry({
      stage: "Network Error",
      message: `Failed to talk to compiler API: ${err.message}`
    });
    alert(`Connection Error`);
  } finally {
    compileBtn.disabled = false;
    spinner.style.display = 'none';
    btnText.innerText = "Compile App";
  }
};

function addLogEntry(entry) {
  const container = document.getElementById('logs-container');
  
  const placeholder = container.querySelector('.log-placeholder');
  if (placeholder) placeholder.remove();

  const entryDiv = document.createElement('div');
  
  let typeClass = "";
  if (entry.message.toLowerCase().includes('success') || entry.message.toLowerCase().includes('passed')) {
    typeClass = "stage-success";
  } else if (entry.message.toLowerCase().includes('failed') || entry.message.toLowerCase().includes('error')) {
    typeClass = "stage-fail";
  } else {
    typeClass = "stage-start";
  }

  entryDiv.className = `log-entry ${typeClass}`;
  const time = new Date(entry.timestamp || Date.now()).toLocaleTimeString();

  let detailsHtml = "";
  if (entry.details) {
    const detailsId = `log-details-${Math.random().toString(36).substr(2, 9)}`;
    detailsHtml = `
      <span class="log-details-toggle" onclick="document.getElementById('${detailsId}').style.display = document.getElementById('${detailsId}').style.display === 'none' ? 'block' : 'none'">View Payload Details</span>
      <div class="log-details-block" id="${detailsId}" style="display:none;">
        <pre><code style="font-size:10px; color:#a7b2c1;">${JSON.stringify(entry.details, null, 2)}</code></pre>
      </div>
    `;
  }

  entryDiv.innerHTML = `
    <div class="log-header">
      <span class="log-stage-name">${entry.stage}</span>
      <span class="log-time">${time}</span>
    </div>
    <div class="log-message">${entry.message}</div>
    ${detailsHtml}
  `;

  container.appendChild(entryDiv);
  container.scrollTop = container.scrollHeight;
}

// ==========================================================================
// EVALUATOR INTERFACE INTEGRATION
// ==========================================================================

document.getElementById('run-eval-btn').onclick = async () => {
  const provider = document.getElementById('provider-select').value;
  const apiKey = document.getElementById('api-key-input').value.trim();

  const runBtn = document.getElementById('run-eval-btn');
  runBtn.disabled = true;
  runBtn.innerText = "Evaluating Suite...";

  const tableBody = document.getElementById('eval-table-body');
  tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Evaluating 20 Prompts sequentially. This can take up to 2-3 minutes. Please wait...</td></tr>`;
  document.getElementById('eval-results-container').style.display = 'block';

  try {
    const res = await fetch('/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to complete evaluation run.");
    }

    const report = await res.json();

    // Render Stats
    document.getElementById('eval-success-rate').innerText = `${(report.summary.successRate * 100).toFixed(0)}%`;
    document.getElementById('eval-avg-latency').innerText = `${(report.summary.avgLatencyMs / 1000).toFixed(2)}s`;
    document.getElementById('eval-avg-retries').innerText = report.summary.avgRepairRetries.toFixed(1);

    // Populate Table
    tableBody.innerHTML = "";
    report.results.forEach(tc => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${tc.id}</strong>: ${tc.name}</td>
        <td><span class="badge" style="background-color:rgba(255,255,255,0.05); color:#fff;">${tc.type}</span></td>
        <td>
          <span class="status-pill ${tc.success ? 'success' : 'fail'}">
            ${tc.success ? 'SUCCESS' : 'FAILED'}
          </span>
        </td>
        <td>${tc.repairRetries}</td>
        <td>${(tc.latencyMs / 1000).toFixed(2)}s</td>
      `;
      tableBody.appendChild(tr);
    });

    alert("🎉 Evaluation Suite completed successfully!");
  } catch (err) {
    console.error(err);
    alert(`Evaluation Run Failed: ${err.message}`);
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--color-danger)">Evaluation failed: ${err.message}</td></tr>`;
  } finally {
    runBtn.disabled = false;
    runBtn.innerText = "Run Eval Suite";
  }
};
