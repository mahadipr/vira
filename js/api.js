/* ============================================
   API.JS - Layer Komunikasi dengan MockAPI
   ============================================ */

// ============ BASE URLs ============
// Akun 1: users & items (dengan /api/v1/)
const API_BASE_1 = 'https://69cfcb33a4647a9fc675fccc.mockapi.io/api/v1';

// Akun 2: transactions & transaction_items
const API_BASE_2 = 'https://69fb742888a7af0ecca92874.mockapi.io/api/v1';

// ============ HELPER: FETCH WRAPPER ============
async function apiFetch(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // Handle 204 No Content (for DELETE)
    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error [${options.method || 'GET'} ${url}]:`, error);
    throw error;
  }
}

// ============ USERS (Akun 1) ============

/** GET semua users */
async function apiGetUsers() {
  return await apiFetch(`${API_BASE_1}/users`);
}

/** GET user by ID */
async function apiGetUser(id) {
  return await apiFetch(`${API_BASE_1}/users/${id}`);
}

/** POST user baru */
async function apiCreateUser(data) {
  return await apiFetch(`${API_BASE_1}/users`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============ ITEMS (Akun 1) ============

/** GET semua items */
async function apiGetItems() {
  return await apiFetch(`${API_BASE_1}/items`);
}

/** GET item by ID */
async function apiGetItem(id) {
  return await apiFetch(`${API_BASE_1}/items/${id}`);
}

/** POST item baru */
async function apiCreateItem(data) {
  return await apiFetch(`${API_BASE_1}/items`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** PUT update item */
async function apiUpdateItem(id, data) {
  return await apiFetch(`${API_BASE_1}/items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** DELETE hapus item */
async function apiDeleteItem(id) {
  return await apiFetch(`${API_BASE_1}/items/${id}`, {
    method: 'DELETE',
  });
}

// ============ TRANSACTIONS (Akun 2) ============

/** GET semua transactions */
async function apiGetTransactions() {
  return await apiFetch(`${API_BASE_2}/transactions`);
}

/** GET transaction by ID */
async function apiGetTransaction(id) {
  return await apiFetch(`${API_BASE_2}/transactions/${id}`);
}

/** POST transaction baru */
async function apiCreateTransaction(data) {
  return await apiFetch(`${API_BASE_2}/transactions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============ TRANSACTION ITEMS (Akun 2) ============

/** GET semua transaction items */
async function apiGetAllTransactionItems() {
  return await apiFetch(`${API_BASE_2}/transaction_items`);
}

/** GET transaction items by transactionId (filter) */
async function apiGetTransactionItemsByTxId(txId) {
  return await apiFetch(`${API_BASE_2}/transaction_items?transactionId=${txId}`);
}

/** POST transaction item baru */
async function apiCreateTransactionItem(data) {
  return await apiFetch(`${API_BASE_2}/transaction_items`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
