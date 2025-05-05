import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Initialize Supabase client
const supabase = createClient(
  'https://lywylvbgsnmqwcwgiyhc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg'
);

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const requestModal = document.getElementById('request-modal');
  const editRequestModal = document.getElementById('edit-request-modal');
  const complaintModal = document.getElementById('complaint-modal');
  const feedDetailsModal = document.getElementById('feed-details-modal');
  const requestDetailsModal = document.getElementById('request-details-modal');
  const mapPickerModal = document.getElementById('map-picker-modal');
  const requestForm = document.getElementById('request-form');
  const editRequestForm = document.getElementById('edit-request-form');
  const complaintForm = document.getElementById('complaint-form');
  const openRequestModalBtn = document.getElementById('open-request-modal');
  const openComplaintModalBtn = document.getElementById('open-complaint-modal');
  const requestCloseBtn = requestModal.querySelector('.close');
  const editRequestCloseBtn = editRequestModal.querySelector('.close');
  const complaintCloseBtn = complaintModal.querySelector('.closeBtn');
  const feedDetailsCloseSpan = feedDetailsModal.querySelector('.closeBtn2');
  const requestDetailsCloseSpan = requestDetailsModal.querySelector('.closeBtn');
  const mapPickerCloseBtn = mapPickerModal.querySelector('.close');
  const mapPickerConfirmBtn = document.getElementById('map-picker-confirm');
  const useCurrentLocationBtn = document.getElementById('use-current-location');
  const editUseCurrentLocationBtn = document.getElementById('edit-use-current-location');
  const pickOnMapBtn = document.getElementById('pick-on-map');
  const editPickOnMapBtn = document.getElementById('edit-pick-on-map');
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
  let map, marker, geocoder;
  let selectedLocation = null;
  let currentModal = null;
  let notificationDropdown = null;

  // Get authenticated user
  async function getUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        showToast('You must be logged in to access the dashboard.', 'error');
        window.location.href = '/loginPage/loginPage.html';
        return null;
      }
      return user;
    } catch (err) {
      showToast('An error occurred while verifying your session.', 'error');
      return null;
    }
  }

  // Show toast notification
  function showToast(message, type = 'error') {
    Toastify({
      text: message,
      duration: 3000,
      gravity: 'top',
      position: 'right',
      backgroundColor: type === 'success' ? '#28a745' : '#ff4d4d',
      stopOnFocus: true
    }).showToast();
  }

  // Initialize Google Maps for picker
  function initMapPicker() {
    const mapElement = document.getElementById('map-picker');
    try {
      map = new google.maps.Map(mapElement, {
        center: { lat: -26.2041, lng: 28.0473 }, // Default to Johannesburg
        zoom: 12
      });
      marker = new google.maps.Marker({
        map,
        draggable: true
      });
      geocoder = new google.maps.Geocoder();

      map.addListener('click', (e) => {
        placeMarker(e.latLng);
      });

      marker.addListener('dragend', () => {
        geocodeLatLng(marker.getPosition());
      });
    } catch (error) {
      showToast('Error initializing Google Maps.', 'error');
    }
  }

  // Place marker on map
  function placeMarker(latLng) {
    marker.setPosition(latLng);
    map.panTo(latLng);
    geocodeLatLng(latLng);
  }

  // Geocode latitude and longitude to address
  async function geocodeLatLng(latLng) {
    try {
      const response = await geocoder.geocode({ location: latLng });
      if (response.results[0]) {
        selectedLocation = {
          address: response.results[0].formatted_address,
          lat: latLng.lat(),
          lng: latLng.lng()
        };
      } else {
        showToast('No address found for this location.', 'error');
        selectedLocation = null;
      }
    } catch (error) {
      showToast('Error geocoding location.', 'error');
      selectedLocation = null;
    }
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
        if (document.querySelector(`.tracker-visualization:not(.hidden)`)) {
          const requestId = document.querySelector(`.tracker-visualization:not(.hidden)`).dataset.trackerId;
          loadTracker(requestId);
        }
      })
      .subscribe();

    supabase
      .channel('user_notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'UserNotifications',
        filter: `UserID=eq.${user.id}`
      }, (payload) => {
        loadNotifications(user.id);
        showToast(`New notification: ${payload.new.Message}`, 'success');
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
      showToast('Logged out successfully.', 'success');
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

  feedDetailsCloseSpan.addEventListener('click', () => {
    feedDetailsModal.style.display = 'none';
  });

  requestDetailsCloseSpan.addEventListener('click', () => {
    requestDetailsModal.style.display = 'none';
  });

  mapPickerCloseBtn.addEventListener('click', () => {
    mapPickerModal.style.display = 'none';
    selectedLocation = null;
  });

  mapPickerConfirmBtn.addEventListener('click', () => {
    if (selectedLocation) {
      if (currentModal === 'request') {
        document.getElementById('request-location').value = selectedLocation.address;
      } else if (currentModal === 'edit-request') {
        document.getElementById('edit-request-location').value = selectedLocation.address;
      }
      mapPickerModal.style.display = 'none';
      selectedLocation = null;
    } else {
      showToast('Please select a location on the map.', 'error');
    }
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
    if (e.target === requestDetailsModal) {
      requestDetailsModal.style.display = 'none';
    }
    if (e.target === mapPickerModal) {
      mapPickerModal.style.display = 'none';
      selectedLocation = null;
    }
  });

  // Map picker buttons
  pickOnMapBtn.addEventListener('click', () => {
    currentModal = 'request';
    mapPickerModal.style.display = 'block';
    setTimeout(() => {
      if (!map) initMapPicker();
    }, 100);
  });

  editPickOnMapBtn.addEventListener('click', () => {
    currentModal = 'edit-request';
    mapPickerModal.style.display = 'block';
    setTimeout(() => {
      if (!map) initMapPicker();
    }, 100);
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
              showToast('Location fetched successfully.', 'success');
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
              showToast('Location fetched successfully.', 'success');
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

    const title = document.getElementById('request-title').value.trim();
    const category = document.getElementById('request-category').value;
    const description = document.getElementById('request-description').value.trim();
    const location = document.getElementById('request-location').value.trim();
    const imageFile = requestImageInput.files[0];

    if (title.length < 3 || description.length < 10 || location.length < 5) {
      showToast('Please provide valid title, description, and location.', 'error');
      return;
    }

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

      const requestId = crypto.randomUUID();
      const { error } = await supabase
        .from('RequestTable')
        .insert({
          RequestID: requestId,
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

      await supabase
        .from('RequestMessages')
        .insert({
          MessageID: crypto.randomUUID(),
          RequestID: requestId,
          UserID: user.id,
          MessageType: 'Submission',
          MessageContent: 'Request submitted by user.',
          SenderRole: 'User',
          created_at: new Date().toISOString()
        });

      showToast('Request submitted successfully!', 'success');
      requestModal.style.display = 'none';
      requestForm.reset();
      imagePreview.style.display = 'none';
      loadRequests(user.id);
    } catch (error) {
      showToast(`Error submitting request: ${error.message}`, 'error');
    }
  });

  // Submit edit request
  editRequestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = await getUser();
    if (!user) return;

    const requestId = document.getElementById('edit-request-id').value;
    const title = document.getElementById('edit-request-title').value.trim();
    const category = document.getElementById('edit-request-category').value;
    const description = document.getElementById('edit-request-description').value.trim();
    const location = document.getElementById('edit-request-location').value.trim();
    const imageFile = editRequestImageInput.files[0];

    if (title.length < 3 || description.length < 10 || location.length < 5) {
      showToast('Please provide valid title, description, and location.', 'error');
      return;
    }

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

      await supabase
        .from('RequestMessages')
        .insert({
          MessageID: crypto.randomUUID(),
          RequestID: requestId,
          UserID: user.id,
          MessageType: 'Update',
          MessageContent: 'Request updated by user.',
          SenderRole: 'User',
          created_at: new Date().toISOString()
        });

      showToast('Request updated successfully!', 'success');
      editRequestModal.style.display = 'none';
      editRequestForm.reset();
      editImagePreview.style.display = 'none';
      loadRequests(user.id);
    } catch (error) {
      showToast(`Error updating request: ${error.message}`, 'error');
    }
  });

  // Submit complaint
  complaintForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = await getUser();
    if (!user) return;

    const subject = document.getElementById('complaintSubject').value.trim();
    const description = document.getElementById('complaint-description').value.trim();

    if (subject.length < 3 || description.length < 10) {
      showToast('Please provide a valid subject and description.', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('ComplaintTable')
        .insert({
          ComplaintID: crypto.randomUUID(),
          UserID: user.id,
          ComplaintSubject: subject,
          ComplaintDescription: description,
          ComplaintResponse: null,
          created_at: new Date().toISOString()
        });
      if (error) throw new Error(`Error submitting complaint: ${error.message}`);

      showToast('Complaint submitted successfully!', 'success');
      complaintModal.style.display = 'none';
      complaintForm.reset();
    } catch (error) {
      showToast(`Error submitting complaint: ${error.message}`, 'error');
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
      showToast(`Error loading requests: ${error.message}`, 'error');
    }
  }

  // Render requests
  function renderRequests(requests) {
    const filterValue = statusFilter.value.toLowerCase();
    const filteredRequests = filterValue === 'all'
      ? requests
      : requests.filter(r => r.RequestStatus.toLowerCase() === filterValue);

    const tableBody = document.querySelector('.table-body');
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
              <select class="actions-dropdown" data-request-id="${request.RequestID}">
                <option value="">Select Action</option>
                ${request.RequestStatus === 'Pending' ? `<option value="edit">Edit</option>` : ''}
                ${['Pending', 'Approved', 'Rejected'].includes(request.RequestStatus) ? `<option value="delete">Delete</option>` : ''}
                <option value="view">View Details</option>
                <option value="tracker">Toggle Tracker</option>
              </select>
            </div>
          </div>
          <div class="tracker-visualization hidden" data-tracker-id="${request.RequestID}">
            <div class="tracker-content">
              <div class="status-tracker" id="status-tracker-${request.RequestID}" role="region" aria-label="Request status tracker">
                ${['Pending', 'Accepted', 'Allocated', 'Approved', 'Completed', 'Rejected'].map(status => `
                  <div class="status-circle ${request.RequestStatus === status ? 'active' : ''}">
                    <div role="status" aria-label="${status} status">
                      ${request.RequestStatus === status ? `<i class="fas fa-check"></i>` : ''}
                    </div>
                    <span>${status}</span>
                  </div>
                `).join('')}
              </div>
              <div class="tracker-timeline" id="tracker-${request.RequestID}">
                <!-- Populated by loadTracker -->
              </div>
            </div>
          </div>
        `).join('')
      : '<p>No requests found.</p>';

    // Add event listeners for dropdowns
    document.querySelectorAll('.actions-dropdown').forEach(dropdown => {
      dropdown.addEventListener('change', (e) => {
        const requestId = e.target.dataset.requestId;
        const action = e.target.value;
        e.target.value = ''; // Reset dropdown
        if (action === 'edit') {
          editRequest(requestId);
        } else if (action === 'delete') {
          deleteRequest(requestId);
        } else if (action === 'view') {
          showRequestDetails(requestId);
        } else if (action === 'tracker') {
          const tracker = document.querySelector(`.tracker-visualization[data-tracker-id="${requestId}"]`);
          tracker.classList.toggle('hidden');
          if (!tracker.classList.contains('hidden')) {
            loadTracker(requestId);
          }
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

    // Re-apply Vanilla Tilt to table rows
    VanillaTilt.init(document.querySelectorAll('.table-row'), {
      max: 10,
      speed: 400,
      glare: true,
      'max-glare': 0.2
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
      const { data: request, error: requestError } = await supabase
        .from('RequestTable')
        .select('RequestStatus')
        .eq('RequestID', requestId)
        .single();
      if (requestError) throw new Error(`Error fetching request: ${requestError.message}`);

      const statusTracker = document.getElementById(`status-tracker-${requestId}`);
      statusTracker.innerHTML = ['Pending', 'Accepted', 'Allocated', 'Approved', 'Completed', 'Rejected'].map(status => `
        <div class="status-circle ${request.RequestStatus === status ? 'active' : ''}">
          <div role="status" aria-label="${status} status">
            ${request.RequestStatus === status ? `<i class="fas fa-check"></i>` : ''}
          </div>
          <span>${status}</span>
        </div>
      `).join('');

      const { data: messages, error } = await supabase
        .from('RequestMessages')
        .select('*')
        .eq('RequestID', requestId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(`Error fetching messages: ${error.message}`);

      const trackerTimeline = document.getElementById(`tracker-${requestId}`);
      trackerTimeline.innerHTML = messages.length > 0
        ? messages.map(msg => `
            <div class="tracker-event">
              <div class="tracker-details">
                <p><strong>${msg.MessageType}</strong>: ${msg.MessageContent}</p>
                <p class="timestamp">${new Date(msg.created_at).toLocaleString()}</p>
              </div>
            </div>
          `).join('')
        : '<p>No messages available for this request.</p>';
    } catch (error) {
      showToast(`Error loading tracker: ${error.message}`, 'error');
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

      document.getElementById('edit-request-id').value = request.RequestID;
      document.getElementById('edit-request-title').value = request.RequestTitle;
      document.getElementById('edit-request-category').value = request.RequestCategory;
      document.getElementById('edit-request-description').value = request.RequestDescription;
      document.getElementById('edit-request-location').value = request.RequestLocation;
      if (request.RequestImageURL) {
        document.getElementById('edit-image-preview').src = request.RequestImageURL;
        document.getElementById('edit-image-preview').style.display = 'block';
      } else {
        document.getElementById('edit-image-preview').style.display = 'none';
      }

      editRequestModal.style.display = 'block';
    } catch (error) {
      showToast(`Error loading request: ${error.message}`, 'error');
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
      if (error) throw new Error(`Error fetching request details: ${error.message}`);

      const content = `
        <div class="modal-section">
          <h3><i class="fas fa-info-circle"></i> Request Details</h3>
          <div class="detail-card">
            <span class="detail-label"><i class="fas fa-heading"></i> Title</span>
            <span class="detail-value">${request.RequestTitle}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label"><i class="fas fa-tag"></i> Category</span>
            <span class="detail-value">${request.RequestCategory}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label"><i class="fas fa-align-left"></i> Description</span>
            <span class="detail-value">${request.RequestDescription}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label"><i class="fas fa-map-marker-alt"></i> Location</span>
            <span class="detail-value">${request.RequestLocation}</span>
          </div>
          <div class="detail-card">
            <span class="detail-label"><i class="fas fa-flag"></i> Status</span>
            <span class="detail-value"><span class="status-badge status-${request.RequestStatus.toLowerCase()}">${request.RequestStatus}</span></span>
          </div>
          ${request.RequestImageURL ? `
            <div class="detail-card image-card">
              <span class="detail-label"><i class="fas fa-image"></i> Image</span>
              <img src="${request.RequestImageURL}" alt="Request Image" class="request-image">
            </div>
          ` : ''}
          <div class="detail-card">
            <span class="detail-label"><i class="fas fa-calendar-alt"></i> Created</span>
            <span class="detail-value">${new Date(request.created_at).toLocaleString()}</span>
          </div>
        </div>
      `;
      document.getElementById('request-details-content').innerHTML = content;
      requestDetailsModal.style.display = 'block';
    } catch (error) {
      showToast(`Error loading request details: ${error.message}`, 'error');
    }
  }

  // Delete request
  async function deleteRequest(requestId) {
    const user = await getUser();
    if (!user) return;

    if (!confirm('Are you sure you want to delete this request?')) return;

    try {
      const { error } = await supabase
        .from('RequestTable')
        .delete()
        .eq('RequestID', requestId)
        .eq('UserID', user.id);
      if (error) throw new Error(`Error deleting request: ${error.message}`);

      showToast('Request deleted successfully!', 'success');
      loadRequests(user.id);
    } catch (error) {
      showToast(`Error deleting request: ${error.message}`, 'error');
    }
  }

  // Load community feed
  async function loadFeed() {
    try {
      const { data: requests, error } = await supabase
        .from('RequestTable')
        .select('*')
        .order('created_at', { ascending: false })
        .range((feedPage - 1) * feedPerPage, feedPage * feedPerPage - 1);
      if (error) throw new Error(`Error fetching feed: ${error.message}`);

      const gridContainer = document.getElementById('feed-grid');
      gridContainer.innerHTML += requests.map((request, index) => {
        const isFeatured = index === 0 && feedPage === 1;
        const categoryIcons = {
          Water: 'fas fa-tint',
          Electricity: 'fas fa-bolt',
          Plumbing: 'fas fa-wrench',
          Infrastructure: 'fas fa-road',
          Crime: 'fas fa-exclamation-triangle',
          Other: 'fas fa-question'
        };
        return `
          <div class="grid-card ${isFeatured ? 'featured' : ''} category-${request.RequestCategory.toLowerCase()}" data-request-id="${request.RequestID}">
            <div class="card-image-wrapper">
              ${request.RequestImageURL ? `<img src="${request.RequestImageURL}" alt="Feed Image">` : ''}
              <i class="${categoryIcons[request.RequestCategory] || 'fas fa-question'} category-icon"></i>
            </div>
            <div class="card-content">
              <h3>${request.RequestTitle}</h3>
              <p class="card-category">${request.RequestCategory}</p>
              <p class="card-description">${request.RequestDescription.substring(0, 100)}${request.RequestDescription.length > 100 ? '...' : ''}</p>
              <p class="card-location">${request.RequestLocation}</p>
              <button class="view-details">View Details</button>
            </div>
          </div>
        `;
      }).join('');

      if (requests.length < feedPerPage) {
        loadMoreBtn.style.display = 'none';
      }

      // Add event listeners for view details
      document.querySelectorAll('.view-details').forEach(btn => {
        btn.addEventListener('click', () => {
          const requestId = btn.closest('.grid-card').dataset.requestId;
          showFeedDetails(requestId);
        });
      });

      // Re-apply Vanilla Tilt to grid cards
      VanillaTilt.init(document.querySelectorAll('.grid-card'), {
        max: 15,
        speed: 400,
        glare: true,
        'max-glare': 0.3
      });
    } catch (error) {
      showToast(`Error loading feed: ${error.message}`, 'error');
    }
  }

  // Load more feed items
  loadMoreBtn.addEventListener('click', () => {
    feedPage++;
    loadFeed();
  });

  // Show feed details
  async function showFeedDetails(requestId) {
    try {
      const { data: request, error } = await supabase
        .from('RequestTable')
        .select('*')
        .eq('RequestID', requestId)
        .single();
      if (error) throw new Error(`Error fetching request details: ${error.message}`);

      const content = `
        <div class="modal-section">
          <h3>Request Details</h3>
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
            <span class="info-value">${request.RequestStatus}</span>
          </div>
          ${request.RequestImageURL ? `
            <div class="info-item">
              <span class="info-label">Image:</span>
              <img src="${request.RequestImageURL}" alt="Request Image" class="feed-image">
            </div>
          ` : ''}
          <div class="info-item">
            <span class="info-label">Created:</span>
            <span class="info-value">${new Date(request.created_at).toLocaleString()}</span>
          </div>
        </div>
      `;
      document.getElementById('feed-details-content').innerHTML = content;
      feedDetailsModal.style.display = 'block';
    } catch (error) {
      showToast(`Error loading feed details: ${error.message}`, 'error');
    }
  }

  // Load notifications
  async function loadNotifications(userId) {
    try {
      const { data: notifications, error } = await supabase
        .from('UserNotifications')
        .select('*, RequestTable(RequestTitle)')
        .eq('UserID', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw new Error(`Error fetching notifications: ${error.message}`);
      notificationBadge.textContent = notifications.filter(n => !n.IsRead).length;
      renderNotifications(notifications);
    } catch (error) {
      showToast(`Error loading notifications: ${error.message}`, 'error');
    }
  }

  // Render notifications
  function renderNotifications(notifications) {
    if (!notificationDropdown) {
      notificationDropdown = document.createElement('div');
      notificationDropdown.classList.add('notification-dropdown');
      document.body.appendChild(notificationDropdown);

      notificationIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationDropdown.style.display = notificationDropdown.style.display === 'block' ? 'none' : 'block';
      });

      document.addEventListener('click', () => {
        notificationDropdown.style.display = 'none';
      });

      notificationDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    notificationDropdown.innerHTML = `
      <div class="notification-header">
        <button id="clear-notifications">Clear All</button>
      </div>
      <ul class="notification-list">
        ${notifications.length > 0
          ? notifications.map(n => {
              const statusClass = n.Message.includes('accepted') ? 'notification-acceptance' :
                                 n.Message.includes('rejected') ? 'notification-rejection' :
                                 n.Message.includes('allocated') ? 'notification-allocation' :
                                 n.Message.includes('approved') ? 'notification-approval' :
                                 n.Message.includes('completed') ? 'notification-completion' :
                                 'notification-info';
              return `
                <li class="${statusClass}">
                  <strong>${n.RequestTable?.RequestTitle || 'Request'}</strong><br>
                  ${n.Message}<br>
                  <span class="timestamp">${new Date(n.created_at).toLocaleString()}</span>
                </li>
              `;
            }).join('')
          : '<li class="no-notifications">No notifications</li>'
        }
      </ul>
    `;

    const clearNotificationsBtn = document.getElementById('clear-notifications');
    clearNotificationsBtn.addEventListener('click', async () => {
      try {
        const user = await getUser();
        if (!user) return;

        const { error } = await supabase
          .from('UserNotifications')
          .delete()
          .eq('UserID', user.id);
        if (error) throw new Error(`Error clearing notifications: ${error.message}`);

        showToast('Notifications cleared successfully!', 'success');
        loadNotifications(user.id);
      } catch (error) {
        showToast(`Error clearing notifications: ${error.message}`, 'error');
      }
    });
  }

  // Status filter change
  statusFilter.addEventListener('change', () => {
    renderRequests(allRequests);
  });

  // Animate sections
  const sections = document.querySelectorAll('.animate-section');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  sections.forEach(section => {
    observer.observe(section);
  });
});