/**
 * Authentication utility functions
 */

// Check if the user is authenticated
function isAuthenticated() {
  const token = localStorage.getItem('access_token');
  return token !== null && token !== undefined;
}

// Get the authentication token
function getAuthToken() {
  return localStorage.getItem('access_token');
}

// Set the authentication token
function setAuthToken(token) {
  localStorage.setItem('access_token', token);
}

// Clear the authentication token (logout)
function clearAuthToken() {
  localStorage.removeItem('access_token');
}

// Add authentication headers to fetch options
function addAuthHeader(options = {}) {
  const token = getAuthToken();
  
  if (!token) {
    return options;
  }
  
  // Create headers if they don't exist
  if (!options.headers) {
    options.headers = {};
  }
  
  // Add Authorization header with Bearer token
  options.headers['Authorization'] = `Bearer ${token}`;
  
  return options;
}

// Check token validity and redirect to login if invalid
function checkTokenValidity() {
  if (!isAuthenticated()) {
    return Promise.reject('No authentication token');
  }
  
  return fetch('/api/validate-token', addAuthHeader())
    .then(response => {
      if (!response.ok) {
        if (response.status === 401) {
          // Token is invalid or expired
          clearAuthToken();
          window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
          return Promise.reject('Invalid token');
        }
        return Promise.reject('Token validation error');
      }
      return response.json();
    })
    .then(data => {
      if (!data.valid) {
        clearAuthToken();
        window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
        return Promise.reject('Invalid token');
      }
      return data;
    });
}

// Redirect to login if not authenticated
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname);
    return false;
  }
  return true;
}

// Handle login
function handleLogin(username, password, rememberMe = false) {
  return fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username,
      password,
      remember: rememberMe
    })
  })
  .then(response => {
    if (!response.ok) {
      return response.json().then(err => Promise.reject(err));
    }
    return response.json();
  })
  .then(data => {
    if (data.success && data.token) {
      setAuthToken(data.token);
      return data;
    }
    return Promise.reject(data);
  });
}

// Handle logout
function handleLogout() {
  const token = getAuthToken();
  if (!token) {
    window.location.href = '/login';
    return Promise.resolve();
  }
  
  return fetch('/api/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })
  .then(() => {
    clearAuthToken();
    window.location.href = '/login';
  })
  .catch(() => {
    // Even if the server request fails, we still want to clear the token locally
    clearAuthToken();
    window.location.href = '/login';
  });
}
