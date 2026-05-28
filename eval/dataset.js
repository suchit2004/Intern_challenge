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
  }
];

module.exports = { PRODUCT_PROMPTS, EDGE_CASE_PROMPTS };