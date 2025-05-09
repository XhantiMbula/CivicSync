import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Initialize Supabase client
const supabaseClient = createClient('https://lywylvbgsnmqwcwgiyhc.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg');

// Google Maps initialization
let map;
let selectedCard = null;
let selectedMarker = null;
const markerIcons = {
  default: {
    url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
    scaledSize: null
  },
  selected: {
    url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
    scaledSize: null
  }
};

window.initMap = function() {
  if (!window.google || !window.google.maps) {
    console.error('Google Maps API not loaded');
    return;
  }
  window.map = new window.google.maps.Map(document.getElementById('map'), {
    center: { lat: -33.9249, lng: 18.4241 },
    zoom: 10,
  });
};

// Modal controls (Action Modal)
const actionModal = document.getElementById('action-modal');
const modalTitle = document.getElementById('modal-title');
const modalSubmit = document.querySelector('.modal-submit-button');
const actionForm = document.getElementById('action-form');
const actionCloseBtn = actionModal.querySelector('.close');
const actionCancelBtn = actionModal.querySelector('.modal-cancel-button');

function openActionModal(action, requestId, userId) {
  modalTitle.textContent = `${action} Request`;
  modalSubmit.textContent = `Submit ${action}`;
  actionModal.dataset.action = action.toLowerCase();
  actionModal.dataset.requestId = requestId;
  actionModal.dataset.userId = userId;
  actionModal.style.display = 'block';
}

function closeActionModal() {
  actionModal.style.display = 'none';
  actionForm.reset();
  actionModal.dataset.action = '';
  actionModal.dataset.requestId = '';
  actionModal.dataset.userId = '';
}

actionCloseBtn.addEventListener('click', closeActionModal);
actionCancelBtn.addEventListener('click', closeActionModal);
window.addEventListener('click', (e) => {
  if (e.target === actionModal) closeActionModal();
});

// Modal controls (Details Modal)
const detailsModal = document.getElementById('details-modal');
const detailsCloseBtn = document.getElementById('details-close');
const detailsCloseSpan = detailsModal.querySelector('.close');

function openDetailsModal(request, userData, messages) {
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
      <h3>Message History</h3>
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
      ` : '<p class="no-messages">No messages available.</p>'}
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

// Load admin notifications
async function loadAdminNotifications(adminId) {
  try {
    const { data: notifications, error } = await supabaseClient
      .from('AdminNotifications')
      .select('*, RequestTable(RequestTitle)')
      .eq('AdminID', adminId)
      .eq('IsRead', false)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Error fetching notifications: ${error.message}`);

    const badge = document.getElementById('notification-badge');
    badge.textContent = notifications.length;
  } catch (error) {
    console.error('Error loading admin notifications:', error);
    alert('Failed to load notifications. Please try again.');
  }
}

// Display admin notifications
const notificationIcon = document.querySelector('.nav-item.notifications');
notificationIcon.addEventListener('click', async () => {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    alert('You must be logged in to view notifications.');
    return;
  }

  const existingDropdown = document.getElementById('notification-dropdown');
  if (existingDropdown) {
    existingDropdown.remove();
    return;
  }

  try {
    const { data: notifications, error } = await supabaseClient
      .from('AdminNotifications')
      .select('*, RequestTable(RequestTitle)')
      .eq('AdminID', user.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Error fetching notifications: ${error.message}`);

    const dropdown = document.createElement('div');
    dropdown.id = 'notification-dropdown';
    dropdown.className = 'notification-dropdown';

    if (notifications.length === 0) {
      dropdown.innerHTML = '<p class="no-notifications">No new notifications.</p>';
    } else {
      let html = '<ul class="notification-list">';
      notifications.forEach(notification => {
        const statusClass = notification.Message.includes('approved') ? 'notification-approval' : 'notification-rejection';
        html += `
          <li class="${statusClass}">
            <strong>${notification.RequestTable.RequestTitle}</strong><br>
            ${notification.Message}<br>
            <small>${new Date(notification.created_at).toLocaleString()}</small>
          </li>
        `;
      });
      html += '</ul>';
      dropdown.innerHTML = html;
    }

    document.querySelector('.main-container').appendChild(dropdown);

    // Mark notifications as read
    const unreadNotificationIds = notifications.filter(n => !n.IsRead).map(n => n.NotificationID);
    if (unreadNotificationIds.length > 0) {
      const { error: updateError } = await supabaseClient
        .from('AdminNotifications')
        .update({ IsRead: true })
        .in('NotificationID', unreadNotificationIds);
      if (updateError) console.error('Error marking notifications as read:', updateError);
      loadAdminNotifications(user.id);
    }

    function closeDropdown(event) {
      if (!notificationIcon.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown);
      }
    }
    setTimeout(() => document.addEventListener('click', closeDropdown), 10);
  } catch (error) {
    console.error('Error displaying notifications:', error);
    alert('Failed to display notifications. Please try again.');
  }
});

// Render analytics charts
let statusChartInstance = null;
let trendChartInstance = null;

function renderAnalytics(data) {
  if (typeof Chart === 'undefined') {
    console.error('Chart.js not loaded. Analytics charts cannot be rendered.');
    return;
  }

  // Define categories
  const categories = ['Water', 'Electricity', 'Road Maintenance', 'Waste Management', 'Other'];

  // Calculate KPIs
  const waterCount = data.filter(r => (r.RequestCategory || 'Other') === 'Water').length;
  const electricityCount = data.filter(r => (r.RequestCategory || 'Other') === 'Electricity').length;
  const processingTimes = data
    .filter(r => r.RequestStatus.toLowerCase() !== 'pending' && r.updated_at)
    .map(r => (new Date(r.updated_at) - new Date(r.created_at)) / (1000 * 60 * 60 * 24));
  const avgProcessingTime = processingTimes.length > 0
    ? (processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length).toFixed(1)
    : 0;

  // Update KPIs
  document.getElementById('kpi-water').textContent = waterCount;
  document.getElementById('kpi-electricity').textContent = electricityCount;
  document.getElementById('kpi-processing-time').textContent = `${avgProcessingTime} days`;

  // Category Distribution Pie Chart
  const categoryCounts = categories.map(category =>
    data.filter(r => (r.RequestCategory || 'Other') === category).length
  );

  if (statusChartInstance) statusChartInstance.destroy();
  statusChartInstance = new Chart(document.getElementById('statusChart'), {
    type: 'pie',
    data: {
      labels: categories,
      datasets: [{
        data: categoryCounts,
        backgroundColor: ['#4dabf5', '#ffca28', '#26a69a', '#f06292', '#bdbdbd'],
        borderColor: ['#2b6cb0', '#f57c00', '#00695c', '#c2185b', '#757575'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: 'Request Category Distribution' }
      }
    }
  });

  // Submission Trend Line Chart
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);
  const dailyCountsByCategory = categories.reduce((acc, category) => {
    acc[category] = {};
    for (let d = new Date(last30Days); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      acc[category][dateStr] = 0;
    }
    return acc;
  }, {});

  data.forEach(r => {
    const category = r.RequestCategory || 'Other';
    if (!categories.includes(category)) return;
    const dateStr = new Date(r.created_at).toISOString().split('T')[0];
    if (dateStr in dailyCountsByCategory[category]) {
      dailyCountsByCategory[category][dateStr]++;
    }
  });

  const labels = Object.keys(dailyCountsByCategory[categories[0]]);
  const datasets = categories.map((category, index) => ({
    label: category,
    data: Object.values(dailyCountsByCategory[category]),
    borderColor: ['#4dabf5', '#ffca28', '#26a69a', '#f06292', '#bdbdbd'][index],
    backgroundColor: ['rgba(77, 171, 245, 0.2)', 'rgba(255, 202, 40, 0.2)', 'rgba(38, 166, 154, 0.2)', 'rgba(240, 98, 146, 0.2)', 'rgba(189, 189, 189, 0.2)'][index],
    fill: true,
    tension: 0.4
  }));

  if (trendChartInstance) trendChartInstance.destroy();
  trendChartInstance = new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      scales: {
        x: { display: true, title: { display: true, text: 'Date' } },
        y: { display: true, title: { display: true, text: 'Number of Requests' }, beginAtZero: true }
      },
      plugins: {
        legend: { display: true },
        title: { display: true, text: 'Requests by Category Over Last 30 Days' }
      }
    }
  });
}

// Fetch requests and display them
async function fetchRequests(filterStatus = 'all') {
  try {
    let query = supabaseClient.from('RequestTable').select('*, UserTable(UserID, UserUsername, UserLocation)').order('created_at', { ascending: false });
    if (filterStatus !== 'all') {
      query = query.eq('RequestStatus', filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1));
    }
    const { data, error } = await query;
    if (error) throw new Error(`Error fetching requests: ${error.message}`);

    // Update stats
    document.getElementById('total-requests').textContent = data.length;
    document.getElementById('pending-requests').textContent = data.filter(r => r.RequestStatus.toLowerCase() === 'pending').length;
    document.getElementById('approved-requests').textContent = data.filter(r => r.RequestStatus.toLowerCase() === 'approved').length;
    document.getElementById('rejected-requests').textContent = data.filter(r => r.RequestStatus.toLowerCase() === 'rejected').length;

    const requestsDiv = document.getElementById('requests');
    requestsDiv.innerHTML = '';

    const tableBody = document.querySelector('#requests-table tbody');
    tableBody.innerHTML = '';

    if (!window.google || !window.google.maps || !window.map) {
      console.warn('Google Maps API not loaded yet. Map functionality will be limited.');
      // Populate table and cards without map
      const tableData = data.filter(r => r.RequestStatus.toLowerCase() === 'approved' || r.RequestStatus.toLowerCase() === 'rejected');
      tableData.forEach(request => {
        const row = document.createElement('tr');
        row.dataset.requestId = request.RequestID;
        const description = request.RequestDescription.length > 100
          ? request.RequestDescription.substring(0, 100) + '...'
          : request.RequestDescription;
        row.innerHTML = `
          <td>${request.RequestTitle}</td>
          <td>${description}</td>
          <td>${request.RequestLocation}</td>
          <td><span class="status status-${request.RequestStatus.toLowerCase()}">${request.RequestStatus}</span></td>
          <td>${new Date(request.created_at).toLocaleString()}</td>
          <td>${request.UserTable?.UserUsername || 'Unknown'}</td>
          <td><button class="table-details-btn" data-id="${request.RequestID}"><i class="fas fa-chevron-down"></i></button></td>
        `;
        tableBody.appendChild(row);
      });

      data.forEach(request => {
        const createdAt = new Date(request.created_at);
        const isOverdue = (new Date() - createdAt) > 7 * 24 * 60 * 60 * 1000;
        const card = document.createElement('div');
        card.className = `request-card ${isOverdue ? 'overdue' : ''}`;
        card.dataset.requestId = request.RequestID;
        const statusClass = request.RequestStatus.toLowerCase() === 'pending'
          ? 'status-pending'
          : request.RequestStatus.toLowerCase() === 'approved'
          ? 'status-approved'
          : 'status-rejected';
        card.innerHTML = `
          <h3>${request.RequestTitle}</h3>
          <img src="${request.RequestImageURL}" alt="${request.RequestTitle}">
          <p><strong>Description:</strong> ${request.RequestDescription}</p>
          <p><strong>Category:</strong> ${request.RequestCategory || 'Other'}</p>
          <p><strong>Location:</strong> ${request.RequestLocation}</p>
          <p><strong>Status:</strong> <span class="status ${statusClass}">${request.RequestStatus}</span></p>
          <p><strong>Submitted:</strong> ${createdAt.toLocaleString()}</p>
          <div class="button-group">
            <button class="approve-btn" data-id="${request.RequestID}" data-user-id="${request.UserTable.UserID}" ${request.RequestStatus === 'Approved' ? 'disabled' : ''}>Approve</button>
            <button class="reject-btn" data-id="${request.RequestID}" data-user-id="${request.UserTable.UserID}" ${request.RequestStatus === 'Rejected' ? 'disabled' : ''}>Reject</button>
            <button class="details-btn" data-id="${request.RequestID}" data-user-id="${request.UserTable.UserID}">View Details</button>
            ${request.RequestStatus === 'Approved' ? `
              <button class="allocate-btn" data-id="${request.RequestID}">Allocate</button>
            ` : ''}
          </div>
        `;
        requestsDiv.appendChild(card);
      });

      renderAnalytics(data);
      return;
    }

    // Set marker sizes now that Google Maps is loaded
    markerIcons.default.scaledSize = new window.google.maps.Size(40, 40);
    markerIcons.selected.scaledSize = new window.google.maps.Size(40, 40);
    map = window.map;

    const geocoder = new window.google.maps.Geocoder();
    const markers = [];

    // Populate table with Approved/Rejected requests
    const tableData = data.filter(r => r.RequestStatus.toLowerCase() === 'approved' || r.RequestStatus.toLowerCase() === 'rejected');
    tableData.forEach(request => {
      const row = document.createElement('tr');
      row.dataset.requestId = request.RequestID;
      const description = request.RequestDescription.length > 100
        ? request.RequestDescription.substring(0, 100) + '...'
        : request.RequestDescription;
      row.innerHTML = `
        <td>${request.RequestTitle}</td>
        <td>${description}</td>
        <td>${request.RequestLocation}</td>
        <td><span class="status status-${request.RequestStatus.toLowerCase()}">${request.RequestStatus}</span></td>
        <td>${new Date(request.created_at).toLocaleString()}</td>
        <td>${request.UserTable?.UserUsername || 'Unknown'}</td>
        <td><button class="table-details-btn" data-id="${request.RequestID}"><i class="fas fa-chevron-down"></i></button></td>
      `;
      tableBody.appendChild(row);
    });

    // Render analytics
    renderAnalytics(data);

    // Process cards and map
    data.forEach(request => {
      const createdAt = new Date(request.created_at);
      const isOverdue = (new Date() - createdAt) > 7 * 24 * 60 * 60 * 1000;

      // Create request card
      const card = document.createElement('div');
      card.className = `request-card ${isOverdue ? 'overdue' : ''}`;
      card.dataset.requestId = request.RequestID;

      const statusClass = request.RequestStatus.toLowerCase() === 'pending'
        ? 'status-pending'
        : request.RequestStatus.toLowerCase() === 'approved'
        ? 'status-approved'
        : 'status-rejected';

      card.innerHTML = `
        <h3>${request.RequestTitle}</h3>
        <img src="${request.RequestImageURL}" alt="${request.RequestTitle}">
        <p><strong>Description:</strong> ${request.RequestDescription}</p>
        <p><strong>Category:</strong> ${request.RequestCategory || 'Other'}</p>
        <p><strong>Location:</strong> ${request.RequestLocation}</p>
        <p><strong>Status:</strong> <span class="status ${statusClass}">${request.RequestStatus}</span></p>
        <p><strong>Submitted:</strong> ${createdAt.toLocaleString()}</p>
        <div class="button-group">
          <button class="approve-btn" data-id="${request.RequestID}" data-user-id="${request.UserTable.UserID}" ${request.RequestStatus === 'Approved' ? 'disabled' : ''}>Approve</button>
          <button class="reject-btn" data-id="${request.RequestID}" data-user-id="${request.UserTable.UserID}" ${request.RequestStatus === 'Rejected' ? 'disabled' : ''}>Reject</button>
          <button class="details-btn" data-id="${request.RequestID}" data-user-id="${request.UserTable.UserID}">View Details</button>
          ${request.RequestStatus === 'Approved' ? `
            <button class="allocate-btn" data-id="${request.RequestID}">Allocate</button>
          ` : ''}
        </div>
      `;

      // Add click event to highlight card
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('approve-btn') || e.target.classList.contains('reject-btn') || 
            e.target.classList.contains('details-btn') || e.target.classList.contains('allocate-btn')) return;

        if (selectedCard === card) {
          card.classList.remove('selected');
          if (selectedMarker) selectedMarker.setIcon(markerIcons.default);
          selectedCard = null;
          selectedMarker = null;
        } else {
          if (selectedCard) selectedCard.classList.remove('selected');
          if (selectedMarker) selectedMarker.setIcon(markerIcons.default);
          card.classList.add('selected');
          selectedCard = card;
          selectedMarker = markers.find(m => m.requestId === request.RequestID);
          if (selectedMarker) {
            selectedMarker.setIcon(markerIcons.selected);
            map.panTo(selectedMarker.getPosition());
          }
        }
      });

      requestsDiv.appendChild(card);

      // Geocode the location and add a marker
      geocoder.geocode({ address: request.RequestLocation }, (results, status) => {
        if (status === 'OK') {
          const marker = new window.google.maps.Marker({
            map: map,
            position: results[0].geometry.location,
            title: request.RequestTitle,
            icon: markerIcons.default
          });
          marker.requestId = request.RequestID;
          markers.push(marker);

          const infoWindow = new window.google.maps.InfoWindow({
            content: `<h3>${request.RequestTitle}</h3><p>${request.RequestLocation}</p>`,
          });
          marker.addListener('click', () => {
            infoWindow.open(map, marker);
            const correspondingCard = document.querySelector(`.request-card[data-request-id="${request.RequestID}"]`);
            if (correspondingCard) {
              if (selectedCard) selectedCard.classList.remove('selected');
              if (selectedMarker) selectedMarker.setIcon(markerIcons.default);
              correspondingCard.classList.add('selected');
              selectedCard = correspondingCard;
              selectedMarker = marker;
              marker.setIcon(markerIcons.selected);
            }
          });
        } else {
          console.error(`Geocode failed for ${request.RequestLocation}: ${status}`);
        }
      });
    });

    // Adjust map bounds
    if (markers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      markers.forEach(marker => bounds.extend(marker.getPosition()));
      map.fitBounds(bounds);
    }
  } catch (error) {
    console.error('fetchRequests error:', error);
    alert('Failed to load requests. Please try again.');
  }
}

// Handle Approve/Reject actions and table interactions
let isProcessing = false;
document.addEventListener('click', async (e) => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    if (e.target.classList.contains('approve-btn') && !e.target.disabled) {
      const requestId = e.target.dataset.id;
      const userId = e.target.dataset.userId;

      // Fetch request details to determine category
      const { data: request, error } = await supabaseClient
        .from('RequestTable')
        .select('RequestCategory')
        .eq('RequestID', requestId)
        .single();

      if (error) {
        console.error('Error fetching request category:', error);
        alert('Failed to load request category. Please try again.');
        return;
      }

      // Fetch contractors based on category from ContractorTable
      const { data: contractors, error: contractError } = await supabaseClient
        .from('ContractorTable')
        .select('ContractorID, ContractorCompany')
        .eq('ContractorCategory', request.RequestCategory);

      if (contractError) {
        console.error('Error fetching contractors:', contractError);
        alert('Failed to load contractors. Please try again.');
        return;
      }

      // Show allocate modal with contractors
      const allocateModal = document.getElementById('allocate-modal');
      const contractorList = document.getElementById('contractor-list');
      contractorList.innerHTML = '';

      contractors.forEach(contractor => {
        const contractorItem = document.createElement('div');
        contractorItem.className = 'contractor-item';
        contractorItem.innerHTML = `
          <h3>${contractor.ContractorCompany}</h3>
          <button class="select-contractor-btn" data-contractor-id="${contractor.ContractorID}" data-request-id="${requestId}">Allocate to ${contractor.ContractorCompany}</button>
        `;
        contractorList.appendChild(contractorItem);
      });

      allocateModal.style.display = 'block';
    } else if (e.target.classList.contains('select-contractor-btn')) {
      const contractorId = e.target.dataset.contractorId;
      const requestId = e.target.dataset.requestId;
      //const message = prompt('Enter message to contractor:', '');

      if (message) {
        await supabaseClient
          .from('RequestTable')
          .update({ 
            ContractorID: contractorId,
            RequestStatus: 'Allocated',
           // AdminMessage: message,
            updated_at: new Date().toISOString()
          })
          .eq('RequestID', requestId);

        document.getElementById('allocate-modal').style.display = 'none';
        fetchRequests(document.getElementById('status-filter').value);
      }
    } else if (e.target.classList.contains('reject-btn') && !e.target.disabled) {
      const requestId = e.target.dataset.id;
      const userId = e.target.dataset.userId;
      openActionModal('Reject', requestId, userId);
    } else if (e.target.classList.contains('details-btn')) {
      const requestId = e.target.dataset.id;
      const userId = e.target.dataset.userId;

      try {
        // Fetch request details
        const { data: requestData, error: requestError } = await supabaseClient
          .from('RequestTable')
          .select('*, UserTable(UserID, UserUsername, UserLocation)')
          .eq('RequestID', requestId)
          .single();
        if (requestError) throw new Error(`Error fetching request: ${requestError.message}`);

        // Fetch message history
        const { data: messages, error: messageError } = await supabaseClient
          .from('RequestMessages')
          .select('*')
          .eq('RequestID', requestId)
          .order('created_at', { ascending: true });
        if (messageError) throw new Error(`Error fetching messages: ${messageError.message}`);

        openDetailsModal(requestData, requestData.UserTable, messages);
      } catch (error) {
        console.error('Error loading request details:', error);
        alert('Failed to load request details. Please try again.');
      }
    }
  } catch (error) {
    console.error('Error:', error);
    alert('An unexpected error occurred. Please try again.');
  } finally {
    isProcessing = false;
  }
});

// Handle form submission
actionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isProcessing) return;
  isProcessing = true;

  try {
    const action = actionModal.dataset.action;
    const requestId = actionModal.dataset.requestId;
    const userId = actionModal.dataset.userId;
    const message = document.getElementById('message').value.trim();
    const status = action === 'approve' ? 'Approved' : 'Rejected';
    const messageType = action === 'approve' ? 'Approval' : 'Rejection';

    // Get request title for notification
    const { data:requestData, error:requestError } = await supabaseClient
      .from('RequestTable')
      .select('RequestTitle')
      .eq('RequestID', requestId)
      .single();
    if (requestError) throw new Error(`Error fetching request: ${requestError.message}`);

    // Get admin ID
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Admin not authenticated');

    // Check if admin exists in UserTable
    const { data: adminData, error: adminError } = await supabaseClient
      .from('UserTable')
      .select('UserID')
      .eq('UserID', user.id)
      .single();

    if (adminError || !adminData) {
      console.warn('Admin not found in UserTable. Skipping notification.');
      alert('Action completed, but admin notification could not be saved. Please contact support.');
    }

    // Update request status
    const { error: updateError } = await supabaseClient
      .from('RequestTable')
      .update({ RequestStatus: status, updated_at: new Date().toISOString() })
      .eq('RequestID', requestId);
    if (updateError) throw new Error(`Error updating request status: ${updateError.message}`);

    // Save user message if provided
    if (message) {
      const { error: messageError } = await supabaseClient
        .from('RequestMessages')
        .insert({
          MessageID: crypto.randomUUID(),
          RequestID: requestId,
          UserID: userId,
          MessageContent: message,
          MessageType: messageType,
          IsRead: false,
          created_at: new Date().toISOString()
        });
      if (messageError) throw new Error(`Error saving user message: ${messageError.message}`);
    }

    // Save admin notification if admin exists
    if (adminData) {
      const adminMessage = `You ${action}d request "${requestData.RequestTitle}".`;
      const { error: adminNotificationError } = await supabaseClient
        .from('AdminNotifications')
        .insert({
          NotificationID: crypto.randomUUID(),
          AdminID: user.id,
          RequestID: requestId,
          Message: adminMessage,
          IsRead: false,
          created_at: new Date().toISOString()
        });
      if (adminNotificationError) throw new Error(`Error saving admin notification: ${adminNotificationError.message}`);
    }

    closeActionModal();
    fetchRequests(document.getElementById('status-filter').value);
    if (adminData) loadAdminNotifications(user.id);
    selectedCard = null;
    selectedMarker = null;
  } catch (error) {
    console.error('Action submission error:', error);
    alert('Failed to process action. Please try again.');
  } finally {
    isProcessing = false;
  }
});

// Handle filter change
document.getElementById('status-filter').addEventListener('change', (e) => {
  fetchRequests(e.target.value);
});

// Handle Logout
document.getElementById('logout').addEventListener('click', (e) => {
  e.preventDefault();
  alert('Logged out successfully!');
});

// Handle Language Selector
document.getElementById('language-selector').addEventListener('change', (e) => {
  const lang = e.target.value;
  alert(`Switching to ${lang === 'zu' ? 'Zulu' : lang === 'af' ? 'Afrikaans' : 'English'}. Translation not implemented.`);
});

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', async () => {
  await fetchRequests();
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) loadAdminNotifications(user.id);
});