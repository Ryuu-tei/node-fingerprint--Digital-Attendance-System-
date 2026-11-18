/**
 * Main Application JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize tooltips if available
  if (typeof bootstrap !== 'undefined') {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }

  // Auto-hide only dismissible flash notifications. Some pages use .alert
  // elements as live status panels, and closing them removes them from the DOM.
  const alerts = document.querySelectorAll('.alert.alert-dismissible');
  alerts.forEach(alert => {
    setTimeout(() => {
      if (document.body.contains(alert)) {
        const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
        bsAlert.close();
      }
    }, 5000);
  });
});

/**
 * Fetch wrapper with error handling
 */
async function api(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;

  const container = document.querySelector('main') || document.body;
  container.insertBefore(alertDiv, container.firstChild);

  setTimeout(() => {
    if (document.body.contains(alertDiv)) {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(alertDiv);
      bsAlert.close();
    }
  }, 5000);
}

/**
 * Format date
 */
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format time
 */
function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':');
  return `${hours}:${minutes}`;
}

/**
 * Confirm action
 */
function confirmAction(message) {
  return confirm(message);
}

// Check bridge API status on dashboard
if (window.location.pathname.includes('/dashboard')) {
  fetch('/fingerprint/api/bridge-info')
    .then(res => res.json())
    .then(data => {
      const statusEl = document.getElementById('bridgeStatus');
      if (statusEl) {
        const bridge = data && data.data ? data.data : data;
        if (bridge && bridge.success && bridge.ready) {
          statusEl.className = 'badge bg-success';
          statusEl.textContent = 'Connected';
        } else if (bridge && bridge.success) {
          statusEl.className = 'badge bg-warning text-dark';
          statusEl.textContent = 'No Device';
        } else {
          statusEl.className = 'badge bg-danger';
          statusEl.textContent = 'Disconnected';
        }
      }
    })
    .catch(err => {
      const statusEl = document.getElementById('bridgeStatus');
      if (statusEl) {
        statusEl.className = 'badge bg-danger';
        statusEl.textContent = 'Error';
      }
    });
}
