import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Initialize Supabase client
const supabaseClient = createClient(
  'https://lywylvbgsnmqwcwgiyhc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg'
);

// Map initialization state
let map;
let mapReadyResolver;
const mapReady = new Promise(resolve => {
  mapReadyResolver = resolve;
  window.mapReadyResolver = resolve;
});

let selectedCard = null;
let selectedMarker = null;
let markers = [];
let allRequests = [];
let notificationIcon;

const markerIcons = {
  default: { url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png', scaledSize: { width: 32, height: 32 } },
  selected: { url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png', scaledSize: { width: 32, height: 32 } }
};

// Load Google Maps API dynamically
function loadGoogleMapsAPI() {
  return new Promise((resolve, reject) => {
    console.log('Attempting to load Google Maps API');
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      console.log('Google Maps API script already present, checking status');
      if (window.google && window.google.maps) {
        console.log('Google Maps API already loaded');
        resolve();
      } else {
        existingScript.addEventListener('load', () => {
          console.log('Existing Google Maps API script loaded');
          if (window.google && window.google.maps) {
            resolve();
          } else {
            reject(new Error('Google Maps API loaded but not initialized'));
          }
        });
        existingScript.addEventListener('error', (e) => {
          console.error('Existing Google Maps API script failed to load:', e);
          reject(new Error('Failed to load existing Google Maps API script'));
        });
      }
      return;
    }
    console.log('Creating new Google Maps API script');
    const script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyAFM6HNEnxbn6_VvYaQ_o4n72VlAUajgmc&libraries=places&callback=initMap';
    script.async = true;
    script.defer = true;
    script.onerror = (e) => {
      console.error('Failed to load Google Maps API script:', e);
      reject(new Error('Failed to load Google Maps API script'));
    };
    script.onload = () => {
      console.log('Google Maps API script loaded');
      if (window.google && window.google.maps) {
        resolve();
      } else {
        console.error('Google Maps API script loaded but google object not found');
        reject(new Error('Google Maps API script loaded but not initialized'));
      }
    };
    document.body.appendChild(script);
  });
}

// Initialize Google Maps
window.initMap = function() {
  console.log('initMap called');
  if (!window.google || !window.google.maps) {
    console.error('Google Maps API not loaded in initMap');
    retryMapLoad(0);
    return;
  }
  try {
    map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: -33.9249, lng: 18.4241 },
      zoom: 10,
      styles: [
        {
          featureType: 'all',
          stylers: [{ saturation: -10 }, { lightness: 20 }]
        }
      ]
    });
    console.log('Map initialized successfully');
    document.getElementById('map').querySelector('.loading')?.remove();
    if (window.requestsLoaded) {
      console.log('Updating markers with pre-loaded requests:', window.requestsLoaded);
      updateMapMarkers(window.requestsLoaded);
    }
    mapReadyResolver();
  } catch (error) {
    console.error('Error initializing map:', error);
    retryMapLoad(0);
  }
};

// Retry map loading with exponential backoff
function retryMapLoad(attempt, maxRetries = 3) {
  if (attempt >= maxRetries) {
    console.error('Map load failed after maximum retries');
    document.getElementById('map').innerHTML = '<p class="error">Failed to load map. Please check your Google Maps API key or internet connection.</p>';
    mapReadyResolver();
    return;
  }
  const delay = Math.pow(2, attempt) * 2000;
  console.log(`Retrying map load, attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
  document.getElementById('map').innerHTML = '<p class="error">Failed to load map. Retrying...</p>';
  setTimeout(() => {
    loadGoogleMapsAPI().then(() => {
      if (window.google && window.google.maps) {
        window.initMap();
      } else {
        retryMapLoad(attempt + 1, maxRetries);
      }
    }).catch((e) => {
      console.error('Retry failed:', e);
      retryMapLoad(attempt + 1, maxRetries);
    });
  }, delay);
}

// Show toast notification
function showToast(message, type = 'error') {
  const bgColor = type === 'success' ? '#28a745' : '#ff4d4d';
  const div = document.createElement('div');
  div.style.position = 'fixed';
  div.style.top = '20px';
  div.style.right = '20px';
  div.style.background = bgColor;
  div.style.color = 'white';
  div.style.padding = '10px 20px';
  div.style.borderRadius = '8px';
  div.style.zIndex = '10000';
  div.style.maxWidth = '300px';
  div.style.fontSize = '0.9em';
  div.style.opacity = '0';
  div.style.transition = 'opacity 0.3s ease';
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => {
    div.style.opacity = '1';
  }, 10);
  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 300);
  }, 3000);
}

// Get authenticated contractor
async function getContractor() {
  console.log('Fetching authenticated contractor');
  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError?.message || 'No user found');
      showToast('You must be logged in to access the dashboard.', 'error');
      setTimeout(() => {
        console.log('Redirecting to login due to authentication failure');
        window.location.href = '/loginPage/loginPage.html';
      }, 2000);
      return null;
    }
    console.log('Authenticated user:', user.id);
    const { data: contractor, error: contractorError } = await supabaseClient
      .from('ContractorTable')
      .select('ContractorID, ContractorName')
      .eq('UserID', user.id)
      .single();
    if (contractorError || !contractor) {
      console.error('Contractor not found:', contractorError?.message || 'No contractor record');
      showToast('Contractor profile not found. Please contact support.', 'error');
      setTimeout(() => {
        console.log('Redirecting to login due to no contractor record');
        window.location.href = '/loginPage/loginPage.html';
      }, 2000);
      return null;
    }
    console.log('Contractor fetched:', contractor);
    return contractor;
  } catch (err) {
    console.error('Error checking authentication:', err);
    showToast('An error occurred while verifying your session.', 'error');
    setTimeout(() => {
      console.log('Redirecting to login due to session error');
      window.location.href = '/loginPage/loginPage.html';
    }, 2000);
    return null;
  }
}

// Load contractor notifications
async function loadContractorNotifications(contractorId) {
  console.log('Fetching notifications for ContractorID:', contractorId);
  try {
    const { data: notifications, error } = await supabaseClient
      .from('ContractorNotifications')
      .select('ContractorNotificationID, Message, created_at, IsRead, RequestTable(RequestTitle)')
      .eq('ContractorID', contractorId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) throw new Error(`Error fetching notifications: ${error.message}`);
    console.log('Fetched notifications:', notifications || 'No notifications');
    const badge = document.getElementById('notification-badge');
    const unreadCount = notifications.filter(n => !n.IsRead).length;
    badge.textContent = unreadCount > 0 ? unreadCount : '0';
    badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    renderNotifications(notifications || []);
  } catch (error) {
    console.error('Error loading notifications:', error);
    showToast(`Error loading notifications: ${error.message}`, 'error');
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) {
      dropdown.innerHTML = '<p class="error">Failed to load notifications.</p>';
    }
  }
}

// Render notifications
function renderNotifications(notifications) {
  console.log('Rendering notifications:', notifications);
  let dropdown = document.getElementById('notification-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'notification-dropdown';
    dropdown.className = 'notification-dropdown';
    document.querySelector('.main-container').appendChild(dropdown);
    notificationIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', (e) => {
      if (!notificationIcon.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  dropdown.innerHTML = `
    <div class="notification-header">
      <button id="clear-notifications" aria-label="Clear all notifications">Clear All</button>
    </div>
    <ul class="notification-list">
      ${notifications.length === 0
        ? '<li class="no-notifications">No notifications</li>'
        : notifications.map(notification => {
            const statusClass = notification.Message.includes('allocated') ? 'notification-allocation' : 'notification-info';
            return `
              <li class="${statusClass} ${notification.IsRead ? '' : 'unread'}" data-notification-id="${notification.ContractorNotificationID}">
                <strong>${notification.RequestTable?.RequestTitle || 'Request'}</strong><br>
                ${notification.Message}<br>
                <small>${new Date(notification.created_at).toLocaleString()}</small>
              </li>
            `;
          }).join('')}
    </ul>
  `;
  const clearNotificationsBtn = document.getElementById('clear-notifications');
  clearNotificationsBtn.addEventListener('click', async () => {
    try {
      const contractor = await getContractor();
      if (!contractor) return;
      console.log('Clearing notifications for ContractorID:', contractor.ContractorID);
      const { error } = await supabaseClient
        .from('ContractorNotifications')
        .delete()
        .eq('ContractorID', contractor.ContractorID);
      if (error) throw new Error(`Error clearing notifications: ${error.message}`);
      showToast('Notifications cleared successfully!', 'success');
      loadContractorNotifications(contractor.ContractorID);
    } catch (error) {
      console.error('Error clearing notifications:', error);
      showToast(`Error clearing notifications: ${error.message}`, 'error');
    }
  });
  dropdown.querySelectorAll('.unread').forEach(notification => {
    notification.addEventListener('click', async () => {
      const notificationId = notification.dataset.notificationId;
      if (notificationId) {
        console.log('Marking notification as read:', notificationId);
        const { error } = await supabaseClient
          .from('ContractorNotifications')
          .update({ IsRead: true })
          .eq('ContractorNotificationID', notificationId);
        if (error) {
          console.error('Error marking notification as read:', error);
          showToast(`Error marking notification as read: ${error.message}`, 'error');
        } else {
          loadContractorNotifications((await getContractor()).ContractorID);
        }
      }
    });
  });
}

// Load and render requests
async function loadRequests(contractorId) {
  console.log('Loading requests for ContractorID:', contractorId);
  document.getElementById('requests').innerHTML = '<p class="loading">Loading requests...</p>';
  try {
    const { data: requests, error } = await supabaseClient
      .from('RequestTable')
      .select('*, UserTable(UserUsername)')
      .eq('ContractorID', contractorId)
      .eq('RequestStatus', 'Allocated')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Error fetching requests: ${error.message}`);
    console.log('Fetched requests:', requests || 'No requests found');
    allRequests = requests || [];
    window.requestsLoaded = requests || [];
    renderRequestCards(requests || []);
    try {
      await mapReady;
      console.log('Map ready, updating markers with requests:', requests);
      updateMapMarkers(requests || []);
    } catch (mapError) {
      console.error('Map unavailable, skipping marker updates:', mapError);
    }
    if (requests.length === 0) {
      console.log('No allocated requests found for ContractorID:', contractorId);
      document.getElementById('requests').innerHTML = '<p>No allocated requests.</p>';
    }
  } catch (error) {
    console.error('Error loading requests:', error);
    showToast(`Error loading requests: ${error.message}`, 'error');
    document.getElementById('requests').innerHTML = '<p>Error loading requests. Please try again later.</p>';
  }
}

// Render request cards
function renderRequestCards(requests) {
  console.log('Rendering request cards:', requests);
  const requestsContainer = document.getElementById('requests');
  requestsContainer.innerHTML = requests.length > 0
    ? requests.map(request => `
        <div class="request-card glass-card" data-request-id="${request.RequestID}">
          <h3>${request.RequestTitle}</h3>
          <p><strong>Description:</strong> ${request.RequestDescription}</p>
          <p><strong>Location:</strong> ${request.RequestLocation}</p>
          <p><strong>Status:</strong> <span class="status status-allocated">${request.RequestStatus}</span></p>
          <p><strong>Submitted by:</strong> ${request.UserTable?.UserUsername || 'Unknown'}</p>
          ${request.RequestImageURL ? `<img src="${request.RequestImageURL}" alt="${request.RequestTitle}" class="request-image">` : ''}
          <div class="button-group">
            <button class="approve-btn request-button" data-request-id="${request.RequestID}" data-user-id="${request.UserID}" data-contractor-id="${request.ContractorID}" aria-label="Approve request">Approve</button>
            <button class="reject-btn request-button" data-request-id="${request.RequestID}" data-user-id="${request.UserID}" data-contractor-id="${request.ContractorID}" aria-label="Reject request">Reject</button>
            <button class="details-btn request-button" data-request-id="${request.RequestID}" aria-label="View request details">Details</button>
          </div>
        </div>
      `).join('')
    : '<p>No allocated requests.</p>';
  console.log('Request cards rendered, count:', requests.length);

  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      console.log('Approve button clicked for RequestID:', btn.dataset.requestId);
      openActionModal('Approve', btn.dataset.requestId, btn.dataset.userId, btn.dataset.contractorId);
    });
  });
  document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      console.log('Reject button clicked for RequestID:', btn.dataset.requestId);
      openActionModal('Reject', btn.dataset.requestId, btn.dataset.userId, btn.dataset.contractorId);
    });
  });
  document.querySelectorAll('.details-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      console.log('Details button clicked for RequestID:', btn.dataset.requestId);
      const requestId = btn.dataset.requestId;
      const { data: request, error: requestError } = await supabaseClient
        .from('RequestTable')
        .select('*')
        .eq('RequestID', requestId)
        .single();
      if (requestError) {
        console.error('Error fetching request details:', requestError);
        showToast(`Error fetching request: ${requestError.message}`, 'error');
        return;
      }
      const { data: userData, error: userError } = await supabaseClient
        .from('UserTable')
        .select('UserUsername')
        .eq('UserID', request.UserID)
        .single();
      if (userError) {
        console.error('Error fetching user data:', userError);
        showToast(`Error fetching user: ${userError.message}`, 'error');
      }
      console.log('Opening details modal for request:', request);
      openDetailsModal(request, userData);
    });
  });

  document.querySelectorAll('.request-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      console.log('Request card selected, RequestID:', card.dataset.requestId);
      if (selectedCard) selectedCard.classList.remove('selected');
      card.classList.add('selected');
      selectedCard = card;
      const requestId = card.dataset.requestId;
      const marker = markers.find(m => m.requestId === requestId);
      if (selectedMarker) selectedMarker.setIcon(markerIcons.default);
      if (marker) {
        marker.setIcon(markerIcons.selected);
        selectedMarker = marker;
        map?.panTo(marker.getPosition());
        console.log('Map panned to marker for RequestID:', requestId);
      }
    });
  });
}

// Update map markers
async function updateMapMarkers(requests) {
  if (!map || !window.google || !window.google.maps) {
    console.warn('Map not initialized or Google Maps API not loaded, skipping marker update');
    return;
  }
  console.log('Updating map markers for requests:', requests);

  markers.forEach(marker => marker.setMap(null));
  markers = [];

  const geocoder = new google.maps.Geocoder();
  for (const request of requests) {
    try {
      console.log('Geocoding location for RequestID:', request.RequestID, 'Location:', request.RequestLocation);
      const response = await new Promise((resolve, reject) => {
        geocoder.geocode({ address: request.RequestLocation }, (results, status) => {
          if (status === google.maps.GeocoderStatus.OK) {
            resolve(results);
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });
      if (response && response[0]) {
        const { lat, lng } = response[0].geometry.location;
        console.log('Geocoded coordinates for RequestID:', request.RequestID, 'Lat:', lat(), 'Lng:', lng());
        const marker = new google.maps.Marker({
          position: { lat: lat(), lng: lng() },
          map,
          title: request.RequestTitle,
          icon: markerIcons.default,
          requestId: request.RequestID
        });
        marker.addListener('click', () => {
          console.log('Marker clicked for RequestID:', request.RequestID);
          if (selectedMarker) selectedMarker.setIcon(markerIcons.default);
          marker.setIcon(markerIcons.selected);
          selectedMarker = marker;
          if (selectedCard) selectedCard.classList.remove('selected');
          selectedCard = document.querySelector(`.request-card[data-request-id="${request.RequestID}"]`);
          if (selectedCard) {
            selectedCard.classList.add('selected');
            selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          map.panTo(marker.getPosition());
        });
        markers.push(marker);
      } else {
        console.warn(`No geocoding results for location: ${request.RequestLocation}`);
      }
    } catch (error) {
      console.error(`Error geocoding location for RequestID ${request.RequestID}:`, error);
    }
  }
  console.log('Markers updated, count:', markers.length);
}

// Action modal controls
function openActionModal(action, requestId, userId, contractorId) {
  console.log('Opening action modal:', action, 'RequestID:', requestId);
  const modalTitle = document.getElementById('modal-title');
  const modalSubmit = document.querySelector('#action-modal .modal-submit-button');
  const actionModal = document.getElementById('action-modal');
  modalTitle.textContent = action === 'Approve' ? 'Approve Request' : 'Reject Request';
  modalSubmit.textContent = action;
  modalSubmit.setAttribute('aria-label', `${action} request`);
  actionModal.dataset.action = action.toLowerCase();
  actionModal.dataset.requestId = requestId;
  actionModal.dataset.userId = userId;
  actionModal.dataset.contractorId = contractorId;
  document.getElementById('message').value = '';
  actionModal.style.display = 'block';
}

function closeActionModal() {
  console.log('Closing action modal');
  const actionModal = document.getElementById('action-modal');
  const actionForm = document.getElementById('action-form');
  actionModal.style.display = 'none';
  actionForm.reset();
  actionModal.dataset.action = '';
  actionModal.dataset.requestId = '';
  actionModal.dataset.userId = '';
  actionModal.dataset.contractorId = '';
}

// Details modal controls
function openDetailsModal(request, userData) {
  console.log('Opening details modal for RequestID:', request.RequestID);
  const content = document.getElementById('details-content');
  content.innerHTML = `
    <div class="modal-section request-info">
      <h3>Request Information</h3>
      <div class="info-item">
        <span class="info-label">Title:</span>
        <span class="info-value">${request.RequestTitle}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Description:</span>
        <span class="info-value">${request.RequestDescription}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Category:</span>
        <span class="info-value">${request.RequestCategory || 'Other'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Location:</span>
        <span class="info-value">${request.RequestLocation}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Status:</span>
        <span class="info-value status-allocated">${request.RequestStatus}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Submitted:</span>
        <span class="info-value">${new Date(request.created_at).toLocaleString()}</span>
      </div>
    </div>
    <div class="modal-section user-info">
      <h3>User Information</h3>
      <div class="info-item">
        <span class="info-label">Username:</span>
        <span class="info-value">${userData?.UserUsername || 'Unknown'}</span>
      </div>
    </div>
    ${request.RequestImageURL ? `
      <div class="modal-section image-section">
        <h3>Request Image</h3>
        <img src="${request.RequestImageURL}" alt="${request.RequestTitle}" class="request-image">
      </div>
    ` : ''}
  `;
  document.getElementById('details-modal').style.display = 'block';
}

function closeDetailsModal() {
  console.log('Closing details modal');
  const detailsModal = document.getElementById('details-modal');
  detailsModal.style.display = 'none';
  document.getElementById('details-content').innerHTML = '';
}

// Initialize data and event listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM content loaded, initializing dashboard');
  const actionModal = document.getElementById('action-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalSubmit = document.querySelector('#action-modal .modal-submit-button');
  const actionForm = document.getElementById('action-form');
  const actionCloseBtn = actionModal.querySelector('.close');
  const actionCancelBtn = document.querySelector('#action-modal .modal-cancel-button');
  const detailsModal = document.getElementById('details-modal');
  const detailsCloseBtn = document.getElementById('details-close');
  const detailsCloseSpan = detailsModal.querySelector('.close');
  notificationIcon = document.querySelector('.nav-item.notifications');
  const logoutBtn = document.getElementById('logout');

  // Initialize data
  async function initialize() {
    console.log('Starting initialization');
    const contractor = await getContractor();
    if (!contractor) {
      console.log('No contractor found, initialization aborted');
      return;
    }
    console.log('Contractor initialized:', contractor.ContractorName);
    document.getElementById('contractor-name').textContent = `Welcome, ${contractor.ContractorName}`;
    await loadRequests(contractor.ContractorID);
    loadContractorNotifications(contractor.ContractorID);

    // Subscribe to real-time request updates
    console.log('Subscribing to RequestTable changes for ContractorID:', contractor.ContractorID);
    supabaseClient
      .channel('request_table_contractor')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'RequestTable',
        filter: `ContractorID=eq.${contractor.ContractorID}`
      }, () => {
        console.log('RequestTable change detected, reloading requests');
        loadRequests(contractor.ContractorID);
      })
      .subscribe();

    // Subscribe to real-time notification updates
    console.log('Subscribing to ContractorNotifications for ContractorID:', contractor.ContractorID);
    supabaseClient
      .channel('contractor_notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ContractorNotifications',
        filter: `ContractorID=eq.${contractor.ContractorID}`
      }, () => {
        console.log('ContractorNotifications change detected, reloading notifications');
        loadContractorNotifications(contractor.ContractorID);
      })
      .subscribe();
  }

  // Run initialization and then load map
  initialize().then(() => {
    console.log('Data initialization complete, loading Google Maps API');
    loadGoogleMapsAPI().catch(error => {
      console.error('Failed to load Google Maps API:', error);
      document.getElementById('map').innerHTML = '<p class="error">Failed to load map. Check your API key or connection.</p>';
    });
  });

  // Logout
  logoutBtn.addEventListener('click', async () => {
    console.log('Logout button clicked');
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
      showToast('Error logging out.', 'error');
    } else {
      showToast('Logged out successfully!', 'success');
      window.location.href = '/loginPage/loginPage.html';
    }
  });

  // Action modal event listeners
  actionCloseBtn.addEventListener('click', closeActionModal);
  actionCancelBtn.addEventListener('click', closeActionModal);
  window.addEventListener('click', (e) => {
    if (e.target === actionModal) closeActionModal();
  });

  // Details modal event listeners
  detailsCloseBtn.addEventListener('click', closeDetailsModal);
  detailsCloseSpan.addEventListener('click', closeDetailsModal);
  window.addEventListener('click', (e) => {
    if (e.target === detailsModal) closeDetailsModal();
  });

  // Handle action form submission
  actionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const action = actionModal.dataset.action;
    const requestId = actionModal.dataset.requestId;
    const userId = actionModal.dataset.userId;
    const contractorId = actionModal.dataset.contractorId;
    const message = document.getElementById('message').value.trim();
    console.log('Action form submitted:', action, 'RequestID:', requestId, 'Message:', message);

    try {
      const { data: request, error: requestError } = await supabaseClient
        .from('RequestTable')
        .select('RequestTitle')
        .eq('RequestID', requestId)
        .single();
      if (requestError) throw new Error(`Error fetching request: ${requestError.message}`);

      const { data: admin, error: adminError } = await supabaseClient
        .from('UserTable')
        .select('UserID')
        .eq('Role', 'Admin')
        .single();
      if (adminError || !admin) throw new Error(`Error fetching admin: ${adminError?.message || 'No admin user found'}`);

      if (action === 'approve') {
        console.log('Approving request:', requestId);
        await supabaseClient
          .from('RequestTable')
          .update({
            RequestStatus: 'Approved',
            updated_at: new Date().toISOString()
          })
          .eq('RequestID', requestId);
        await supabaseClient
          .from('RequestMessages')
          .insert({
            MessageID: crypto.randomUUID(),
            RequestID: requestId,
            UserID: userId,
            ContractorID: contractorId,
            MessageContent: `Request "${request.RequestTitle}" has been approved by the contractor.${message ? ` Message: ${message}` : ''}`,
            MessageType: 'Approval',
            SenderRole: 'contractor',
            IsRead: false,
            created_at: new Date().toISOString()
          });
        await supabaseClient
          .from('UserNotifications')
          .insert({
            NotificationID: crypto.randomUUID(),
            UserID: userId,
            RequestID: requestId,
            Message: `Your request "${request.RequestTitle}" has been approved by the contractor.${message ? ` Message: ${message}` : ''}`,
            IsRead: false,
            created_at: new Date().toISOString()
          });
        await supabaseClient
          .from('AdminNotifications')
          .insert({
            NotificationID: crypto.randomUUID(),
            AdminID: admin.UserID,
            RequestID: requestId,
            Message: `Request "${request.RequestTitle}" approved by contractor.`,
            IsRead: false,
            created_at: new Date().toISOString()
          });
        await supabaseClient
          .from('ContractorNotifications')
          .insert({
            ContractorNotificationID: crypto.randomUUID(),
            ContractorID: contractorId,
            RequestID: requestId,
            Message: `You approved request "${request.RequestTitle}".`,
            IsRead: false,
            created_at: new Date().toISOString()
          });
        showToast('Request approved successfully!', 'success');
      } else if (action === 'reject') {
        console.log('Rejecting request:', requestId);
        await supabaseClient
          .from('RequestTable')
          .update({
            RequestStatus: 'Rejected',
            updated_at: new Date().toISOString()
          })
          .eq('RequestID', requestId);
        await supabaseClient
          .from('RequestMessages')
          .insert({
            MessageID: crypto.randomUUID(),
            RequestID: requestId,
            UserID: userId,
            ContractorID: contractorId,
            MessageContent: `Request "${request.RequestTitle}" has been rejected by the contractor.${message ? ` Message: ${message}` : ''}`,
            MessageType: 'Rejection',
            SenderRole: 'Contractor',
            IsRead: false,
            created_at: new Date().toISOString()
          });
        await supabaseClient
          .from('UserNotifications')
          .insert({
            NotificationID: crypto.randomUUID(),
            UserID: userId,
            RequestID: requestId,
            Message: `Your request "${request.RequestTitle}" has been rejected by the contractor.${message ? ` Message: ${message}` : ''}`,
            IsRead: false,
            created_at: new Date().toISOString()
          });
        await supabaseClient
          .from('AdminNotifications')
          .insert({
            NotificationID: crypto.randomUUID(),
            AdminID: admin.UserID,
            RequestID: requestId,
            Message: `Request "${request.RequestTitle}" rejected by contractor.`,
            IsRead: false,
            created_at: new Date().toISOString()
          });
        await supabaseClient
          .from('ContractorNotifications')
          .insert({
            ContractorNotificationID: crypto.randomUUID(),
            ContractorID: contractorId,
            RequestID: requestId,
            Message: `You rejected request "${request.RequestTitle}".`,
            IsRead: false,
            created_at: new Date().toISOString()
          });
        showToast('Request rejected successfully!', 'success');
      }
      console.log('Reloading requests after action');
      loadRequests(contractorId);
      closeActionModal();
    } catch (error) {
      console.error(`Error performing ${action} action:`, error);
      showToast(`Error performing ${action} action: ${error.message}`, 'error');
    }
  });
});