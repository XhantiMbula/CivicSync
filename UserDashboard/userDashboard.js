import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Initialize Supabase client
const supabase = createClient(
  'https://lywylvbgsnmqwcwgiyhc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg'
);

document.addEventListener('DOMContentLoaded', () => {
  const requestModal = document.getElementById('request-modal');
  const editRequestModal = document.getElementById('edit-request-modal');
  const complaintModal = document.getElementById('complaint-modal');
  const feedDetailsModal = document.getElementById('feed-details-modal');
  const requestForm = document.getElementById('request-form');
  const editRequestForm = document.getElementById('edit-request-form');
  const complaintForm = document.getElementById('complaint-form');
  const openRequestModalBtn = document.getElementById('open-request-modal');
  const openComplaintModalBtn = document.getElementById('open-complaint-modal');
  const requestCloseBtn = requestModal.querySelector('.close');
  const editRequestCloseBtn = editRequestModal.querySelector('.close');
  const complaintCloseBtn = complaintModal.querySelector('.closeBtn');
  const feedDetailsCloseBtn = document.getElementById('feed-details-close');
  const feedDetailsCloseSpan = feedDetailsModal.querySelector('.closeBtn2');
  const useCurrentLocationBtn = document.getElementById('use-current-location');
  const editUseCurrentLocationBtn = document.getElementById('edit-use-current-location');
  const requestImageInput = document.getElementById('request-image');
  const editRequestImageInput = document.getElementById('edit-request-image');
  const imagePreview = document.getElementById('image-preview');
  const editImagePreview = document.getElementById('edit-image-preview');
  const statusFilter = document.getElementById('status-filter');
  const notificationIcon = document.querySelector('.notification-icon');
  const notificationBadge = document.getElementById('notification-badge');
  const logoutLink = document.querySelector('.logout');
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  const loadMoreBtn = document.getElementById('load-more');
  let allRequests = [];
  let feedPage = 1;
  const feedPerPage = 7;

  // Get authenticated user
  async function getUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        alert('You must be logged in to access the dashboard.');
        window.location.href = '/loginPage/loginPage.html';
        return null;
      }
      return user;
    } catch (err) {
      alert('An error occurred while verifying your session.');
      return null;
    }
  }

  // Show toast notification
  function showToast(message, type = 'error') {
    alert(message); // Replace with toast library in production
  }

  // Initialize dashboard
  async function initialize() {
    const user = await getUser();
    if (!user) return;

    const { data: userData } = await supabase
      .from('UserTable')
      .select('UserUsername')
      .eq('UserID', user.id)
      .single();
    document.querySelector('.welcome-head').textContent = `Welcome ${userData?.UserUsername || 'User'}`;

    loadRequests(user.id);
    loadFeed();
    loadNotifications(user.id);

    // Real-time subscriptions
    supabase
      .channel('request_table_user')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'RequestTable',
        filter: `UserID=eq.${user.id}`
      }, () => {
        loadRequests(user.id);
      })
      .subscribe();

    supabase
      .channel('request_messages_user')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'RequestMessages',
        filter: `UserID=eq.${user.id}`
      }, () => {
        loadNotifications(user.id);
      })
      .subscribe();
  }
  initialize();

  // Hamburger menu toggle
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    hamburger.parentElement.classList.toggle('active');
  });

  // Logout
  logoutLink.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showToast('Error logging out.', 'error');
    } else {
      window.location.href = '/loginPage/loginPage.html';
    }
  });

  // Modal controls
  openRequestModalBtn.addEventListener('click', () => {
    requestModal.style.display = 'block';
  });

  openComplaintModalBtn.addEventListener('click', () => {
    complaintModal.style.display = 'block';
  });

  requestCloseBtn.addEventListener('click', () => {
    requestModal.style.display = 'none';
    requestForm.reset();
    imagePreview.style.display = 'none';
  });

  editRequestCloseBtn.addEventListener('click', () => {
    editRequestModal.style.display = 'none';
    editRequestForm.reset();
    editImagePreview.style.display = 'none';
  });

  complaintCloseBtn.addEventListener('click', () => {
    complaintModal.style.display = 'none';
    complaintForm.reset();
  });

  feedDetailsCloseBtn.addEventListener('click', () => {
    feedDetailsModal.style.display = 'none';
  });

  feedDetailsCloseSpan.addEventListener('click', () => {
    feedDetailsModal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === requestModal) {
      requestModal.style.display = 'none';
      requestForm.reset();
      imagePreview.style.display = 'none';
    }
    if (e.target === editRequestModal) {
      editRequestModal.style.display = 'none';
      editRequestForm.reset();
      editImagePreview.style.display = 'none';
    }
    if (e.target === complaintModal) {
      complaintModal.style.display = 'none';
      complaintForm.reset();
    }
    if (e.target === feedDetailsModal) {
      feedDetailsModal.style.display = 'none';
    }
  });

  // Image preview for create request
  requestImageInput.addEventListener('change', () => {
    const file = requestImageInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        imagePreview.src = reader.result;
        imagePreview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    } else {
      imagePreview.style.display = 'none';
    }
  });

  // Image preview for edit request
  editRequestImageInput.addEventListener('change', () => {
    const file = editRequestImageInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        editImagePreview.src = reader.result;
        editImagePreview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    } else {
      editImagePreview.style.display = 'none';
    }
  });

  // Use current location for create request
  useCurrentLocationBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyAFM6HNEnxbn6_VvYaQ_o4n72VlAUajgmc`);
            const data = await response.json();
            if (data.results[0]) {
              document.getElementById('request-location').value = data.results[0].formatted_address;
            } else {
              showToast('Unable to find address.', 'error');
            }
          } catch (error) {
            showToast('Error fetching location.', 'error');
          }
        },
        () => {
          showToast('Unable to access location.', 'error');
        }
      );
    } else {
      showToast('Geolocation not supported.', 'error');
    }
  });

  // Use current location for edit request
  editUseCurrentLocationBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyAFM6HNEnxbn6_VvYaQ_o4n72VlAUajgmc`);
            const data = await response.json();
            if (data.results[0]) {
              document.getElementById('edit-request-location').value = data.results[0].formatted_address;
            } else {
              showToast('Unable to find address.', 'error');
            }
          } catch (error) {
            showToast('Error fetching location.', 'error');
          }
        },
        () => {
          showToast('Unable to access location.', 'error');
        }
      );
    } else {
      showToast('Geolocation not supported.', 'error');
    }
  });

  // Submit create request
  requestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = await getUser();
    if (!user) return;

    const title = document.getElementById('request-title').value;
    const category = document.getElementById('request-category').value;
    const description = document.getElementById('request-description').value;
    const location = document.getElementById('request-location').value;
    const imageFile = requestImageInput.files[0];

    try {
      let imageUrl = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('request-images')
          .upload(fileName, imageFile);
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);
        const { data } = supabase.storage.from('request-images').getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }

      const { error } = await supabase
        .from('RequestTable')
        .insert({
          RequestID: crypto.randomUUID(),
          UserID: user.id,
          RequestTitle: title,
          RequestCategory: category,
          RequestDescription: description,
          RequestLocation: location,
          RequestImageURL: imageUrl,
          RequestStatus: 'Pending',
          created_at: new Date().toISOString()
        });
      if (error) throw new Error(`Error submitting request: ${error.message}`);

      showToast('Request submitted successfully!', 'success');
      requestModal.style.display = 'none';
      requestForm.reset();
      imagePreview.style.display = 'none';
      loadRequests(user.id);
    } catch (error) {
      showToast('Error submitting request.', 'error');
    }
  });

  // Submit edit request
  editRequestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = await getUser();
    if (!user) return;

    const requestId = document.getElementById('edit-request-id').value;
    const title = document.getElementById('edit-request-title').value;
    const category = document.getElementById('edit-request-category').value;
    const description = document.getElementById('edit-request-description').value;
    const location = document.getElementById('edit-request-location').value;
    const imageFile = editRequestImageInput.files[0];

    try {
      let imageUrl = document.getElementById('edit-image-preview').src || null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('request-images')
          .upload(fileName, imageFile);
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);
        const { data } = supabase.storage.from('request-images').getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }

      const { error } = await supabase
        .from('RequestTable')
        .update({
          RequestTitle: title,
          RequestCategory: category,
          RequestDescription: description,
          RequestLocation: location,
          RequestImageURL: imageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('RequestID', requestId)
        .eq('UserID', user.id);
      if (error) throw new Error(`Error updating request: ${error.message}`);

      showToast('Request updated successfully!', 'success');
      editRequestModal.style.display = 'none';
      editRequestForm.reset();
      editImagePreview.style.display = 'none';
      loadRequests(user.id);
    } catch (error) {
      showToast('Error updating request.', 'error');
    }
  });

  // Submit complaint
  complaintForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = await getUser();
    if (!user) return;

    const title = document.getElementById('complaint-title').value;
    const description = document.getElementById('complaint-description').value;
    const location = document.getElementById('complaint-location').value;
    const requestId = document.getElementById('complaint-request-id').value || null;

    try {
      const { error } = await supabase
        .from('ComplaintTable')
        .insert({
          ComplaintID: crypto.randomUUID(),
          UserID: user.id,
          RequestID: requestId,
          ComplaintTitle: title,
          ComplaintDescription: description,
          ComplaintLocation: location,
          ComplaintStatus: 'Submitted',
          created_at: new Date().toISOString()
        });
      if (error) throw new Error(`Error submitting complaint: ${error.message}`);

      showToast('Complaint submitted successfully!', 'success');
      complaintModal.style.display = 'none';
      complaintForm.reset();
    } catch (error) {
      showToast('Error submitting complaint.', 'error');
    }
  });

  // Load requests
  async function loadRequests(userId) {
    try {
      const { data: requests, error } = await supabase
        .from('RequestTable')
        .select('*')
        .eq('UserID', userId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Error fetching requests: ${error.message}`);

      allRequests = requests;
      renderRequests(requests);
    } catch (error) {
      showToast('Error loading requests.', 'error');
    }
  }

  // Render requests
  function renderRequests(requests) {
    const filterValue = statusFilter.value.toLowerCase();
    const filteredRequests = filterValue === 'all'
      ? requests
      : requests.filter(r => r.RequestStatus.toLowerCase() === filterValue);

    const tableBody = document.getElementById('request-table-body');
    tableBody.innerHTML = filteredRequests.length > 0
      ? filteredRequests.map(request => `
          <div class="table-row" data-request-id="${request.RequestID}">
            <div>${request.RequestTitle}</div>
            <div>${request.RequestDescription}</div>
            <div>${request.RequestLocation}</div>
            <div><span class="status-badge status-${request.RequestStatus.toLowerCase()}">${request.RequestStatus}</span></div>
            <div>${request.RequestImageURL ? `<img src="${request.RequestImageURL}" class="table-image" alt="Request Image">` : '-'}</div>
            <div>${new Date(request.created_at).toLocaleDateString()}</div>
            <div class="actions">
              <button class="edit-btn" data-request-id="${request.RequestID}">Edit</button>
              <button class="delete-btn" data-request-id="${request.RequestID}">Delete</button>
              <button class="tracker-toggle" data-request-id="${request.RequestID}"><i class="fas fa-chevron-down"></i></button>
            </div>
          </div>
          <div class="tracker-visualization hidden" data-tracker-id="${request.RequestID}">
            <div class="tracker-content">
              <div class="tracker-timeline" id="tracker-${request.RequestID}">
                <!-- Populated by loadTracker -->
              </div>
            </div>
          </div>
        `).join('')
      : '<p>No requests found.</p>';

    // Add event listeners
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => editRequest(btn.dataset.requestId));
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteRequest(btn.dataset.requestId));
    });
    document.querySelectorAll('.tracker-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const requestId = btn.dataset.requestId;
        const tracker = document.querySelector(`.tracker-visualization[data-tracker-id="${requestId}"]`);
        tracker.classList.toggle('hidden');
        if (!tracker.classList.contains('hidden')) {
          loadTracker(requestId);
        }
      });
    });

    // Table sorting
    document.querySelectorAll('.table-header .sortable').forEach(header => {
      header.addEventListener('click', () => {
        const sortKey = header.dataset.sort;
        const isAscending = !header.classList.contains('sort-asc');
        document.querySelectorAll('.table-header div').forEach(h => {
          h.classList.remove('sort-asc', 'sort-desc');
          h.querySelector('i').classList.remove('fa-sort-up', 'fa-sort-down');
          h.querySelector('i').classList.add('fa-sort');
        });
        header.classList.add(isAscending ? 'sort-asc' : 'sort-desc');
        header.querySelector('i').classList.add(isAscending ? 'fa-sort-up' : 'fa-sort-down');
        sortRequests(sortKey, isAscending);
      });
    });
  }

  // Sort requests
  function sortRequests(key, ascending) {
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
        case 'image':
          valA = a.RequestImageURL ? 1 : 0;
          valB = b.RequestImageURL ? 1 : 0;
          break;
        case 'date':
          valA = new Date(a.created_at);
          valB = new Date(b.created_at);
          break;
        default:
          return 0;
      }
      return ascending ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
    });
    renderRequests(allRequests);
  }

  // Load tracker
  async function loadTracker(requestId) {
    try {
      const { data: messages, error } = await supabase
        .from('RequestMessages')
        .select('*')
        .eq('RequestID', requestId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(`Error fetching messages: ${error.message}`);

      const trackerTimeline = document.getElementById(`tracker-${requestId}`);
      trackerTimeline.innerHTML = messages.length > 0
        ? messages.map((msg, index) => `
            <div class="tracker-event">
              <div class="tracker-details">
                <p><strong>${msg.MessageType}:</strong> ${msg.MessageContent}</p>
                <p class="timestamp">${new Date(msg.created_at).toLocaleString()}</p>
              </div>
              ${index < messages.length - 1 ? '<i class="fas fa-arrow-right tracker-arrow"></i>' : ''}
            </div>
          `).join('')
        : '<p>No updates available.</p>';
    } catch (error) {
      showToast('Error loading tracker.', 'error');
    }
  }

  // Edit request
  async function editRequest(requestId) {
    try {
      const { data: request, error } = await supabase
        .from('RequestTable')
        .select('*')
        .eq('RequestID', requestId)
        .single();
      if (error) throw new Error(`Error fetching request: ${error.message}`);

      if (request.RequestStatus !== 'Pending') {
        showToast('Only pending requests can be edited.', 'error');
        return;
      }

      document.getElementById('edit-request-id').value = request.RequestID;
      document.getElementById('edit-request-title').value = request.RequestTitle;
      document.getElementById('edit-request-category').value = request.RequestCategory;
      document.getElementById('edit-request-description').value = request.RequestDescription;
      document.getElementById('edit-request-location').value = request.RequestLocation;
      if (request.RequestImageURL) {
        editImagePreview.src = request.RequestImageURL;
        editImagePreview.style.display = 'block';
      } else {
        editImagePreview.style.display = 'none';
      }

      editRequestModal.style.display = 'block';
    } catch (error) {
      showToast('Error loading request.', 'error');
    }
  }

  // Delete request
  async function deleteRequest(requestId) {
    const user = await getUser();
    if (!user) return;

    if (!confirm('Are you sure you want to delete this request?')) return;

    try {
      const { data: request, error: fetchError } = await supabase
        .from('RequestTable')
        .select('RequestStatus')
        .eq('RequestID', requestId)
        .eq('UserID', user.id)
        .single();
      if (fetchError) throw new Error(`Error fetching request: ${fetchError.message}`);

      if (request.RequestStatus !== 'Pending') {
        showToast('Only pending requests can be deleted.', 'error');
        return;
      }

      const { error } = await supabase
        .from('RequestTable')
        .delete()
        .eq('RequestID', requestId)
        .eq('UserID', user.id);
      if (error) throw new Error(`Error deleting request: ${error.message}`);

      showToast('Request deleted successfully!', 'success');
      loadRequests(user.id);
    } catch (error) {
      showToast('Error deleting request.', 'error');
    }
  }

  // Show request details
  async function showRequestDetails(requestId) {
    try {
      const { data: request, error } = await supabase
        .from('RequestTable')
        .select('*')
        .eq('RequestID', requestId)
        .single();
      if (error) throw new Error(`Error fetching request: ${error.message}`);

      const { data: messages } = await supabase
        .from('RequestMessages')
        .select('*')
        .eq('RequestID', requestId)
        .order('created_at', { ascending: true });

      feedDetailsModal.querySelector('#feed-details-content').innerHTML = `
        <div class="modal-section request-info">
          <h3>Request Information</h3>
          <div class="info-item">
            <span class="info-label">Title:</span>
            <span class="info-value">${request.RequestTitle}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Category:</span>
            <span class="info-value">${request.RequestCategory}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Description:</span>
            <span class="info-value">${request.RequestDescription}</span>
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
        ${request.RequestImageURL ? `
          <div class="modal-section image-section">
            <h3>Request Image</h3>
            <img src="${request.RequestImageURL}" alt="${request.RequestTitle}" class="feed-image">
          </div>
        ` : ''}
        <div class="modal-section message-history">
          <h3>Message History</h3>
          ${messages.length > 0 ? messages.map(msg => `
            <div class="info-item">
              <span class="info-label">${msg.MessageType}:</span>
              <span class="info-value">${msg.MessageContent} (${new Date(msg.created_at).toLocaleString()})</span>
            </div>
          `).join('') : '<p>No messages available.</p>'}
        </div>
      `;
      feedDetailsModal.style.display = 'block';
    } catch (error) {
      showToast('Error loading request details.', 'error');
    }
  }

  // Load feed
  async function loadFeed() {
    try {
      const { data: requests, error } = await supabase
        .from('RequestTable')
        .select('*, UserTable(UserUsername)')
        .neq('RequestStatus', 'Pending')
        .order('created_at', { ascending: false })
        .range((feedPage - 1) * feedPerPage, feedPage * feedPerPage - 1);
      if (error) throw new Error(`Error fetching feed: ${error.message}`);

      const feedGrid = document.getElementById('feed-grid');
      const newCards = requests.map((request, index) => {
        const isFeatured = index === 0 && feedPage === 1;
        const categoryIcons = {
          Water: 'fa-faucet',
          Electricity: 'fa-bolt',
          Plumbing: 'fa-wrench',
          Infrastructure: 'fa-road',
          Other: 'fa-info-circle'
        };
        return `
          <div class="grid-card ${isFeatured ? 'featured' : ''} category-${request.RequestCategory.toLowerCase().replace(' ', '-') || 'other'}">
            <div class="card-image-wrapper">
              ${request.RequestImageURL ? `<img src="${request.RequestImageURL}" alt="${request.RequestTitle}">` : ''}
              <i class="fas ${categoryIcons[request.RequestCategory] || 'fa-info-circle'} category-icon"></i>
            </div>
            <div class="card-content">
              <h3>${request.RequestTitle}</h3>
              <p class="card-category">${request.RequestCategory}</p>
              <p class="card-description">${request.RequestDescription.slice(0, 100)}${request.RequestDescription.length > 100 ? '...' : ''}</p>
              <p class="card-location">${request.RequestLocation}</p>
              <p><strong>Status:</strong> <span class="status-badge status-${request.RequestStatus.toLowerCase()}">${request.RequestStatus}</span></p>
              <p><strong>Posted by:</strong> ${request.UserTable.UserUsername}</p>
              <button class="view-details" data-request-id="${request.RequestID}">View Details</button>
            </div>
          </div>
        `;
      }).join('');

      if (feedPage === 1) {
        feedGrid.innerHTML = newCards;
      } else {
        feedGrid.innerHTML += newCards;
      }

      if (requests.length < feedPerPage) {
        loadMoreBtn.style.display = 'none';
      } else {
        loadMoreBtn.style.display = 'block';
      }

      document.querySelectorAll('.view-details').forEach(btn => {
        btn.addEventListener('click', () => {
          showRequestDetails(btn.dataset.requestId);
        });
      });

      VanillaTilt.init(document.querySelectorAll('.grid-card'), {
        max: 10,
        speed: 400,
        glare: true,
        'max-glare': 0.3
      });
    } catch (error) {
      showToast('Error loading feed.', 'error');
    }
  }

  // Load more feed
  loadMoreBtn.addEventListener('click', () => {
    feedPage++;
    loadFeed();
  });

  // Filter requests
  statusFilter.addEventListener('change', () => {
    renderRequests(allRequests);
  });

  // Load notifications
  async function loadNotifications(userId) {
    try {
      const { data: messages, error } = await supabase
        .from('RequestMessages')
        .select('*, RequestTable(RequestTitle)')
        .eq('UserID', userId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Error fetching notifications: ${error.message}`);

      const notificationList = document.createElement('ul');
      notificationList.className = 'notification-list';
      notificationList.innerHTML = messages.length > 0
        ? messages.map(msg => `
            <li class="notification-${msg.MessageType.toLowerCase()}">
              ${msg.MessageType} on "${msg.RequestTable.RequestTitle}": ${msg.MessageContent} (${new Date(msg.created_at).toLocaleString()})
            </li>
          `).join('')
        : '<li class="no-notifications">No notifications</li>';

      const existingDropdown = document.querySelector('.notification-dropdown');
      if (existingDropdown) {
        existingDropdown.remove();
      }

      const dropdown = document.createElement('div');
      dropdown.className = 'notification-dropdown';
      dropdown.appendChild(notificationList);
      notificationIcon.appendChild(dropdown);

      notificationBadge.textContent = messages.length;
      notificationBadge.style.display = messages.length > 0 ? 'block' : 'none';

      notificationIcon.addEventListener('click', () => {
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
      });

      document.addEventListener('click', (e) => {
        if (!notificationIcon.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.style.display = 'none';
        }
      });
    } catch (error) {
      showToast('Error loading notifications.', 'error');
    }
  }
});