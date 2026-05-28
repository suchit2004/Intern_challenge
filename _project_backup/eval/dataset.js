const PRODUCT_PROMPTS = [
  {
    id: "prod-1",
    name: "CRM Application",
    prompt: "Build a CRM with contacts, leads, accounts, sales pipelines, dashboard widgets for monthly contacts growth, role access for Admins and Sales Agents."
  },
  {
    id: "prod-2",
    name: "E-Commerce Storefront",
    prompt: "Create an e-commerce platform. Items list, cart, and payment checkout screen. Premium plan unlocks advanced analytics."
  },
  {
    id: "prod-3",
    name: "Hospital Management",
    prompt: "Design a Hospital Management System with patients registry, doctors schedule, appointments booking form, role-based access for Admin, Doctor, and Patient."
  },
  {
    id: "prod-4",
    name: "School Manager Portal",
    prompt: "Build a School Manager app with students database, class rosters, attendance records, exam grade analytics dashboard. Roles: Teacher, Student, Principal."
  },
  {
    id: "prod-5",
    name: "Support Tickets Tracker",
    prompt: "Build a support ticket tracker. Forms for clients to submit issues, tables for agent queue, analytics dashboard for ticket status, premium payment gating for priority queue."
  },
  {
    id: "prod-6",
    name: "HR Management System",
    prompt: "Design an HR dashboard with employee directory, payroll management, holiday request form, monthly hiring metrics chart. Roles: HR, Employee."
  },
  {
    id: "prod-7",
    name: "Gym Member Portal",
    prompt: "Create a Gym Membership tracker. Member profile forms, attendance check-in, dashboard showing active members, payments subscription upgrade for VIP locker access."
  },
  {
    id: "prod-8",
    name: "Event Planning System",
    prompt: "Build an Event Management System with events calendar, guest RSVP tracker, ticket booking form, and budget analytics dashboard."
  },
  {
    id: "prod-9",
    name: "Project Management Board",
    prompt: "Build a PM board with projects directory, task cards, task assign form, sprint velocity metrics chart. Roles: Manager, Developer."
  },
  {
    id: "prod-10",
    name: "Inventory & Supplier Hub",
    prompt: "Design an inventory manager. Products table, stock replenishment form, supplier list, low-stock warnings dashboard metrics."
  }
];

const EDGE_CASE_PROMPTS = [
  {
    id: "edge-1",
    name: "Vague - Minimal Requirements",
    prompt: "Make a dashboard website."
  },
  {
    id: "edge-2",
    name: "Vague - No Context",
    prompt: "Create a system with pages and forms."
  },
  {
    id: "edge-3",
    name: "Conflicting Auth Roles",
    prompt: "Create a blog where guests can edit posts but only logged-in writers can view them."
  },
  {
    id: "edge-4",
    name: "Conflicting Logic Gating",
    prompt: "Build an app where VIP premium members get standard analytics but free members can see all paid analytics charts."
  },
  {
    id: "edge-5",
    name: "Incomplete Premium Logic",
    prompt: "Build a premium payment system but don't specify what is premium or gated."
  },
  {
    id: "edge-6",
    name: "Incomplete DB Specs",
    prompt: "Simple list app showing contacts but do not specify if we need a database table."
  },
  {
    id: "edge-7",
    name: "Incomplete User Permissions",
    prompt: "Build a message board where some users can delete anything and others can only post."
  },
  {
    id: "edge-8",
    name: "Conflicting Access Privileges",
    prompt: "Create an admin portal where admins are blocked from seeing analytics but normal users can see everything."
  },
  {
    id: "edge-9",
    name: "Vague Product Blueprint",
    prompt: "E-commerce app with checkout and stuff."
  },
  {
    id: "edge-10",
    name: "Incomplete Subscriptions",
    prompt: "Create a premium portal."
  }
];

module.exports = { PRODUCT_PROMPTS, EDGE_CASE_PROMPTS };
