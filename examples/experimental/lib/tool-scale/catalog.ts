export type ToolLocation = "server" | "client";

export interface ToolSeed {
  name: string;
  title: string;
  description: string;
  location: ToolLocation;
  category: string;
  group: string;
  profiles: string[];
  deferLoading: boolean;
  searchKeywords: string[];
}

interface ClusterDefinition {
  prefix: string;
  location: ToolLocation;
  category: string;
  group: string;
  profiles: string[];
  immediateCount: number;
  items: Array<{
    slug: string;
    title: string;
    description: string;
    keywords: string[];
  }>;
}

function createClusterTools(cluster: ClusterDefinition): ToolSeed[] {
  return cluster.items.map((item, index) => ({
    name: `${cluster.prefix}_${item.slug}`,
    title: item.title,
    description: item.description,
    location: cluster.location,
    category: cluster.category,
    group: cluster.group,
    profiles: cluster.profiles,
    deferLoading: true,
    // deferLoading: index >= cluster.immediateCount,
    searchKeywords: [
      cluster.category,
      cluster.group,
      ...cluster.profiles,
      ...item.keywords,
    ],
  }));
}

const SERVER_CLUSTERS: ClusterDefinition[] = [
  {
    prefix: "support",
    location: "server",
    category: "knowledge",
    group: "support",
    profiles: ["support", "research"],
    immediateCount: 2,
    items: [
      {
        slug: "search_product_docs",
        title: "Search product docs",
        description: "Find official product documentation for support answers.",
        keywords: ["docs", "product", "guide"],
      },
      {
        slug: "search_api_reference",
        title: "Search API reference",
        description:
          "Find API contracts, request formats, and SDK reference material.",
        keywords: ["api", "sdk", "reference"],
      },
      {
        slug: "find_setup_guides",
        title: "Find setup guides",
        description:
          "Locate setup and onboarding walkthroughs for new integrations.",
        keywords: ["setup", "onboarding", "installation"],
      },
      {
        slug: "find_migration_notes",
        title: "Find migration notes",
        description: "Locate migration checklists and breaking-change notes.",
        keywords: ["migration", "upgrade", "release"],
      },
      {
        slug: "lookup_security_faq",
        title: "Lookup security FAQ",
        description:
          "Retrieve security, privacy, and compliance answers for customers.",
        keywords: ["security", "privacy", "compliance"],
      },
      {
        slug: "lookup_pricing_matrix",
        title: "Lookup pricing matrix",
        description: "Find plan tiers, usage caps, and pricing notes.",
        keywords: ["pricing", "plans", "limits"],
      },
      {
        slug: "search_release_notes",
        title: "Search release notes",
        description: "Find release highlights, feature launches, and fixes.",
        keywords: ["release", "changelog", "feature"],
      },
      {
        slug: "find_troubleshooting_playbooks",
        title: "Find troubleshooting playbooks",
        description:
          "Retrieve support playbooks for common incidents and errors.",
        keywords: ["troubleshooting", "incident", "errors"],
      },
      {
        slug: "search_integration_cookbook",
        title: "Search integration cookbook",
        description: "Find integration recipes for common product setups.",
        keywords: ["integration", "cookbook", "recipes"],
      },
      {
        slug: "lookup_sla_policies",
        title: "Lookup SLA policies",
        description: "Find SLA, uptime, and support response policy details.",
        keywords: ["sla", "uptime", "policy"],
      },
    ],
  },
  {
    prefix: "finance",
    location: "server",
    category: "billing",
    group: "finance",
    profiles: ["support", "sales", "finance"],
    immediateCount: 2,
    items: [
      {
        slug: "get_invoice_status",
        title: "Get invoice status",
        description: "Check invoice status, payment attempts, and due dates.",
        keywords: ["invoice", "payment", "status"],
      },
      {
        slug: "get_plan_entitlements",
        title: "Get plan entitlements",
        description: "Inspect plan entitlements, seats, and included limits.",
        keywords: ["plan", "entitlements", "seats"],
      },
      {
        slug: "lookup_credit_balance",
        title: "Lookup credit balance",
        description:
          "Find remaining credits and rollover details for an account.",
        keywords: ["credits", "balance", "usage"],
      },
      {
        slug: "find_refund_policy",
        title: "Find refund policy",
        description:
          "Retrieve refund rules, eligibility criteria, and time windows.",
        keywords: ["refund", "policy", "eligibility"],
      },
      {
        slug: "get_contract_terms",
        title: "Get contract terms",
        description: "Inspect contract renewal dates and commercial terms.",
        keywords: ["contract", "renewal", "terms"],
      },
      {
        slug: "lookup_discount_rules",
        title: "Lookup discount rules",
        description:
          "Find discounting rules and approved commercial exceptions.",
        keywords: ["discount", "commercial", "pricing"],
      },
      {
        slug: "find_tax_guidance",
        title: "Find tax guidance",
        description:
          "Retrieve region-specific tax handling and invoicing notes.",
        keywords: ["tax", "region", "invoice"],
      },
      {
        slug: "get_overage_breakdown",
        title: "Get overage breakdown",
        description: "Inspect overage drivers and top consumption buckets.",
        keywords: ["overage", "consumption", "usage"],
      },
      {
        slug: "lookup_checkout_rules",
        title: "Lookup checkout rules",
        description: "Find checkout, trial, and subscription conversion rules.",
        keywords: ["checkout", "trial", "subscription"],
      },
      {
        slug: "find_procurement_packet",
        title: "Find procurement packet",
        description:
          "Locate procurement, vendor, and approval packet material.",
        keywords: ["procurement", "vendor", "security"],
      },
    ],
  },
  {
    prefix: "ops",
    location: "server",
    category: "operations",
    group: "admin",
    profiles: ["ops", "admin"],
    immediateCount: 2,
    items: [
      {
        slug: "check_incident_status",
        title: "Check incident status",
        description: "Review current incident state and impacted systems.",
        keywords: ["incident", "status", "systems"],
      },
      {
        slug: "get_usage_snapshot",
        title: "Get usage snapshot",
        description: "Inspect current usage and system-level traffic shape.",
        keywords: ["usage", "traffic", "snapshot"],
      },
      {
        slug: "lookup_rate_limit_state",
        title: "Lookup rate limit state",
        description: "Check rate-limit windows and throttling activity.",
        keywords: ["rate", "limit", "throttle"],
      },
      {
        slug: "find_feature_flags",
        title: "Find feature flags",
        description: "Inspect active feature flags for an environment.",
        keywords: ["feature", "flags", "environment"],
      },
      {
        slug: "resolve_workspace_owner",
        title: "Resolve workspace owner",
        description: "Find workspace ownership and escalation contacts.",
        keywords: ["workspace", "owner", "escalation"],
      },
      {
        slug: "inspect_team_roles",
        title: "Inspect team roles",
        description: "List team roles, permissions, and admin assignments.",
        keywords: ["team", "roles", "permissions"],
      },
      {
        slug: "review_audit_events",
        title: "Review audit events",
        description: "Search recent audit events and security changes.",
        keywords: ["audit", "security", "events"],
      },
      {
        slug: "lookup_region_status",
        title: "Lookup region status",
        description: "Check service health and capacity by region.",
        keywords: ["region", "health", "capacity"],
      },
      {
        slug: "find_data_retention_rules",
        title: "Find data retention rules",
        description: "Inspect retention windows and deletion policies.",
        keywords: ["retention", "deletion", "policy"],
      },
      {
        slug: "get_compliance_controls",
        title: "Get compliance controls",
        description: "Retrieve compliance control mappings and attestations.",
        keywords: ["compliance", "controls", "attestation"],
      },
    ],
  },
];

const CLIENT_CLUSTERS: ClusterDefinition[] = [
  {
    prefix: "browser",
    location: "client",
    category: "browser",
    group: "inspection",
    profiles: ["support", "workspace"],
    immediateCount: 2,
    items: [
      {
        slug: "inspect_dom_outline",
        title: "Inspect DOM outline",
        description: "Inspect the current page structure and headings.",
        keywords: ["dom", "html", "headings"],
      },
      {
        slug: "capture_visible_text",
        title: "Capture visible text",
        description: "Capture visible text content from the active page.",
        keywords: ["text", "content", "page"],
      },
      {
        slug: "find_primary_actions",
        title: "Find primary actions",
        description: "Locate the main buttons and calls to action on the page.",
        keywords: ["buttons", "cta", "actions"],
      },
      {
        slug: "find_form_fields",
        title: "Find form fields",
        description: "List form fields and labels available on the page.",
        keywords: ["form", "fields", "labels"],
      },
      {
        slug: "inspect_error_banner",
        title: "Inspect error banner",
        description: "Check for visible alert, toast, or error banners.",
        keywords: ["error", "alert", "toast"],
      },
      {
        slug: "extract_help_links",
        title: "Extract help links",
        description: "Collect help center and support links from the UI.",
        keywords: ["help", "support", "links"],
      },
      {
        slug: "scan_table_headers",
        title: "Scan table headers",
        description: "Inspect visible table headers and summary labels.",
        keywords: ["table", "headers", "data"],
      },
      {
        slug: "read_navigation_labels",
        title: "Read navigation labels",
        description: "List current navigation items and sidebar labels.",
        keywords: ["navigation", "sidebar", "menu"],
      },
      {
        slug: "detect_modal_state",
        title: "Detect modal state",
        description: "Check whether a modal or drawer is currently open.",
        keywords: ["modal", "drawer", "dialog"],
      },
      {
        slug: "inspect_page_metadata",
        title: "Inspect page metadata",
        description: "Read page title, URL path, and language metadata.",
        keywords: ["metadata", "url", "language"],
      },
    ],
  },
  {
    prefix: "browser",
    location: "client",
    category: "browser",
    group: "actions",
    profiles: ["support", "commerce"],
    immediateCount: 2,
    items: [
      {
        slug: "focus_search_box",
        title: "Focus search box",
        description: "Find and focus the main search input in the UI.",
        keywords: ["search", "input", "focus"],
      },
      {
        slug: "scroll_to_section",
        title: "Scroll to section",
        description: "Scroll the current page to a matching section.",
        keywords: ["scroll", "section", "page"],
      },
      {
        slug: "expand_accordion",
        title: "Expand accordion",
        description: "Expand a collapsed accordion or disclosure element.",
        keywords: ["accordion", "expand", "collapse"],
      },
      {
        slug: "copy_selected_text",
        title: "Copy selected text",
        description: "Copy highlighted or matched text from the page.",
        keywords: ["copy", "text", "selection"],
      },
      {
        slug: "highlight_form_errors",
        title: "Highlight form errors",
        description:
          "Identify invalid form fields and focus them for the user.",
        keywords: ["form", "errors", "validation"],
      },
      {
        slug: "open_help_center",
        title: "Open help center",
        description: "Open the help center from the current experience.",
        keywords: ["help", "center", "support"],
      },
      {
        slug: "dismiss_banner",
        title: "Dismiss banner",
        description: "Dismiss the active banner, toast, or notice if present.",
        keywords: ["dismiss", "toast", "banner"],
      },
      {
        slug: "toggle_preview_panel",
        title: "Toggle preview panel",
        description: "Toggle a preview or detail side panel in the interface.",
        keywords: ["preview", "panel", "toggle"],
      },
      {
        slug: "jump_to_checkout_step",
        title: "Jump to checkout step",
        description: "Move to a matching step in a checkout or wizard flow.",
        keywords: ["checkout", "wizard", "step"],
      },
      {
        slug: "activate_primary_tab",
        title: "Activate primary tab",
        description: "Switch to the primary or requested tab in a tab set.",
        keywords: ["tab", "switch", "navigation"],
      },
    ],
  },
  {
    prefix: "workspace",
    location: "client",
    category: "workspace",
    group: "documents",
    profiles: ["workspace", "support"],
    immediateCount: 2,
    items: [
      {
        slug: "open_doc_outline",
        title: "Open doc outline",
        description: "Open or summarize the current document outline.",
        keywords: ["document", "outline", "doc"],
      },
      {
        slug: "list_recent_files",
        title: "List recent files",
        description: "List the most recent files visible in the workspace.",
        keywords: ["recent", "files", "workspace"],
      },
      {
        slug: "find_comment_threads",
        title: "Find comment threads",
        description: "Inspect recent comment threads and unresolved notes.",
        keywords: ["comments", "threads", "notes"],
      },
      {
        slug: "detect_unpublished_changes",
        title: "Detect unpublished changes",
        description: "Check whether there are unpublished or unsaved edits.",
        keywords: ["publish", "draft", "changes"],
      },
      {
        slug: "read_doc_permissions",
        title: "Read doc permissions",
        description:
          "Inspect sharing and permission hints for the current doc.",
        keywords: ["sharing", "permissions", "access"],
      },
      {
        slug: "open_command_palette",
        title: "Open command palette",
        description: "Open the command palette for quick workspace actions.",
        keywords: ["command", "palette", "shortcut"],
      },
      {
        slug: "search_workspace_mentions",
        title: "Search workspace mentions",
        description: "Find mentions, assignments, and @references in the UI.",
        keywords: ["mentions", "assignments", "workspace"],
      },
      {
        slug: "inspect_publish_checks",
        title: "Inspect publish checks",
        description: "Inspect publishing checks, blockers, and warnings.",
        keywords: ["publish", "checks", "warnings"],
      },
      {
        slug: "find_content_templates",
        title: "Find content templates",
        description: "Find reusable templates and starter documents.",
        keywords: ["templates", "content", "starter"],
      },
      {
        slug: "review_editor_panels",
        title: "Review editor panels",
        description:
          "List editor panels, drawers, and sidebars currently visible.",
        keywords: ["editor", "panels", "sidebar"],
      },
    ],
  },
  {
    prefix: "workspace",
    location: "client",
    category: "workspace",
    group: "scheduling",
    profiles: ["workspace"],
    immediateCount: 2,
    items: [
      {
        slug: "list_calendar_slots",
        title: "List calendar slots",
        description:
          "Read available meeting slots in the current scheduling view.",
        keywords: ["calendar", "slots", "schedule"],
      },
      {
        slug: "find_upcoming_deadlines",
        title: "Find upcoming deadlines",
        description: "Find upcoming deadlines and due dates in the UI.",
        keywords: ["deadlines", "due", "dates"],
      },
      {
        slug: "inspect_task_board_columns",
        title: "Inspect task board columns",
        description: "Inspect the current task board lanes and counts.",
        keywords: ["task", "board", "kanban"],
      },
      {
        slug: "read_assignee_filters",
        title: "Read assignee filters",
        description: "Inspect active assignee and owner filters.",
        keywords: ["assignee", "owner", "filters"],
      },
      {
        slug: "find_blocked_tasks",
        title: "Find blocked tasks",
        description: "Locate blocked tasks or status badges in the board.",
        keywords: ["blocked", "tasks", "status"],
      },
      {
        slug: "open_meeting_notes",
        title: "Open meeting notes",
        description: "Open or summarize linked meeting notes.",
        keywords: ["meeting", "notes", "agenda"],
      },
      {
        slug: "read_project_milestones",
        title: "Read project milestones",
        description: "Inspect milestone labels and delivery checkpoints.",
        keywords: ["milestones", "delivery", "project"],
      },
      {
        slug: "find_status_updates",
        title: "Find status updates",
        description: "Collect recent project status updates from the UI.",
        keywords: ["status", "updates", "project"],
      },
      {
        slug: "inspect_backlog_filters",
        title: "Inspect backlog filters",
        description: "Review active backlog filters and search chips.",
        keywords: ["backlog", "filters", "search"],
      },
      {
        slug: "read_capacity_view",
        title: "Read capacity view",
        description: "Inspect team capacity and planned workload signals.",
        keywords: ["capacity", "planning", "workload"],
      },
    ],
  },
  {
    prefix: "commerce",
    location: "client",
    category: "commerce",
    group: "checkout",
    profiles: ["commerce", "support"],
    immediateCount: 2,
    items: [
      {
        slug: "read_cart_summary",
        title: "Read cart summary",
        description: "Read cart totals, quantities, and current items.",
        keywords: ["cart", "summary", "totals"],
      },
      {
        slug: "read_shipping_options",
        title: "Read shipping options",
        description: "Read current shipping methods and estimates.",
        keywords: ["shipping", "delivery", "estimates"],
      },
      {
        slug: "inspect_promo_field",
        title: "Inspect promo field",
        description: "Inspect the coupon or promotional code field state.",
        keywords: ["promo", "coupon", "discount"],
      },
      {
        slug: "find_payment_errors",
        title: "Find payment errors",
        description:
          "Check for visible payment failures or validation messages.",
        keywords: ["payment", "errors", "checkout"],
      },
      {
        slug: "read_subscription_selector",
        title: "Read subscription selector",
        description: "Inspect subscription plans visible in the purchase flow.",
        keywords: ["subscription", "plans", "purchase"],
      },
      {
        slug: "locate_tax_breakdown",
        title: "Locate tax breakdown",
        description: "Locate tax lines and fee breakdown in checkout.",
        keywords: ["tax", "fees", "breakdown"],
      },
      {
        slug: "capture_return_policy_banner",
        title: "Capture return policy banner",
        description:
          "Capture return or cancellation policy text from the page.",
        keywords: ["return", "cancellation", "policy"],
      },
      {
        slug: "find_saved_cards",
        title: "Find saved cards",
        description: "Inspect the saved payment methods shown in the UI.",
        keywords: ["cards", "payment", "saved"],
      },
      {
        slug: "read_checkout_steps",
        title: "Read checkout steps",
        description: "List the current steps in the checkout wizard.",
        keywords: ["checkout", "steps", "wizard"],
      },
      {
        slug: "inspect_order_notes",
        title: "Inspect order notes",
        description: "Inspect order notes and delivery instructions fields.",
        keywords: ["order", "notes", "delivery"],
      },
    ],
  },
  {
    prefix: "analytics",
    location: "client",
    category: "analytics",
    group: "dashboard",
    profiles: ["admin", "workspace"],
    immediateCount: 2,
    items: [
      {
        slug: "read_kpi_strip",
        title: "Read KPI strip",
        description: "Read the top KPI numbers visible in the dashboard.",
        keywords: ["kpi", "dashboard", "metrics"],
      },
      {
        slug: "inspect_chart_legend",
        title: "Inspect chart legend",
        description: "Inspect chart legends and visible series labels.",
        keywords: ["chart", "legend", "series"],
      },
      {
        slug: "find_date_filters",
        title: "Find date filters",
        description: "Inspect date-range filters applied in analytics views.",
        keywords: ["date", "filters", "analytics"],
      },
      {
        slug: "read_growth_badges",
        title: "Read growth badges",
        description:
          "Read trend indicators and growth badges in analytics cards.",
        keywords: ["growth", "trends", "badges"],
      },
      {
        slug: "inspect_funnel_steps",
        title: "Inspect funnel steps",
        description: "Inspect funnel stages and conversion labels.",
        keywords: ["funnel", "conversion", "stages"],
      },
      {
        slug: "capture_table_rows",
        title: "Capture table rows",
        description: "Capture the visible analytics table rows for analysis.",
        keywords: ["table", "rows", "analytics"],
      },
      {
        slug: "read_segment_chips",
        title: "Read segment chips",
        description: "Inspect active segments and cohort chips.",
        keywords: ["segments", "cohorts", "chips"],
      },
      {
        slug: "inspect_alert_thresholds",
        title: "Inspect alert thresholds",
        description:
          "Inspect threshold or anomaly settings in analytics widgets.",
        keywords: ["alerts", "thresholds", "anomaly"],
      },
      {
        slug: "find_export_actions",
        title: "Find export actions",
        description: "Locate CSV, export, or share actions for dashboards.",
        keywords: ["export", "csv", "share"],
      },
      {
        slug: "inspect_dashboard_tabs",
        title: "Inspect dashboard tabs",
        description: "Inspect top-level tabs and grouped analytics views.",
        keywords: ["tabs", "dashboard", "views"],
      },
    ],
  },
  {
    prefix: "utility",
    location: "client",
    category: "utility",
    group: "capture",
    profiles: ["support", "workspace", "admin"],
    immediateCount: 2,
    items: [
      {
        slug: "get_browser_locale",
        title: "Get browser locale",
        description:
          "Read the current browser locale and timezone information.",
        keywords: ["locale", "timezone", "browser"],
      },
      {
        slug: "get_window_dimensions",
        title: "Get window dimensions",
        description: "Read the current viewport and window size.",
        keywords: ["viewport", "window", "screen"],
      },
      {
        slug: "capture_selection_context",
        title: "Capture selection context",
        description:
          "Capture the current text selection and surrounding context.",
        keywords: ["selection", "context", "highlight"],
      },
      {
        slug: "read_clipboard_preview",
        title: "Read clipboard preview",
        description: "Read clipboard text preview when available.",
        keywords: ["clipboard", "copy", "paste"],
      },
      {
        slug: "capture_console_summary",
        title: "Capture console summary",
        description: "Capture a lightweight console message summary.",
        keywords: ["console", "logs", "errors"],
      },
      {
        slug: "inspect_network_summary",
        title: "Inspect network summary",
        description:
          "Inspect a lightweight summary of captured network requests.",
        keywords: ["network", "requests", "summary"],
      },
      {
        slug: "read_session_flags",
        title: "Read session flags",
        description:
          "Read temporary session flags relevant to the current page.",
        keywords: ["session", "flags", "state"],
      },
      {
        slug: "capture_page_snapshot",
        title: "Capture page snapshot",
        description: "Capture a lightweight page snapshot for later reasoning.",
        keywords: ["snapshot", "page", "capture"],
      },
      {
        slug: "inspect_focus_state",
        title: "Inspect focus state",
        description: "Inspect the currently focused element and nearby labels.",
        keywords: ["focus", "element", "labels"],
      },
      {
        slug: "read_keyboard_shortcuts",
        title: "Read keyboard shortcuts",
        description: "Read visible keyboard shortcuts or hotkey hints.",
        keywords: ["keyboard", "shortcuts", "hotkeys"],
      },
    ],
  },
];

export const serverToolSeeds = SERVER_CLUSTERS.flatMap(createClusterTools);
export const clientToolSeeds = CLIENT_CLUSTERS.flatMap(createClusterTools);
export const toolScaleSeeds = [...serverToolSeeds, ...clientToolSeeds];

export const toolScaleCounts = {
  total: toolScaleSeeds.length,
  server: serverToolSeeds.length,
  client: clientToolSeeds.length,
  deferred: toolScaleSeeds.filter((tool) => tool.deferLoading).length,
  immediate: toolScaleSeeds.filter((tool) => !tool.deferLoading).length,
};

export const toolScaleProfiles = [
  {
    id: "support",
    label: "Support",
    description:
      "Customer support, docs, billing, browser inspection, utility capture.",
  },
  {
    id: "workspace",
    label: "Workspace",
    description:
      "Project, document, scheduling, browser, and analytics collaboration tools.",
  },
  {
    id: "commerce",
    label: "Commerce",
    description: "Checkout, pricing, purchase, and customer-flow tools.",
  },
  {
    id: "admin",
    label: "Admin",
    description: "Operations, compliance, analytics, and governance tools.",
  },
];

export function getProfileToolStats(profile: string) {
  const tools = toolScaleSeeds.filter((tool) =>
    tool.profiles.includes(profile),
  );
  return {
    total: tools.length,
    immediate: tools.filter((tool) => !tool.deferLoading).length,
    deferred: tools.filter((tool) => tool.deferLoading).length,
    server: tools.filter((tool) => tool.location === "server").length,
    client: tools.filter((tool) => tool.location === "client").length,
    categories: Array.from(new Set(tools.map((tool) => tool.category))).sort(),
    groups: Array.from(new Set(tools.map((tool) => tool.group))).sort(),
  };
}
