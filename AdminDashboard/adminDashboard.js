import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Initialize Supabase client
const supabaseClient = createClient(
  'https://lywylvbgsnmqwcwgiyhc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg'
);

// Valid MessageType values based on updated schema
const VALID_MESSAGE_TYPES = ['Approval', 'Rejection', 'Acceptance', 'Allocation', 'Completion', 'AdminMessage', 'UserMessage'];

function validateMessageType(type) {
  if (!VALID_MESSAGE_TYPES.includes(type)) {
    throw new Error(`Invalid MessageType: ${type}. Must be one of ${VALID_MESSAGE_TYPES.join(', ')}`);
  }
}

// Map initialization state
let map;
let mapReadyResolver;
const mapReady = new Promise(resolve => {
  mapReadyResolver = resolve;
});

// Initialize Google Maps
window.initMap = function() {
  if (map) {
    console.log('Map already initialized, skipping re-initialization.');
    return;
  }
  if (!window.google || !window.google.maps) {
    console.error('Google Maps API not loaded');
    document.getElementById('map').innerHTML = '<p class="error">Google Maps API failed to load. Please check your API key or network connection.</p>';
    retryMapLoad(0);
    return;
  }
  try {
    console.log('Initializing map from adminDashboard.js');
    map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: -33.9249, lng: 18.4241 }, // Cape Town default
      zoom: 10,
      mapTypeId: google.maps.MapTypeId.ROADMAP, // Default to roadmap
      mapTypeControl: true, // Enable map type control (roadmap, satellite, hybrid, terrain)
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
        position: google.maps.ControlPosition.TOP_LEFT,
        mapTypeIds: [
          google.maps.MapTypeId.ROADMAP,
          google.maps.MapTypeId.SATELLITE,
          google.maps.MapTypeId.HYBRID,
          google.maps.MapTypeId.TERRAIN
        ]
      },
      streetViewControl: true, // Enable Street View Pegman control
      streetViewControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM
      },
      zoomControl: true, // Enable zoom control
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM
      },
      fullscreenControl: true, // Enable fullscreen control
      fullscreenControlOptions: {
        position: google.maps.ControlPosition.RIGHT_TOP
      },
      rotateControl: true, // Enable rotate control for 45° imagery
      rotateControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM
      },
      scaleControl: true, // Enable scale control
      styles: [
        {
          featureType: 'all',
          stylers: [{ saturation: -10 }, { lightness: 20 }]
        }
      ]
    });

    // Initialize Street View panorama (optional, can be toggled by Pegman)
    const panorama = map.getStreetView();
    panorama.setOptions({
      position: { lat: -33.9249, lng: 18.4241 },
      pov: { heading: 270, pitch: 0 },
      visible: false // Hidden by default, shown when Pegman is dropped
    });

    mapReadyResolver(); // Signal map is ready
    if (window.requestsLoaded) {
      updateMapMarkers(window.requestsLoaded);
    }
    document.getElementById('map').querySelector('.loading')?.remove();
    console.log('Map initialized successfully');
    // Trigger resize to ensure proper rendering
    google.maps.event.trigger(map, 'resize');
  } catch (error) {
    console.error('Error initializing map:', error);
    document.getElementById('map').innerHTML = '<p class="error">Failed to initialize map: ' + error.message + '</p>';
    retryMapLoad(0);
  }
};

// Retry map loading with exponential backoff
function retryMapLoad(attempt, maxRetries = 3) {
  if (attempt >= maxRetries) {
    const mapContainer = document.getElementById('map');
    mapContainer.innerHTML = `
      <p class="error">Failed to load map after ${maxRetries} attempts. Please check your API key or network connection.</p>
      <button id="retry-map" class="request-button">Retry Map</button>
    `;
    document.getElementById('retry-map').addEventListener('click', () => {
      mapContainer.innerHTML = '<p class="loading">Loading map...</p>';
      window.initMap();
    });
    mapReadyResolver(); // Resolve to prevent blocking
    return;
  }
  const delay = Math.pow(2, attempt) * 2000; // Exponential backoff: 2s, 4s, 8s
  document.getElementById('map').innerHTML = '<p class="error">Failed to load map. Retrying in ' + (delay / 1000) + ' seconds...</p>';
  setTimeout(() => {
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) existingScript.remove();
    const script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyAFM6HNEnxbn6_VvYaQ_o4n72VlAUajgmc&libraries=places&loading=async&callback=initMap';
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.error('Google Maps API script load error');
      retryMapLoad(attempt + 1, maxRetries);
    };
    document.body.appendChild(script);
  }, delay);
}

let selectedCard = null;
let selectedMarker = null;
let markers = [];
const markerIcons = {
  default: { url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png', scaledSize: new google.maps.Size(32, 32) },
  selected: { url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png', scaledSize: new google.maps.Size(32, 32) },
  completed: { url: 'http://maps.google.com/mapfiles/ms/icons/purple-dot.png', scaledSize: new google.maps.Size(32, 32) },
  pending: { url: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png', scaledSize: new google.maps.Size(32, 32) },
  allocated: { url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png', scaledSize: new google.maps.Size(32, 32) }
};

// Handle window resize to ensure map renders correctly
window.addEventListener('resize', () => {
  if (map && window.google && window.google.maps) {
    google.maps.event.trigger(map, 'resize');
  }
});

// Update map markers
async function updateMapMarkers(requests) {
  if (!map || !window.google || !window.google.maps) {
    console.error('Map not initialized or Google Maps API not loaded');
    document.getElementById('map').innerHTML = `
      <p class="error">Map not available. Please try again later.</p>
      <button id="retry-map" class="request-button">Retry Map</button>
    `;
    document.getElementById('retry-map').addEventListener('click', () => {
      document.getElementById('map').innerHTML = '<p class="loading">Loading map...</p>';
      window.initMap();
    });
    return;
  }

  // Clear existing markers
  markers.forEach(marker => marker.setMap(null));
  markers = [];

  const geocoder = new google.maps.Geocoder();
  const defaultPosition = { lat: -33.9249, lng: 18.4241 };
  let bounds = new google.maps.LatLngBounds();

  for (const request of requests) {
    if (!request.RequestLocation) {
      console.warn(`No location provided for request ${request.RequestID}. Skipping marker creation.`);
      continue;
    }

    try {
      let position = defaultPosition;
      let geocoded = false;

      try {
        const response = await new Promise((resolve, reject) => {
          geocoder.geocode({ address: request.RequestLocation }, (results, status) => {
            if (status === google.maps.GeocoderStatus.OK && results[0]) {
              resolve(results[0].geometry.location);
            } else {
              reject(new Error(`Geocoding failed for "${request.RequestLocation}": ${status}`));
            }
          });
        });
        position = { lat: response.lat(), lng: response.lng() };
        geocoded = true;
        bounds.extend(position);
      } catch (error) {
        console.warn(`Geocoding error for request ${request.RequestID}: ${error.message}`);
      }

      // Determine marker icon based on status
      let icon;
      switch (request.RequestStatus) {
        case 'Completed':
          icon = markerIcons.completed;
          break;
        case 'Pending':
          icon = markerIcons.pending;
          break;
        case 'Allocated':
          icon = markerIcons.allocated;
          break;
        default:
          icon = markerIcons.default;
      }

      const marker = new google.maps.Marker({
        position,
        map,
        title: request.RequestTitle,
        icon: icon,
        requestId: request.RequestID
      });

      // Info window for marker
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="font-family: Inter, sans-serif; padding: 10px;">
            <h3 style="margin: 0 0 5px; font-size: 1.1em;">${request.RequestTitle}</h3>
            <p style="margin: 0; font-size: 0.9em;"><strong>Status:</strong> ${request.RequestStatus}</p>
            <p style="margin: 0; font-size: 0.9em;"><strong>Location:</strong> ${request.RequestLocation}</p>
          </div>
        `
      });

      marker.addListener('click', () => {
        // Close any open info windows
        markers.forEach(m => m.infoWindow?.close());
        infoWindow.open(map, marker);

        // Update marker and card selection
        if (selectedMarker) selectedMarker.setIcon(markerIcons[selectedMarker.requestStatus] || markerIcons.default);
        marker.setIcon(markerIcons.selected);
        marker.requestStatus = request.RequestStatus;
        selectedMarker = marker;

        if (selectedCard) selectedCard.classList.remove('selected');
        selectedCard = document.querySelector(`.request-card[data-request-id="${request.RequestID}"]`);
        if (selectedCard) {
          selectedCard.classList.add('selected');
          selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        map.panTo(marker.getPosition());
      });

      marker.infoWindow = infoWindow;
      markers.push(marker);

      if (geocoded) {
        console.log(`Marker created for request ${request.RequestID} at position:`, position);
      } else {
        console.log(`Used default position for request ${request.RequestID}: ${request.RequestTitle}`);
      }
    } catch (error) {
      console.error(`Error creating marker for request ${request.RequestID}:`, error);
    }

    await new Promise(resolve => setTimeout(resolve, 100)); // Avoid rate limits
  }

  // Adjust map to fit all markers
  if (markers.length > 0) {
    map.fitBounds(bounds);
    // Ensure zoom doesn't go too far out
    map.addListener('bounds_changed', () => {
      if (map.getZoom() > 15) map.setZoom(15);
    });
  } else {
    document.getElementById('map').innerHTML = '<p class="error">No valid locations to display on the map.</p>';
  }

  document.getElementById('map').querySelector('.loading')?.remove();
  console.log(`Created ${markers.length} markers for ${requests.length} requests`);
}

document.addEventListener('DOMContentLoaded', () => {
  const actionModal = document.getElementById('action-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalSubmit = document.querySelector('#action-modal .modal-submit-button');
  const actionForm = document.getElementById('action-form');
  const actionCloseBtn = actionModal.querySelector('.close');
  const actionCancelBtn = document.querySelector('#action-modal .modal-cancel-button');
  const allocateModal = document.getElementById('allocate-modal');
  const allocateCancelBtn = document.getElementById('allocate-cancel');
  const allocateCloseBtn = allocateModal.querySelector('.close');
  const detailsModal = document.getElementById('details-modal');
  const detailsCloseBtn = document.getElementById('details-close');
  const detailsCloseSpan = detailsModal.querySelector('.close');
  const notificationIcon = document.querySelector('.nav-item.notifications');
  const statusFilter = document.getElementById('status-filter');
  const logoutBtn = document.getElementById('logout');
  let allRequests = [];
  let statusChartInstance = null;
  let trendChartInstance = null;

  // Load Chart.js with retry
  function loadChartJs(attempt = 0, maxRetries = 3) {
    if (typeof Chart !== 'undefined') {
      renderAnalytics(allRequests);
      return;
    }
    if (attempt >= maxRetries) {
      document.getElementById('analytics-section').innerHTML += `
        <p class="error">Failed to load analytics charts. Please check your connection.</p>
        <button id="retry-charts" class="request-button">Retry Charts</button>
      `;
      document.getElementById('retry-charts').addEventListener('click', () => {
        document.getElementById('analytics-section').querySelector('.error')?.remove();
        document.getElementById('retry-charts')?.remove();
        loadChartJs(0, maxRetries);
      });
      return;
    }
    const delay = Math.pow(2, attempt) * 2000;
    setTimeout(() => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.js';
      script.onload = () => renderAnalytics(allRequests);
      script.onerror = () => {
        console.error('Chart.js load error');
        loadChartJs(attempt + 1, maxRetries);
      };
      document.head.appendChild(script);
    }, delay);
  }

  // Get authenticated user
  async function getUser() {
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser();
      if (error || !user) {
        console.error('Authentication error:', error?.message || 'No user found');
        showToast('You must be logged in to access the dashboard.', 'error');
        window.location.href = '/loginPage/loginPage.html';
        return null;
      }
      return user;
    } catch (err) {
      console.error('Error checking authentication:', err);
      showToast('An error occurred while verifying your session.', 'error');
      return null;
    }
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

  // Load initial data
  async function initialize() {
    const user = await getUser();
    if (!user) return;

    loadRequests();
    loadAdminNotifications(user.id);
    loadChartJs();
    // Ensure map is initialized
    window.initMap();

    // Subscribe to real-time request updates
    supabaseClient
      .channel('request_table_admin')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'RequestTable'
      }, () => {
        loadRequests();
      })
      .subscribe();

    // Subscribe to real-time message updates for contractor actions
    supabaseClient
      .channel('request_messages_admin')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'RequestMessages',
        filter: 'MessageType=eq.Completion'
      }, async (payload) => {
        const message = payload.new;
        const { data: request, error } = await supabaseClient
          .from('RequestTable')
          .select('RequestTitle')
          .eq('RequestID', message.RequestID)
          .single();
        if (error) {
          console.error('Error fetching request title:', error);
          showToast(`Error fetching request: ${error.message}`, 'error');
          return;
        }
        await supabaseClient
          .from('AdminNotifications')
          .insert({
            NotificationID: crypto.randomUUID(),
            AdminID: user.id,
            RequestID: message.RequestID,
            Message: `Request "${request.RequestTitle}" marked as completed by contractor.`,
            IsRead: false,
            created_at: new Date().toISOString()
          });
        loadAdminNotifications(user.id);
      })
      .subscribe();
  }
  initialize();

  // Logout
  logoutBtn.addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
      showToast('Error logging out.', 'error');
    } else {
      showToast('Logged out successfully!', 'success');
      window.location.href = '/loginPage/loginPage.html';
    }
  });

  // Action modal controls
  function openActionModal(action, requestId, userId, contractorId = null) {
    modalTitle.textContent = action === 'Message' ? 'Send Message' : `${action} Request`;
    modalSubmit.textContent = action === 'Message' ? 'Send Message' : `Submit ${action}`;
    actionModal.dataset.action = action.toLowerCase();
    actionModal.dataset.requestId = requestId;
    actionModal.dataset.userId = userId;
    actionModal.dataset.contractorId = (action === 'Message' && contractorId) ? contractorId : null;
    document.getElementById('message').value = '';
    actionModal.style.display = 'block';
  }

  function closeActionModal() {
    actionModal.style.display = 'none';
    actionForm.reset();
    actionModal.dataset.action = '';
    actionModal.dataset.requestId = '';
    actionModal.dataset.userId = '';
    actionModal.dataset.contractorId = null;
  }

  actionCloseBtn.addEventListener('click', closeActionModal);
  actionCancelBtn.addEventListener('click', closeActionModal);
  window.addEventListener('click', (e) => {
    if (e.target === actionModal) closeActionModal();
  });

  // Allocate modal controls
  async function openAllocateModal(requestId, userId, category) {
    try {
      const contractorList = document.getElementById('contractor-list');
      contractorList.innerHTML = '<p>Loading contractors...</p>';

      const validCategories = ['Water', 'Electricity', 'Plumbing', 'Infrastructure', 'Crime', 'Other'];
      const requestCategory = validCategories.includes(category) ? category : 'Other';
      const { data: contractors, error } = await supabaseClient
        .from('ContractorTable')
        .select('ContractorID, ContractorName, ContractorCategory')
        .ilike('ContractorCategory', `%${requestCategory}%`);
      if (error) throw new Error(`Error fetching contractors: ${error.message}`);

      contractorList.innerHTML = contractors.length > 0
        ? contractors.map(contractor => `
            <div class="contractor-item">
              <p>${contractor.ContractorName} (${contractor.ContractorCategory})</p>
              <button class="select-contractor-btn request-button" data-contractor-id="${contractor.ContractorID}" data-request-id="${requestId}" data-user-id="${userId}">Allocate</button>
            </div>
          `).join('')
        : '<p>No contractors available for this category.</p>';

      allocateModal.style.display = 'block';

      // Add event listeners for contractor selection
      document.querySelectorAll('.select-contractor-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const contractorId = btn.dataset.contractorId;
          const requestId = btn.dataset.requestId;
          const userId = btn.dataset.userId;
          const message = document.getElementById('allocate-message').value.trim();

          try {
            const { data: request, error: requestError } = await supabaseClient
              .from('RequestTable')
              .select('RequestTitle, RequestCategory')
              .eq('RequestID', requestId)
              .single();
            if (requestError) throw new Error(`Error fetching request: ${requestError.message}`);

            // Validate contractor exists
            const { data: contractor, error: contractorError } = await supabaseClient
              .from('ContractorTable')
              .select('ContractorID')
              .eq('ContractorID', contractorId)
              .single();
            if (contractorError || !contractor) throw new Error(`Invalid contractor: ${contractorError?.message || 'Contractor not found'}`);

            // Update request
            const { error: updateError } = await supabaseClient
              .from('RequestTable')
              .update({
                RequestStatus: 'Allocated',
                ContractorID: contractorId,
                updated_at: new Date().toISOString()
              })
              .eq('RequestID', requestId);
            if (updateError) throw new Error(`Error updating request: ${updateError.message}`);

            // Notify contractor
            const contractorNotification = {
              ContractorNotificationID: crypto.randomUUID(),
              ContractorID: contractorId,
              RequestID: requestId,
              Message: `New request allocated: "${request.RequestTitle}"${message ? ` - ${message}` : ''}`,
              IsRead: false,
              created_at: new Date().toISOString()
            };
            const { error: contractorNotifyError } = await supabaseClient
              .from('ContractorNotifications')
              .insert(contractorNotification);
            if (contractorNotifyError) throw new Error(`Error notifying contractor: ${contractorNotifyError.message}`);

            // Notify user
            const userNotification = {
              MessageID: crypto.randomUUID(),
              RequestID: requestId,
              UserID: userId,
              MessageContent: `Your request "${request.RequestTitle}" has been allocated to a contractor.${message ? ` Message: ${message}` : ''}`,
              MessageType: 'Allocation',
              IsRead: false,
              SenderRole: 'Admin',
              created_at: new Date().toISOString(),
              ContractorID: contractorId
            };
            validateMessageType(userNotification.MessageType);
            const { error: userNotifyError } = await supabaseClient
              .from('RequestMessages')
              .insert(userNotification);
            if (userNotifyError) throw new Error(`Error notifying user: ${userNotifyError.message}`);

            // Notify admin
            const { error: adminNotifyError } = await supabaseClient
              .from('AdminNotifications')
              .insert({
                NotificationID: crypto.randomUUID(),
                AdminID: (await getUser()).id,
                RequestID: requestId,
                Message: `Request "${request.RequestTitle}" allocated to contractor.`,
                IsRead: false,
                created_at: new Date().toISOString()
              });
            if (adminNotifyError) throw new Error(`Error notifying admin: ${adminNotifyError.message}`);

            showToast('Request allocated successfully!', 'success');
            loadRequests();
            loadAdminNotifications((await getUser()).id);
            closeAllocateModal();
          } catch (error) {
            console.error('Error allocating request:', error);
            showToast(`Error allocating request: ${error.message}`, 'error');
          }
        });
      });
    } catch (error) {
      console.error('Error opening allocate modal:', error);
      document.getElementById('contractor-list').innerHTML = '<p>Error loading contractors. Please try again.</p>';
      showToast(`Error loading contractors: ${error.message}`, 'error');
    }
  }

  function closeAllocateModal() {
    allocateModal.style.display = 'none';
    document.getElementById('allocate-message').value = '';
    document.getElementById('contractor-list').innerHTML = '';
  }

  allocateCancelBtn.addEventListener('click', closeAllocateModal);
  allocateCloseBtn.addEventListener('click', closeAllocateModal);
  window.addEventListener('click', (e) => {
    if (e.target === allocateModal) closeAllocateModal();
  });

  // Details modal controls
  async function openDetailsModal(request, userData, messages) {
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
          <span class="info-value status-${request.RequestStatus.toLowerCase()}">${request.RequestStatus}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Submitted:</span>
          <span class="info-value">${new Date(request.created_at).toLocaleString()}</span>
        </div>
        ${request.ContractorID ? `
          <div class="info-item">
            <span class="info-label">Contractor:</span>
            <span class="info-value">${(await supabaseClient.from('ContractorTable').select('ContractorName').eq('ContractorID', request.ContractorID).single()).data?.ContractorName || 'Unknown'}</span>
          </div>
        ` : ''}
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
      <div class="modal-section message-history">
        <h3>Request Tracker</h3>
        ${messages.length > 0 ? `
          <div class="messages-container">
            ${messages.map(msg => `
              <div class="message-item">
                <div class="message-header">
                  <span class="message-type">${msg.MessageType}</span>
                  <span class="message-date">${new Date(msg.created_at).toLocaleString()}</span>
                </div>
                <p class="message-content">${msg.MessageContent}</p>
              </div>
            `).join('')}
          </div>
        ` : '<p class="no-messages">No updates available.</p>'}
      </div>
    `;
    detailsModal.style.display = 'block';
  }

  function closeDetailsModal() {
    detailsModal.style.display = 'none';
    document.getElementById('details-content').innerHTML = '';
  }

  detailsCloseBtn.addEventListener('click', closeDetailsModal);
  detailsCloseSpan.addEventListener('click', closeDetailsModal);
  window.addEventListener('click', (e) => {
    if (e.target === detailsModal) closeDetailsModal();
  });

  // Validate ContractorID
  async function validateContractorId(contractorId) {
    if (!contractorId) return null;
    const { data, error } = await supabaseClient
      .from('ContractorTable')
      .select('ContractorID')
      .eq('ContractorID', contractorId)
      .single();
    if (error || !data) {
      console.warn(`Invalid ContractorID: ${contractorId}. Setting to null.`);
      return null;
    }
    return contractorId;
  }

  // Handle action form submission
  actionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const action = actionModal.dataset.action;
    const requestId = actionModal.dataset.requestId;
    const userId = actionModal.dataset.userId;
    const message = document.getElementById('message').value.trim();
    let contractorId = actionModal.dataset.contractorId;

    // Force contractorId to null for accept/reject
    if (action !== 'message') {
      contractorId = null;
    } else {
      contractorId = await validateContractorId(contractorId);
    }

    try {
      const { data: request, error: requestError } = await supabaseClient
        .from('RequestTable')
        .select('RequestTitle, RequestCategory')
        .eq('RequestID', requestId)
        .single();
      if (requestError) throw new Error(`Error fetching request: ${requestError.message}`);

      if (action === 'accept') {
        const messageType = 'Acceptance';
        validateMessageType(messageType);
        const { error: updateError } = await supabaseClient
          .from('RequestTable')
          .update({
            RequestStatus: 'Accepted',
            updated_at: new Date().toISOString()
          })
          .eq('RequestID', requestId);
        if (updateError) throw new Error(`Error accepting request: ${updateError.message}`);

        const messagePayload = {
          MessageID: crypto.randomUUID(),
          RequestID: requestId,
          UserID: userId,
          MessageContent: `Request "${request.RequestTitle}" has been accepted by the admin.${message ? ` Message: ${message}` : ''}`,
          MessageType: messageType,
          IsRead: false,
          SenderRole: 'Admin',
          created_at: new Date().toISOString(),
          ContractorID: null
        };
        const { error: messageError } = await supabaseClient
          .from('RequestMessages')
          .insert([messagePayload], { returning: 'minimal' });
        if (messageError) throw new Error(`Error sending message: ${messageError.message}`);

        await supabaseClient
          .from('UserNotifications')
          .insert({
            NotificationID: crypto.randomUUID(),
            UserID: userId,
            RequestID: requestId,
            Message: `Request "${request.RequestTitle}" accepted by admin.${message ? ` Message: ${message}` : ''}`,
            IsRead: false,
            created_at: new Date().toISOString()
          });

        await supabaseClient
          .from('AdminNotifications')
          .insert({
            NotificationID: crypto.randomUUID(),
            AdminID: (await getUser()).id,
            RequestID: requestId,
            Message: `Request "${request.RequestTitle}" accepted.`,
            IsRead: false,
            created_at: new Date().toISOString()
          });

        showToast('Request accepted successfully!', 'success');
        loadAdminNotifications((await getUser()).id);
        openAllocateModal(requestId, userId, request.RequestCategory || 'Other');
      } else if (action === 'reject') {
        const messageType = 'Rejection';
        validateMessageType(messageType);
        const { error: updateError } = await supabaseClient
          .from('RequestTable')
          .update({
            RequestStatus: 'Rejected',
            updated_at: new Date().toISOString()
          })
          .eq('RequestID', requestId);
        if (updateError) throw new Error(`Error rejecting request: ${updateError.message}`);

        const messagePayload = {
          MessageID: crypto.randomUUID(),
          RequestID: requestId,
          UserID: userId,
          MessageContent: `Request "${request.RequestTitle}" has been rejected by the admin.${message ? ` Message: ${message}` : ''}`,
          MessageType: messageType,
          IsRead: false,
          SenderRole: 'Admin',
          created_at: new Date().toISOString(),
          ContractorID: null
        };
        const { error: messageError } = await supabaseClient
          .from('RequestMessages')
          .insert([messagePayload], { returning: 'minimal' });
        if (messageError) throw new Error(`Error sending message: ${messageError.message}`);

        await supabaseClient
          .from('UserNotifications')
          .insert({
            NotificationID: crypto.randomUUID(),
            UserID: userId,
            RequestID: requestId,
            Message: `Request "${request.RequestTitle}" rejected by admin.${message ? ` Message: ${message}` : ''}`,
            IsRead: false,
            created_at: new Date().toISOString()
          });

        await supabaseClient
          .from('AdminNotifications')
          .insert({
            NotificationID: crypto.randomUUID(),
            AdminID: (await getUser()).id,
            RequestID: requestId,
            Message: `Request "${request.RequestTitle}" rejected.`,
            IsRead: false,
            created_at: new Date().toISOString()
          });

        showToast('Request rejected successfully!', 'success');
        loadRequests();
        loadAdminNotifications((await getUser()).id);
      } else if (action === 'message') {
        const messageType = contractorId ? 'AdminMessage' : 'UserMessage';
        validateMessageType(messageType);
        const messagePayload = {
          MessageID: crypto.randomUUID(),
          RequestID: requestId,
          UserID: contractorId ? null : userId,
          MessageContent: message,
          MessageType: messageType,
          IsRead: false,
          SenderRole: 'Admin',
          created_at: new Date().toISOString(),
          ContractorID: contractorId
        };
        const { error: messageError } = await supabaseClient
          .from('RequestMessages')
          .insert([messagePayload], { returning: 'minimal' });
        if (messageError) throw new Error(`Error sending message: ${messageError.message}`);

        const notificationTable = contractorId ? 'ContractorNotifications' : 'UserNotifications';
        const notificationPayload = contractorId
          ? {
              ContractorNotificationID: crypto.randomUUID(),
              ContractorID: contractorId,
              RequestID: requestId,
              Message: `New message for request "${request.RequestTitle}": ${message}`,
              IsRead: false,
              created_at: new Date().toISOString()
            }
          : {
              NotificationID: crypto.randomUUID(),
              UserID: userId,
              RequestID: requestId,
              Message: `New message for request "${request.RequestTitle}": ${message}`,
              IsRead: false,
              created_at: new Date().toISOString()
            };
        const { error: notifyError } = await supabaseClient
          .from(notificationTable)
          .insert(notificationPayload);
        if (notifyError) throw new Error(`Error sending notification: ${notifyError.message}`);

        await supabaseClient
          .from('AdminNotifications')
          .insert({
            NotificationID: crypto.randomUUID(),
            AdminID: (await getUser()).id,
            RequestID: requestId,
            Message: `Message sent for request "${request.RequestTitle}"${contractorId ? ' to contractor' : ''}.`,
            IsRead: false,
            created_at: new Date().toISOString()
          });

        showToast('Message sent successfully!', 'success');
        loadRequests();
        loadAdminNotifications((await getUser()).id);
      }

      closeActionModal();
    } catch (error) {
      console.error(`Error performing ${action}:`, error);
      showToast(`Error: ${error.message}`, 'error');
    }
  });

  // Load and display requests
  async function loadRequests() {
    try {
      const { data: requests, error } = await supabaseClient
        .from('RequestTable')
        .select(`
          *,
          UserTable (UserUsername),
          RequestMessages (*)
        `)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Error fetching requests: ${error.message}`);

      allRequests = requests;
      window.requestsLoaded = requests;

      // Update stats
      document.getElementById('total-requests').textContent = requests.length;
      document.getElementById('pending-requests').textContent = requests.filter(r => r.RequestStatus === 'Pending').length;
      document.getElementById('accepted-requests').textContent = requests.filter(r => r.RequestStatus === 'Accepted').length;
      document.getElementById('rejected-requests').textContent = requests.filter(r => r.RequestStatus === 'Rejected').length;

      // Render request cards
      const requestsContainer = document.getElementById('requests');
      requestsContainer.innerHTML = requests.length > 0
        ? requests.map(request => {
            const isOverdue = new Date() - new Date(request.created_at) > 7 * 24 * 60 * 60 * 1000 && request.RequestStatus === 'Pending';
            return `
              <div class="request-card ${isOverdue ? 'overdue' : ''} ${selectedCard?.dataset.requestId === request.RequestID ? 'selected' : ''}" data-request-id="${request.RequestID}">
                ${request.RequestImageURL ? `<img src="${request.RequestImageURL}" alt="${request.RequestTitle}">` : ''}
                <h3>${request.RequestTitle}</h3>
                <p><strong>Description:</strong> ${request.RequestDescription}</p>
                <p><strong>Location:</strong> ${request.RequestLocation}</p>
                <p><strong>Status:</strong> <span class="status status-${request.RequestStatus.toLowerCase()}">${request.RequestStatus}</span></p>
                <p><strong>Submitted:</strong> ${new Date(request.created_at).toLocaleString()}</p>
                <div class="button-group">
                  <button class="approve-btn" data-request-id="${request.RequestID}" data-user-id="${request.UserID}" ${request.RequestStatus !== 'Pending' ? 'disabled' : ''}>Accept</button>
                  <button class="reject-btn" data-request-id="${request.RequestID}" data-user-id="${request.UserID}" ${request.RequestStatus !== 'Pending' ? 'disabled' : ''}>Reject</button>
                  <button class="details-btn" data-request-id="${request.RequestID}">Details</button>
                  ${request.RequestStatus === 'Allocated' || request.RequestStatus === 'Accepted' ? `
                    <button class="message-btn" data-request-id="${request.RequestID}" data-user-id="${request.UserID}" data-contractor-id="${request.ContractorID || ''}">Message</button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')
        : '<p>No requests available.</p>';

      // Add event listeners for request cards
      document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          openActionModal('Accept', btn.dataset.requestId, btn.dataset.userId);
        });
      });

      document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          openActionModal('Reject', btn.dataset.requestId, btn.dataset.userId);
        });
      });

      document.querySelectorAll('.details-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const request = requests.find(r => r.RequestID === btn.dataset.requestId);
          const messages = request.RequestMessages || [];
          await openDetailsModal(request, request.UserTable, messages);
        });
      });

      document.querySelectorAll('.message-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          openActionModal('Message', btn.dataset.requestId, btn.dataset.userId, btn.dataset.contractorId);
        });
      });

      document.querySelectorAll('.request-card').forEach(card => {
        card.addEventListener('click', () => {
          if (selectedCard) selectedCard.classList.remove('selected');
          card.classList.add('selected');
          selectedCard = card;
          const requestId = card.dataset.requestId;
          const marker = markers.find(m => m.requestId === requestId);
          if (marker) {
            if (selectedMarker) selectedMarker.setIcon(markerIcons[selectedMarker.requestStatus] || markerIcons.default);
            marker.setIcon(markerIcons.selected);
            selectedMarker = marker;
            marker.infoWindow.open(map, marker);
            map.panTo(marker.getPosition());
          }
        });
      });

      // Render request table
      const tableBody = document.querySelector('#requests-table tbody');
      tableBody.innerHTML = requests.map(request => `
        <tr>
          <td data-label="Title">${request.RequestTitle}</td>
          <td data-label="Description">${request.RequestDescription}</td>
          <td data-label="Location">${request.RequestLocation}</td>
          <td data-label="Status"><span class="status status-${request.RequestStatus.toLowerCase()}">${request.RequestStatus}</span></td>
          <td data-label="Submitted">${new Date(request.created_at).toLocaleString()}</td>
          <td data-label="Username">${request.UserTable?.UserUsername || 'Unknown'}</td>
          <td data-label="Details">
            <button class="table-details-btn" data-request-id="${request.RequestID}">View</button>
          </td>
        </tr>
      `).join('');

      document.querySelectorAll('.table-details-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const request = requests.find(r => r.RequestID === btn.dataset.requestId);
          const messages = request.RequestMessages || [];
          await openDetailsModal(request, request.UserTable, messages);
        });
      });

      // Update map markers
      await mapReady;
      updateMapMarkers(requests);

      // Apply status filter
      statusFilter.value = statusFilter.value || 'all';
      filterRequests(statusFilter.value);

      // Render analytics
      renderAnalytics(requests);
    } catch (error) {
      console.error('Error loading requests:', error);
      showToast(`Error loading requests: ${error.message}`, 'error');
    }
  }

  // Filter requests by status
  function filterRequests(status) {
    const requestsContainer = document.getElementById('requests');
    const requests = Array.from(requestsContainer.querySelectorAll('.request-card'));
    requests.forEach(card => {
      const cardStatus = card.querySelector('.status').textContent.toLowerCase();
      card.style.display = status === 'all' || cardStatus === status ? 'block' : 'none';
    });

    const filteredRequests = allRequests.filter(r => status === 'all' || r.RequestStatus.toLowerCase() === status);
    updateMapMarkers(filteredRequests);
  }

  statusFilter.addEventListener('change', () => {
    filterRequests(statusFilter.value);
  });

  // Load and display admin notifications
  async function loadAdminNotifications(adminId) {
    try {
      const { data: notifications, error } = await supabaseClient
        .from('AdminNotifications')
        .select('*')
        .eq('AdminID', adminId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Error fetching notifications: ${error.message}`);

      const unreadCount = notifications.filter(n => !n.IsRead).length;
      document.getElementById('notification-badge').textContent = unreadCount;

      let dropdown = document.querySelector('.notification-dropdown');
      if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.className = 'notification-dropdown';
        document.body.appendChild(dropdown);
      }

      dropdown.innerHTML = `
        <div class="notification-header">
          <button id="clear-notifications">Clear All</button>
        </div>
        <ul class="notification-list">
          ${notifications.length > 0
            ? notifications.map(n => `
                <li class="notification-${n.Message.includes('accepted') ? 'approval' : n.Message.includes('rejected') ? 'rejection' : n.Message.includes('allocated') ? 'allocation' : n.Message.includes('completed') ? 'completion' : 'request'} ${n.IsRead ? '' : 'unread'}">
                  ${n.Message}
                  <br><small>${new Date(n.created_at).toLocaleString()}</small>
                </li>
              `).join('')
            : '<li class="no-notifications">No notifications available.</li>'}
        </ul>
      `;

      document.getElementById('clear-notifications').addEventListener('click', async () => {
        try {
          const { error } = await supabaseClient
            .from('AdminNotifications')
            .delete()
            .eq('AdminID', adminId);
          if (error) throw new Error(`Error clearing notifications: ${error.message}`);
          loadAdminNotifications(adminId);
        } catch (error) {
          console.error('Error clearing notifications:', error);
          showToast(`Error clearing notifications: ${error.message}`, 'error');
        }
      });

      dropdown.style.display = 'none';
      notificationIcon.addEventListener('click', () => {
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        if (dropdown.style.display === 'block' && unreadCount > 0) {
          supabaseClient
            .from('AdminNotifications')
            .update({ IsRead: true })
            .eq('AdminID', adminId)
            .eq('IsRead', false)
            .then(() => {
              document.getElementById('notification-badge').textContent = '0';
            });
        }
      });

      window.addEventListener('click', (e) => {
        if (!notificationIcon.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
    } catch (error) {
      console.error('Error loading notifications:', error);
      showToast(`Error loading notifications: ${error.message}`, 'error');
    }
  }

  // Render analytics
  function renderAnalytics(requests) {
    if (!requests.length || typeof Chart === 'undefined') {
      console.warn('No requests or Chart.js not loaded for analytics');
      return;
    }

    // Enhanced KPIs
    const categories = ['Water', 'Electricity', 'Plumbing', 'Infrastructure', 'Crime', 'Other'];
    const categoryCounts = categories.reduce((acc, cat) => {
      acc[cat] = requests.filter(r => r.RequestCategory === cat).length;
      return acc;
    }, {});
    document.getElementById('kpi-water').textContent = categoryCounts.Water;
    document.getElementById('kpi-electricity').textContent = categoryCounts.Electricity;

    const completedRequests = requests.filter(r => r.RequestStatus === 'Completed');
    const avgProcessingTime = completedRequests.length > 0
      ? completedRequests.reduce((sum, r) => {
          const created = new Date(r.created_at);
          const updated = new Date(r.updated_at);
          return sum + (updated - created) / (1000 * 60 * 60 * 24);
        }, 0) / completedRequests.length
      : 0;
    document.getElementById('kpi-processing-time').textContent = `${Math.round(avgProcessingTime)} days`;

    // Status chart (Bar chart for better visibility)
    const statusCounts = {
      Pending: requests.filter(r => r.RequestStatus === 'Pending').length,
      Accepted: requests.filter(r => r.RequestStatus === 'Accepted').length,
      Rejected: requests.filter(r => r.RequestStatus === 'Rejected').length,
      Allocated: requests.filter(r => r.RequestStatus === 'Allocated').length,
      Completed: requests.filter(r => r.RequestStatus === 'Completed').length
    };

    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(document.getElementById('statusChart'), {
      type: 'bar',
      data: {
        labels: Object.keys(statusCounts),
        datasets: [{
          label: 'Request Status',
          data: Object.values(statusCounts),
          backgroundColor: ['#ffaa00', '#28a745', '#ff4d4d', '#20c997', '#ba68c8'],
          borderColor: ['#cc8800', '#1e7e34', '#cc3333', '#1a8c6b', '#8e4b9b'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Request Status Distribution' }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Number of Requests' } }
        }
      }
    });

    // Trend chart (Monthly trend)
    const trendData = {};
    requests.forEach(r => {
      const date = new Date(r.created_at).toLocaleString('default', { month: 'short', year: 'numeric' });
      trendData[date] = (trendData[date] || 0) + 1;
    });

    const sortedLabels = Object.keys(trendData).sort((a, b) => {
      const [monthA, yearA] = a.split(' ');
      const [monthB, yearB] = b.split(' ');
      return new Date(`${monthA} 1, ${yearA}`) - new Date(`${monthB} 1, ${yearB}`);
    });

    if (trendChartInstance) trendChartInstance.destroy();
    trendChartInstance = new Chart(document.getElementById('trendChart'), {
      type: 'line',
      data: {
        labels: sortedLabels,
        datasets: [{
          label: 'Requests Submitted',
          data: sortedLabels.map(label => trendData[label]),
          borderColor: '#28a745',
          backgroundColor: 'rgba(40, 167, 69, 0.2)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Request Submission Trend' }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Number of Requests' } },
          x: { title: { display: true, text: 'Month' } }
        }
      }
    });
  }
});