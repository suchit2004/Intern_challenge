// Global state variables
let compiledSchema = null;
let activePage = "";
let activeRole = "Guest";
let isPremiumPaid = false;

function renderApp(schema) {
  const canvas = document.getElementById('app-canvas');
  canvas.innerHTML = "";
  const sidebarPages = schema.ui_schema.pages || [];
  if (sidebarPages.length === 0) return;

  const appContainer = document.createElement('div');
  appContainer.className = 'live-app-container';
  const sidebar = document.createElement('aside');
  sidebar.className = 'live-app-sidebar';
  sidebar.innerHTML = `<div class="sidebar-title">${schema.projectName}</div><ul class="nav-list" id="sim-nav-list"></ul>`;
  appContainer.appendChild(sidebar);

  const contentArea = document.createElement('div');
  contentArea.className = 'live-app-content';
  contentArea.innerHTML = `
    <header class="live-app-header">
      <h3 id="sim-page-title">Page</h3>
      <div id="sim-user-status">Role: ${activeRole}</div>
    </header>
    <div class="live-app-body" id="sim-page-body"></div>`;
  appContainer.appendChild(contentArea);
  canvas.appendChild(appContainer);

  rebuildSidebarNav();
  switchPage(sidebarPages[0].name);
}

function rebuildSidebarNav() {
  const navList = document.getElementById('sim-nav-list');
  if (!navList || !compiledSchema) return;
  navList.innerHTML = "";
  compiledSchema.ui_schema.pages.forEach(page => {
    if (!page.rolesAllowed.includes(activeRole)) return;
    const li = document.createElement('li');
    li.innerHTML = `<button class="nav-item-btn" onclick="switchPage('${page.name}')">${page.name}</button>`;
    navList.appendChild(li);
  });
}

function switchPage(name) {
  activePage = name;
  document.getElementById('sim-page-title').innerText = name;
  renderPageContent(name);
}

function renderPageContent(name) {}