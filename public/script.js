
const API = "/api";
const $ = (id) => document.getElementById(id);

let token = localStorage.getItem("expenseToken");
let currentUser = JSON.parse(localStorage.getItem("expenseUser") || "null");
let expenses = [];

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR"
  }).format(Number(value) || 0);
}

function message(id, text, type = "") {
  $(id).textContent = text;
  $(id).className = `message ${type}`;
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (options.body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && token) logout(false);
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

function showAuth() {
  $("authSection").classList.remove("hidden");
  $("dashboardSection").classList.add("hidden");
  $("logoutBtn").classList.add("hidden");
  $("profileBtn").classList.add("hidden");
  $("welcomeUser").textContent = "";
}

function showDashboard() {
  $("authSection").classList.add("hidden");
  $("dashboardSection").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
  $("profileBtn").classList.remove("hidden");
  $("welcomeUser").textContent = `Hi, ${currentUser?.name || "there"}`;
}

function logout(showMessage = true) {
  token = null;
  currentUser = null;
  expenses = [];
  localStorage.removeItem("expenseToken");
  localStorage.removeItem("expenseUser");
  showAuth();
  if (showMessage) message("authMessage", "You have logged out.", "success");
}

function switchAuth(mode) {
  const login = mode === "login";
  $("loginForm").classList.toggle("hidden", !login);
  $("registerForm").classList.toggle("hidden", login);
  $("showLogin").classList.toggle("active", login);
  $("showRegister").classList.toggle("active", !login);
  message("authMessage", "");
}

$("showLogin").addEventListener("click", () => switchAuth("login"));
$("showRegister").addEventListener("click", () => switchAuth("register"));
$("logoutBtn").addEventListener("click", () => logout());

$("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  message("authMessage", "Creating your account...");

  try {
    const data = await api("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: $("registerName").value.trim(),
        email: $("registerEmail").value.trim(),
        password: $("registerPassword").value
      })
    });

    token = data.token;
    currentUser = data.user;
    localStorage.setItem("expenseToken", token);
    localStorage.setItem("expenseUser", JSON.stringify(currentUser));
    $("registerForm").reset();
    showDashboard();
    await loadDashboard();
  } catch (error) {
    message("authMessage", error.message, "error");
  }
});

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  message("authMessage", "Logging in...");

  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("loginEmail").value.trim(),
        password: $("loginPassword").value
      })
    });

    token = data.token;
    currentUser = data.user;
    localStorage.setItem("expenseToken", token);
    localStorage.setItem("expenseUser", JSON.stringify(currentUser));
    $("loginForm").reset();
    showDashboard();
    await loadDashboard();
  } catch (error) {
    message("authMessage", error.message, "error");
  }
});

function openExpenseForm(expense = null) {
  $("expenseForm").reset();
  $("expenseId").value = expense?._id || "";
  $("expenseFormTitle").textContent = expense ? "Edit expense" : "Add an expense";
  $("expenseTitle").value = expense?.title || "";
  $("expenseAmount").value = expense?.amount ?? "";
  $("expenseCategory").value = expense?.category || "";
  $("expenseDate").value = expense?.date
    ? new Date(expense.date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  $("expenseNotes").value = expense?.notes || "";
  $("expenseFormPanel").classList.remove("hidden");
  $("expenseFormPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  message("expenseMessage", "");
}

$("addExpenseBtn").addEventListener("click", () => openExpenseForm());
$("cancelExpenseBtn").addEventListener("click", () => {
  $("expenseFormPanel").classList.add("hidden");
});

$("expenseForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("expenseId").value;

  const payload = {
    title: $("expenseTitle").value.trim(),
    amount: Number($("expenseAmount").value),
    category: $("expenseCategory").value,
    date: $("expenseDate").value,
    notes: $("expenseNotes").value.trim()
  };

  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    message("expenseMessage", "Enter an amount greater than zero.", "error");
    return;
  }

  try {
    await api(id ? `/expenses/${id}` : "/expenses", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });

    message("expenseMessage", id ? "Expense updated!" : "Expense added!", "success");
    $("expenseFormPanel").classList.add("hidden");
    await loadDashboard();
  } catch (error) {
    message("expenseMessage", error.message, "error");
  }
});

function renderExpenses(items) {
  const body = $("expenseTableBody");
  body.replaceChildren();
  $("emptyMessage").classList.toggle("hidden", items.length > 0);

  for (const expense of items) {
    const tr = document.createElement("tr");

    function cell(text, className = "") {
      const td = document.createElement("td");
      td.textContent = text;
      if (className) td.className = className;
      return td;
    }

    tr.appendChild(cell(expense.title));
    const categoryCell = cell("");
    const pill = document.createElement("span");
    pill.className = "category-pill";
    pill.textContent = expense.category;
    categoryCell.appendChild(pill);
    tr.appendChild(categoryCell);

    tr.appendChild(cell(new Date(expense.date).toLocaleDateString("en-IN")));
    tr.appendChild(cell(money(expense.amount), "amount"));

    const actionCell = cell("");
    const actions = document.createElement("div");
    actions.className = "actions";

    const edit = document.createElement("button");
    edit.className = "small-btn";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => openExpenseForm(expense));

    const remove = document.createElement("button");
    remove.className = "small-btn delete-btn";
    remove.textContent = "Delete";
    remove.addEventListener("click", async () => {
      if (!confirm(`Delete "${expense.title}"?`)) return;

      try {
        await api(`/expenses/${expense._id}`, { method: "DELETE" });
        await loadDashboard();
      } catch (error) {
        alert(error.message);
      }
    });

    actions.append(edit, remove);
    actionCell.appendChild(actions);
    tr.appendChild(actionCell);
    body.appendChild(tr);
  }
}

async function loadSummaries() {
  const [total, monthly, categories] = await Promise.all([
    api("/expenses/summary/total"),
    api("/expenses/summary/monthly"),
    api("/expenses/summary/category")
  ]);

  $("totalAmount").textContent = money(total.total);
  $("expenseCount").textContent = total.count;

  const now = new Date();
  const currentMonth = monthly.find((item) =>
    item._id.year === now.getFullYear() &&
    item._id.month === now.getMonth() + 1
  );

  $("monthlyAmount").textContent = money(currentMonth?.total || 0);

  $("monthlySummary").replaceChildren();
  if (!monthly.length) {
    $("monthlySummary").textContent = "No monthly data yet.";
  } else {
    monthly.slice(0, 6).forEach((item) => {
      const row = document.createElement("div");
      row.className = "summary-row";
      const date = new Date(item._id.year, item._id.month - 1, 1);
      const label = date.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric"
      });
      const name = document.createElement("span");
      name.textContent = label;
      const amount = document.createElement("strong");
      amount.textContent = money(item.total);
      row.append(name, amount);
      $("monthlySummary").appendChild(row);
    });
  }

  $("categorySummary").replaceChildren();
  if (!categories.length) {
    $("categorySummary").textContent = "No category data yet.";
  } else {
    categories.forEach((item) => {
      const row = document.createElement("div");
      row.className = "summary-row";
      const name = document.createElement("span");
      name.textContent = `${item._id} (${item.count})`;
      const amount = document.createElement("strong");
      amount.textContent = money(item.total);
      row.append(name, amount);
      $("categorySummary").appendChild(row);
    });
  }
}

async function loadExpenses() {
  const params = new URLSearchParams();
  const search = $("searchInput").value.trim();
  const category = $("filterCategory").value;
  const startDate = $("filterStart").value;
  const endDate = $("filterEnd").value;

  if (search) params.set("search", search);
  if (category) params.set("category", category);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);

  const query = params.toString();
  expenses = await api(`/expenses${query ? `?${query}` : ""}`);
  renderExpenses(expenses);
}

async function loadDashboard() {
  try {
    await Promise.all([loadExpenses(), loadSummaries()]);
  } catch (error) {
    message("expenseMessage", error.message, "error");
  }
}


$("applyFiltersBtn").onclick = async () => {
  try {
    await loadExpenses();
  } catch (error) {
    console.error("Apply Filters error:", error);
    alert("Could not apply filters: " + error.message);
  }
};

$("clearFiltersBtn").onclick = async () => {
  $("searchInput").value = "";
  $("filterCategory").value = "";
  $("filterStart").value = "";
  $("filterEnd").value = "";

  try {
    await loadExpenses();
  } catch (error) {
    console.error("Clear Filters error:", error);
    alert("Could not clear filters: " + error.message);
  }
};


$("profileBtn").addEventListener("click", () => {
  $("profilePanel").classList.remove("hidden");
  $("profileName").value = currentUser?.name || "";
  $("profileEmail").value = currentUser?.email || "";
  $("profilePanel").scrollIntoView({ behavior: "smooth" });
});

$("closeProfileBtn").addEventListener("click", () => {
  $("profilePanel").classList.add("hidden");
});


$("profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = $("profileName").value.trim();

  if (!name) {
    message("profileMessage", "Please enter your name.", "error");
    return;
  }

  try {
    const data = await api("/auth/profile", {
      method: "PUT",
      body: JSON.stringify({ name })
    });

    currentUser = data.user;
    localStorage.setItem("expenseUser", JSON.stringify(currentUser));

    $("welcomeUser").textContent = `Hi, ${currentUser.name}`;

    message("profileMessage", "Profile updated successfully!", "success");
  } catch (error) {
    message("profileMessage", error.message, "error");
  }
});


async function init() {
  if (!token || !currentUser) {
    showAuth();
    return;
  }

  showDashboard();
  await loadDashboard();
}

init();
