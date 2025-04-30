import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Initialize Supabase client
const supabaseClient = createClient(
  'https://lywylvbgsnmqwcwgiyhc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg'
);

// Initialize Google Maps
window.initMap = function() {
  if (!window.google || !window.google.maps) {
    console.error('Google Maps API not loaded');
    return;
  }
  window.map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: -33.9249, lng: 18.4241 },
    zoom: 10,
    styles: [
      {
        featureType: 'all',
        stylers: [{ saturation: -10 }, { lightness: 20 }]
      }
    ]
  });
};

let map;
let selectedCard = null;
let selectedMarker = null;
let markers = [];
const markerIcons = {
  default: { url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png', scaledSize: null },
  selected: { url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png', scaledSize: null }
};

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

  // Get authenticated user
  async function getUser() {
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser();
      if (error || !user) {
        console.error('Authentication error:', error?.message || 'No user found');
        alert('You must be logged in to access the dashboard.');
        window.location.href = '/loginPage/loginPage.html';
        return null;
      }
      return user;
    } catch (err) {
      console.error('Error checking authentication:', err);
      alert('An error occurred while verifying your session.');
      return null;
    }
  }

  // Show toast notification
  function showToast(message, type = 'error') {
    alert(message); // Replace with toast library in production
  }

  // Load initial data
  async function initialize() {
    const user = await getUser();
    if (!user) return;

    loadRequests();
    loadAdminNotifications(user.id);

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
  }
  initialize();

  // Logout
  logoutBtn.addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
      showToast('Error logging out.', 'error');
    } else {
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
    actionModal.dataset.contractorId = contractorId || '';
    actionModal.style.display = 'block';
  }

  function closeActionModal() {
    actionModal.style.display = 'none';
    actionForm.reset();
    actionModal.dataset.action = '';
    actionModal.dataset.requestId = '';
    actionModal.dataset.userId = '';
    actionModal.dataset.contractorId = '';
  }

  actionCloseBtn.addEventListener('click', closeActionModal);
  actionCancelBtn.addEventListener('click', closeActionModal);
  window.addEventListener('click', (e) => {
    if (e.target === actionModal) closeActionModal();
  });

  // Allocate modal controls
  async function openAllocateModal(requestId, userId, category) {
    try {
      const { data: contractors, error } = await supabaseClient
        .from('ContractorTable')
        .select('ContractorID, Contractor')
        .eq('ContractorCategory', category);
      if (error) throw new Error(`Error fetching contractors: ${error.message}`);

      const contractorList = document.getElementById('contractor-list');
      contractorList.innerHTML = contractors.length > 0
        ? contractors.map(contractor => `
            <div class="contractor-item">
              <p>${contractor.ContractorCompany}</p>
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
          const message = document.getElementById('allocate-message').value;

          try {
            const { error: updateError } = await supabaseClient
              .from('RequestTable')
              .update({
                RequestStatus: 'Allocated',
                ContractorID: contractorId,
                updated_at: new Date().toISOString()
              })
              .eq('RequestID', requestId);
            if (updateError) throw new Error(`Error allocating request: ${updateError.message}`);

            // Notify contractor
            await supabaseClient
              .from('ContractorNotifications')
              .insert({
                NotificationID: crypto.randomUUID(),
                ContractorID: contractorId,
                RequestID: requestId,
                Message: `New request allocated: ${requestId}${message ? ` - ${message}` : ''}`,
                IsRead: false,
                created_at: new Date().toISOString()
              });

            // Notify user
            await supabaseClient
              .from('RequestMessages')
              .insert({
                MessageID: crypto.randomUUID(),
                RequestID: requestId,
                UserID: userId,
                MessageContent: `Your request "${requestId}" has been allocated to a contractor.${message ? ` Message: ${message}` : ''}`,
                MessageType: 'AdminMessage',
                IsRead: false,
                created_at: new Date().toISOString()
              });

            showToast('Request allocated successfully!', 'success');
            loadRequests();
            closeAllocateModal();
          } catch (error) {
            console.error('Error allocating request:', error);
            showToast('Error allocating request.', 'error');
          }
        });
      });
    } catch (error) {
      console.error('Error opening allocate modal:', error);
      showToast('Error loading contractors.', 'error');
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

  // Handle action form submission
  actionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const action = actionModal.dataset.action;
    const requestId = actionModal.dataset.requestId;
    const userId = actionModal.dataset.userId;
    const contractorId = actionModal.dataset.contractorId;
    const message = document.getElementById('message').value;

    try {
      if (action === 'approve') {
        const { data: request } = await supabaseClient
          .from('RequestTable')
          .select('RequestCategory')
          .eq('RequestID', requestId)
          .single();
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
            MessageContent: `Your request "${requestId}" has been approved.${message ? ` Message: ${message}` : ''}`,
            MessageType: 'Approval',
            IsRead: false,
            created_at: new Date().toISOString()
          });
        openAllocateModal(requestId, userId, request.RequestCategory);
      } else if (action === 'reject') {
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
            MessageContent: `Your request "${requestId}" has been rejected.${message ? ` Message: ${message}` : ''}`,
            MessageType: 'Rejection',
            IsRead: false,
            created_at: new Date().toISOString()
          });
      } else if (action === 'message') {
        await supabaseClient
          .from('RequestMessages')
          .insert({
            MessageID: crypto.randomUUID(),
            RequestID: requestId,
            UserID: userId,
            ContractorID: contractorId || null,
            MessageContent: message,
            MessageType: 'AdminMessage',
            IsRead: false,
            created_at: new Date().toISOString()
          });
        if (contractorId) {
          await supabaseClient
            .from('ContractorNotifications')
            .insert({
              NotificationID: crypto.randomUUID(),
              ContractorID: contractorId,
              RequestID: requestId,
              Message: `New message for request "${requestId}": ${message}`,
              IsRead: false,
              created_at: new Date().toISOString()
            });
        }
      }
      showToast(`${action.charAt(0).toUpperCase() + action.slice(1)} action completed successfully!`, 'success');
      loadRequests();
      closeActionModal();
    } catch (error) {
      console.error(`Error performing ${action} action:`, error);
      showToast(`Error performing ${action} action.`, 'error');
    }
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
      showToast('Failed to load notifications.', 'error');
    }
  }

  // Display notifications
  notificationIcon.addEventListener('click', async () => {
    const user = await getUser();
    if (!user) return;

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
          const statusClass = notification.Message.includes('accepted') ? 'notification-approval' :
                             notification.Message.includes('completed') ? 'notification-success' :
                             notification.Message.includes('rejected') ? 'notification-rejection' : 'notification-info';
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
      showToast('Failed to display notifications.', 'error');
    }
  });

  // Generate chart colors
  function generateColors(count) {
    const colors = [
      '#4dabf5', '#ffca28', '#26a69a', '#f06292', '#bdbdbd',
      '#81c784', '#ff8a65', '#ba68c8', '#4dd0e1', '#a1887f'
    ];
    const borderColors = [
      '#2b6cb0', '#f57c00', '#00695c', '#c2185b', '#757575',
      '#4caf50', '#f4511e', '#8e24aa', '#00acc1', '#6d4c41'
    ];
    const resultColors = [];
    const resultBorderColors = [];
    for (let i = 0; i < count; i++) {
      resultColors.push(colors[i % colors.length]);
      resultBorderColors.push(borderColors[i % borderColors.length]);
    }
    return { backgroundColors: resultColors, borderColors: resultBorderColors };
  }

  // Render analytics
  async function renderAnalytics(data) {
    if (typeof Chart === 'undefined') {
      console.error('Chart.js not loaded. Analytics charts cannot be rendered.');
      return;
    }

    try {
      const { data: categoryData, error: categoryError } = await supabaseClient
        .from('RequestTable')
        .select('RequestCategory')
        .not('RequestCategory', 'is', null);
      if (categoryError) throw new Error(`Error fetching categories: ${categoryError.message}`);

      const categories = [...new Set(categoryData.map(item => item.RequestCategory || 'Other'))];
      if (categories.length === 0) {
        categories.push('Other');
      }

      // Update KPIs
      const waterCount = data.filter(r => (r.RequestCategory || 'Other') === 'Water').length;
      const electricityCount = data.filter(r => (r.RequestCategory || 'Other') === 'Electricity').length;
      const processingTimes = data
        .filter(r => ['approved', 'rejected', 'allocated', 'accepted', 'completed'].includes(r.RequestStatus.toLowerCase()) && r.updated_at)
        .map(r => (new Date(r.updated_at) - new Date(r.created_at)) / (1000 * 60 * 60 * 24));
      const avgProcessingTime = processingTimes.length > 0
        ? (processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length).toFixed(1)
        : 0;

      document.getElementById('kpi-water').textContent = waterCount;
      document.getElementById('kpi-electricity').textContent = electricityCount;
      document.getElementById('kpi-processing-time').textContent = `${avgProcessingTime} days`;

      const { backgroundColors, borderColors } = generateColors(categories.length);

      // Status chart
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
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Request Categories' }
          }
        }
      });

      // Trend chart
      const requestsByMonth = {};
      data.forEach(request => {
        const date = new Date(request.created_at);
        const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;
        requestsByMonth[monthYear] = (requestsByMonth[monthYear] || 0) + 1;
      });

      const labels = Object.keys(requestsByMonth).sort();
      const trendData = labels.map(label => requestsByMonth[label]);

      if (trendChartInstance) trendChartInstance.destroy();
      trendChartInstance = new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Requests Over Time',
            data: trendData,
            borderColor: '#34C759',
            backgroundColor: 'rgba(52, 199, 89, 0.2)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Request Trends' }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
    } catch (error) {
      console.error('Error rendering analytics:', error);
      showToast('Error rendering analytics.', 'error');
    }
  }

  // Load and render requests
  async function loadRequests() {
    try {
      const { data: requests, error } = await supabaseClient
        .from('RequestTable')
        .select('*, UserTable(UserUsername)')
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Error fetching requests: ${error.message}`);

      allRequests = requests;
      updateStats(requests);
      renderRequestCards(requests);
      renderRequestTable(requests);
      updateMapMarkers(requests);
      renderAnalytics(requests);
    } catch (error) {
      console.error('Error loading requests:', error);
      showToast('Error loading requests.', 'error');
    }
  }

  // Update stats
  function updateStats(requests) {
    document.getElementById('total-requests').textContent = requests.length;
    document.getElementById('pending-requests').textContent = requests.filter(r => r.RequestStatus === 'Pending').length;
    document.getElementById('approved-requests').textContent = requests.filter(r => r.RequestStatus === 'Approved').length;
    document.getElementById('rejected-requests').textContent = requests.filter(r => r.RequestStatus === 'Rejected').length;
  }

  // Render request cards
  function renderRequestCards(requests) {
    const filterValue = statusFilter.value.toLowerCase();
    const filteredRequests = filterValue === 'all'
      ? requests
      : requests.filter(r => r.RequestStatus.toLowerCase() === filterValue);

    const requestsContainer = document.getElementById('requests');
    requestsContainer.innerHTML = filteredRequests.length > 0
      ? filteredRequests.map(request => `
          <div class="request-card glass-card" data-request-id="${request.RequestID}">
            <h3>${request.RequestTitle}</h3>
            <p><strong>Description:</strong> ${request.RequestDescription}</p>
            <p><strong>Location:</strong> ${request.RequestLocation}</p>
            <p><strong>Status:</strong> <span class="status-${request.RequestStatus.toLowerCase()}">${request.RequestStatus}</span></p>
            <p><strong>Submitted by:</strong> ${request.UserTable.UserUsername}</p>
            ${request.RequestImageURL ? `<img src="${request.RequestImageURL}" alt="${request.RequestTitle}" class="request-image">` : ''}
            <div class="request-actions">
              ${request.RequestStatus === 'Pending' ? `
                <button class="approve-btn request-button" data-request-id="${request.RequestID}" data-user-id="${request.UserID}">Approve</button>
                <button class="reject-btn request-button" data-request-id="${request.RequestID}" data-user-id="${request.UserID}">Reject</button>
              ` : ''}
              ${request.RequestStatus === 'Approved' ? `
                <button class="allocate-btn request-button" data-request-id="${request.RequestID}" data-user-id="${request.UserID}" data-category="${request.RequestCategory}">Allocate</button>
              ` : ''}
              ${['Allocated', 'Accepted', 'Completed'].includes(request.RequestStatus) ? `
                <button class="message-btn request-button" data-request-id="${request.RequestID}" data-user-id="${request.UserID}" data-contractor-id="${request.ContractorID || ''}">Message</button>
              ` : ''}
              <button class="details-btn request-button" data-request-id="${request.RequestID}">Details</button>
            </div>
          </div>
        `).join('')
      : '<p>No requests found.</p>';

    // Add event listeners
    document.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', () => openActionModal('Approve', btn.dataset.requestId, btn.dataset.userId));
    });
    document.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', () => openActionModal('Reject', btn.dataset.requestId, btn.dataset.userId));
    });
    document.querySelectorAll('.allocate-btn').forEach(btn => {
      btn.addEventListener('click', () => openAllocateModal(btn.dataset.requestId, btn.dataset.userId, btn.dataset.category));
    });
    document.querySelectorAll('.message-btn').forEach(btn => {
      btn.addEventListener('click', () => openActionModal('Message', btn.dataset.requestId, btn.dataset.userId, btn.dataset.contractorId));
    });
    document.querySelectorAll('.details-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const requestId = btn.dataset.requestId;
        const { data: request } = await supabaseClient
          .from('RequestTable')
          .select('*')
          .eq('RequestID', requestId)
          .single();
        const { data: userData } = await supabaseClient
          .from('UserTable')
          .select('UserUsername')
          .eq('UserID', request.UserID)
          .single();
        const { data: messages } = await supabaseClient
          .from('RequestMessages')
          .select('*')
          .eq('RequestID', requestId)
          .order('created_at', { ascending: true });
        openDetailsModal(request, userData, messages || []);
      });
    });

    // Card selection
    document.querySelectorAll('.request-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        if (selectedCard) selectedCard.classList.remove('selected');
        card.classList.add('selected');
        selectedCard = card;
        const requestId = card.dataset.requestId;
        const marker = markers.find(m => m.requestId === requestId);
        if (selectedMarker) selectedMarker.setIcon(markerIcons.default);
        if (marker) {
          marker.setIcon(markerIcons.selected);
          selectedMarker = marker;
          map.panTo(marker.getPosition());
        }
      });
    });
  }

  // Render request table
  function renderRequestTable(requests) {
    const filterValue = statusFilter.value.toLowerCase();
    const filteredRequests = filterValue === 'all'
      ? requests
      : requests.filter(r => r.RequestStatus.toLowerCase() === filterValue);

    const tbody = document.querySelector('#requests-table tbody');
    tbody.innerHTML = filteredRequests.map(request => `
      <tr data-request-id="${request.RequestID}">
        <td>${request.RequestTitle}</td>
        <td>${request.RequestDescription}</td>
        <td>${request.RequestLocation}</td>
        <td class="status-${request.RequestStatus.toLowerCase()}">${request.RequestStatus}</td>
        <td>${new Date(request.created_at).toLocaleString()}</td>
        <td>${request.UserTable.UserUsername}</td>
        <td><button class="details-btn request-button" data-request-id="${request.RequestID}">Details</button></td>
      </tr>
    `).join('');

    // Add table event listeners
    document.querySelectorAll('#requests-table .details-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const requestId = btn.dataset.requestId;
        const { data: request } = await supabaseClient
          .from('RequestTable')
          .select('*')
          .eq('RequestID', requestId)
          .single();
        const { data: userData } = await supabaseClient
          .from('UserTable')
          .select('UserUsername')
          .eq('UserID', request.UserID)
          .single();
        const { data: messages } = await supabaseClient
          .from('RequestMessages')
          .select('*')
          .eq('RequestID', requestId)
          .order('created_at', { ascending: true });
        openDetailsModal(request, userData, messages || []);
      });
    });

    // Table sorting
    const headers = document.querySelectorAll('#requests-table th[data-sort]');
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const sortKey = header.dataset.sort;
        const isAscending = !header.classList.contains('asc');
        headers.forEach(h => {
          h.classList.remove('asc', 'desc');
          h.querySelector('.fa-sort')?.classList.remove('fa-sort-up', 'fa-sort-down');
          h.querySelector('.fa-sort')?.classList.add('fa-sort');
        });
        header.classList.add(isAscending ? 'asc' : 'desc');
        header.querySelector('.fa-sort')?.classList.add(isAscending ? 'fa-sort-up' : 'fa-sort-down');
        sortTable(sortKey, isAscending);
      });
    });
  }

  // Sort table
  function sortTable(key, ascending) {
    allRequests.sort((a, b) => {
      let valA, valB;
      switch (key) {
        case 'title':
          valA = a.RequestTitle.toLowerCase();
          valB = b.RequestTitle.toLowerCase();
          break;
        case 'description':
          valA = a.RequestDescription.toLowerCase();
          valB = b.RequestDescription.toLowerCase();
          break;
        case 'location':
          valA = a.RequestLocation.toLowerCase();
          valB = b.RequestLocation.toLowerCase();
          break;
        case 'status':
          valA = a.RequestStatus.toLowerCase();
          valB = b.RequestStatus.toLowerCase();
          break;
        case 'submitted':
          valA = new Date(a.created_at);
          valB = new Date(b.created_at);
          break;
        case 'username':
          valA = a.UserTable.UserUsername.toLowerCase();
          valB = b.UserTable.UserUsername.toLowerCase();
          break;
        default:
          return 0;
      }
      return ascending ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
    });
    renderRequestCards(allRequests);
    renderRequestTable(allRequests);
  }

  // Update map markers
  async function updateMapMarkers(requests) {
    if (!map) return;

    markers.forEach(marker => marker.setMap(null));
    markers = [];

    for (const request of requests) {
      try {
        const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(request.RequestLocation)}&key=AIzaSyAFM6HNEnxbn6_VvYaQ_o4n72VlAUajgmc`);
        const data = await response.json();
        if (data.results && data.results[0]) {
          const { lat, lng } = data.results[0].geometry.location;
          const marker = new google.maps.Marker({
            position: { lat, lng },
            map,
            title: request.RequestTitle,
            icon: markerIcons.default,
            requestId: request.RequestID
          });
          marker.addListener('click', () => {
            if (selectedMarker) selectedMarker.setIcon(markerIcons.default);
            marker.setIcon(markerIcons.selected);
            selectedMarker = marker;
            if (selectedCard) selectedCard.classList.remove('selected');
            selectedCard = document.querySelector(`.request-card[data-request-id="${request.RequestID}"]`);
            if (selectedCard) selectedCard.classList.add('selected');
            map.panTo(marker.getPosition());
          });
          markers.push(marker);
        }
      } catch (error) {
        console.error(`Error geocoding location for request ${request.RequestID}:`, error);
      }
    }
  }

  // Status filter
  statusFilter.addEventListener('change', () => {
    renderRequestCards(allRequests);
    renderRequestTable(allRequests);
  });
});