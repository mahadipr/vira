/**
 * Handle login form submission
 * Fetches users from MockAPI and validates credentials
 */
async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorEl = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');

  // Reset error
  errorEl.classList.remove('show');

  // Validate
  if (!username || !password) {
    showLoginError('Harap isi semua kolom!');
    return false;
  }

  // Show loading state
  loginBtn.textContent = 'Memproses...';
  loginBtn.disabled = true;

  try {
    // Fetch users from MockAPI (Akun 1)
    const users = await apiGetUsers();

    // Cek apakah username & password cocok dengan salah satu akun
    const akun = users.find(a => a.username === username && a.password === password);

    if (akun) {
      // Login success – save session
      sessionStorage.setItem('inventori_session', JSON.stringify({
        loggedIn: true,
        username: akun.username,
        role: akun.role,
        userId: akun.id,
        loginTime: new Date().toISOString()
      }));

      // Redirect to main page
      window.location.href = 'index.html';
    } else {
      showLoginError('Username atau password salah!');
      loginBtn.textContent = 'Masuk';
      loginBtn.disabled = false;

      // Shake the input fields
      document.getElementById('username').focus();
    }
  } catch (error) {
    console.error('Login error:', error);
    showLoginError('Gagal terhubung ke server. Periksa koneksi internet Anda.');
    loginBtn.textContent = 'Masuk';
    loginBtn.disabled = false;
  }

  return false;
}

/**
 * Show error message with animation
 */
function showLoginError(message) {
  const errorEl = document.getElementById('loginError');
  const msgEl = document.getElementById('loginErrorMsg');
  msgEl.textContent = message;
  errorEl.classList.remove('show');

  // Force reflow for re-animation
  void errorEl.offsetWidth;
  errorEl.classList.add('show');
}

/**
 * Check if already logged in
 */
function checkExistingSession() {
  const session = sessionStorage.getItem('inventori_session');
  if (session) {
    try {
      const data = JSON.parse(session);
      if (data.loggedIn) {
        window.location.href = 'index.html';
      }
    } catch (e) {
      sessionStorage.removeItem('inventori_session');
    }
  }
}

// Run on page load
checkExistingSession();

// Allow Enter key submission
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('loginError').classList.remove('show');
    document.getElementById('username').focus();
  }
});
