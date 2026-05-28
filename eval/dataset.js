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
    name: "Task & Project Management",
    prompt: "Create a project management board with tasks, lists, checklists, and status tracking (Todo, Doing, Done). Admin and Editor roles can write, Guest can read."
  },
  {
    id: "prod-4",
    name: "Billing & Invoice System",
    prompt: "Create a billing app. Table for invoices, clients database, payment receipts. Premium users get payment gating checkout button."
  },
  {
    id: "prod-5",
    name: "Hospital Management",
    prompt: "Patient records database, doctor appointment scheduling calendar, doctor specialty list. Receptionist manages appointments, doctors see analytics."
  },
  {
    id: "prod-6",
    name: "SaaS Feedback Dashboard",
    prompt: "Analytics charts widget, user feedback submission forms, user profile settings. Premium gating for advanced analytics page."
  },
  {
    id: "prod-7",
    name: "School Grade Portal",
    prompt: "Students registry, class timetables, teachers list, grades. Admins can edit grades, students can only view grades."
  },
  {
    id: "prod-8",
    name: "Fitness Workout Tracker",
    prompt: "Workout exercises log, calorie counters, goals setting metrics dashboard. Premium unlocks customized workout plan dashboard."
  },
  {
    id: "prod-9",
    name: "Inventory Control System",
    prompt: "Products catalog, suppliers database, stock level status metrics. Managers can adjust stock, view-only users can read."
  },
  {
    id: "prod-10",
    name: "Customer Support Tickets",
    prompt: "Customer tickets registry, agent assignment, status logs (Open, Pending, Closed). Admin role can view statistics dashboard."
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
    name: "Conflicting Auth Roles",
    prompt: "Create a blog where guests can edit posts but only logged-in writers can view them."
  },
  {
    id: "edge-3",
    name: "Missing Database Table",
    prompt: "Create a website displaying contacts metric widget, but no contacts table was requested."
  },
  {
    id: "edge-4",
    name: "Incorrect API Paths Mismatch",
    prompt: "Create a website with form submitting to /api/post-comment, but API endpoints are /api/comments."
  },
  {
    id: "edge-5",
    name: "Empty User Input",
    prompt: "     "
  },
  {
    id: "edge-6",
    name: "Nonsensical Prompt",
    prompt: "bananas and apples cataloging with astronaut control rooms"
  },
  {
    id: "edge-7",
    name: "Role Escalation Security Check",
    prompt: "Let Guest users delete records, but only Admins can add them."
  },
  {
    id: "edge-8",
    name: "Overly Complex Payment Flow",
    prompt: "A premium CRM where every single page is gated behind premium subscription checkout."
  },
  {
    id: "edge-9",
    name: "Nested Database Relations",
    prompt: "Create a forum with categories, topics, and posts. Posts reference topics, topics reference categories."
  },
  {
    id: "edge-10",
    name: "Huge Scale Application",
    prompt: "Create a portal with 15 different entities and 10 different roles."
  }
];

module.exports = { PRODUCT_PROMPTS, EDGE_CASE_PROMPTS };