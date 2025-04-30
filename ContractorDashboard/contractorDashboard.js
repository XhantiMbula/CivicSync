import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Initialize Supabase client
const supabase = createClient(
  'https://lywylvbgsnmqwcwgiyhc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg'
);

document.addEventListener('DOMContentLoaded', () => {
  const updateStatusModal = document.getElementById('update-status-modal');
  const updateStatusForm = document.getElementById('update-status-form');
  const updateStatusCloseBtn = updateStatusModal.querySelector('.close');
  const statusFilter = document.getElementById('status-filter');
  const notificationIcon = document.querySelector('.notification-icon');
  const notificationBadge = document.getElementById('notification-badge');
  const logoutLink = document.querySelector('.logout');
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  let allRequests = [];

  // Get authenticated contractor
  async function getContractor() {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        alert('You must be logged in to access the dashboard.');
        window.location.href = '/loginPage/loginPage.html';
        return null;
      }

      // Debug: Log user ID
      console.log('Authenticated user ID:', user.id);

      // Query ContractorTable with case-sensitive column names
      const { data: contractor, error: contractorError } = await supabase
        .from('ContractorTable')
        .select('ContractorID, ContractorName')
        .eq('UserID', user.id)
        .single();

      if (contractorError) {
        console.error('Contractor query error:', contractorError);
        alert(`Error fetching contractor profile: ${contractorError.message}`);
        window.location.href = '/loginPage/loginPage.html';
        return null;
      }

      if (!contractor) {
        console.error('No contractor profile found for UserID:', user.id);
        alert('Contractor profile not found. Please ensure your account is linked to a contractor profile.');
        window.location.href = '/loginPage/loginPage.html';
        return null;
      }

      console.log('Contractor profile found:', contractor);
      return { user, contractor };
    } catch (err) {
      console.error('Unexpected error in getContractor:', err);
      alert('An unexpected error occurred while verifying your session.');
      window.location.href = '/loginPage/loginPage.html';
      return null;
    }
  }

  // Show toast notification
  function showToast(message, type = 'error') {
    alert(message); // Replace with toast library in production
  }

  // Initialize dashboard
  async function initialize() {
    const contractorData = await getContractor();
    if (!contractorData) return;
    const { user, contractor } = contractorData;

    document.querySelector('.welcome-head').textContent = `Welcome, ${contractor.ContractorName}`;

    loadRequests(contractor.ContractorID);
    loadNotifications(contractor.ContractorID);

    // Real-time subscriptions
    supabase
      .channel('request_table_contractor')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'RequestTable',
        filter: `ContractorID=eq.${contractor.ContractorID}`
      }, () => {
        loadRequests(contractor.ContractorID);
      })
      .subscribe();

    supabase
      .channel('request_messages_contractor')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'RequestMessages',
        filter: `ContractorID=eq.${contractor.ContractorID}`
      }, () => {
        loadNotifications(contractor.ContractorID);
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
  updateStatusCloseBtn.addEventListener('click', () => {
    updateStatusModal.style.display = 'none';
    updateStatusForm.reset();
  });

  window.addEventListener('click', (e) => {
    if (e.target === updateStatusModal) {
      updateStatusModal.style.display = 'none';
      updateStatusForm.reset();
    }
  });

  // Submit update status
  updateStatusForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const contractorData = await getContractor();
    if (!contractorData) return;
    const { user, contractor } = contractorData;

    const requestId = document.getElementById('update-request-id').value;
    const status = document.getElementById('update-status').value;
    const message = document.getElementById('update-message').value.trim();

    try {
      // Update request status
      const { error: updateError } = await supabase
        .from('RequestTable')
        .update({
          RequestStatus: status,
          updated_at: new Date().toISOString()
        })
        .eq('RequestID', requestId)
        .eq('ContractorID', contractor.ContractorID);
      if (updateError) {
        console.error('Supabase update error:', updateError);
        throw new Error(`Error updating status: ${updateError.message}`);
      }

      // Add message to RequestMessages if provided
      if (message) {
        const { data: request, error: fetchError } = await supabase
          .from('RequestTable')
          .select('UserID')
          .eq('RequestID', requestId)
          .single();
        if (fetchError) {
          console.error('Supabase fetch error:', fetchError);
          throw new Error(`Error fetching request: ${fetchError.message}`);
        }

        const { error: messageError } = await supabase
          .from('RequestMessages')
          .insert({
            MessageID: crypto.randomUUID(),
            RequestID: requestId,
            UserID: request.UserID,
            ContractorID: contractor.ContractorID,
            MessageType: 'Contractor Update',
            MessageContent: message,
            created_at: new Date().toISOString()
          });
        if (messageError) {
          console.error('Supabase insert error:', messageError);
          throw new Error(`Error sending message: ${messageError.message}`);
        }
      }

      showToast('Status updated successfully!', 'success');
      updateStatusModal.style.display = 'none';
      updateStatusForm.reset();
      loadRequests(contractor.ContractorID);
    } catch (error) {
      console.error('Update status error:', error);
      showToast(`Error updating status: ${error.message}`, 'error');
    }
  });

  // Load requests
  async function loadRequests(contractorId) {
    try {
      const { data: requests, error } = await supabase
        .from('RequestTable')
        .select('*')
        .eq('ContractorID', contractorId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase fetch error:', error);
        throw new Error(`Error fetching requests: ${error.message}`);
      }

      allRequests = requests || [];
      renderRequests(allRequests);
    } catch (error) {
      console.error('Load requests error:', error);
      showToast(`Error loading requests: ${error.message}`, 'error');
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
            <div>${request.RequestID}</div>
            <div>${request.RequestTitle}</div>
            <div>${request.RequestCategory}</div>
            <div>${request.RequestLocation}</div>
            <div><span class="status-badge status-${request.RequestStatus.toLowerCase()}">${request.RequestStatus}</span></div>
            <div>${request.RequestImageURL ? `<img src="${request.RequestImageURL}" class="table-image" alt="Request Image">` : '-'}</div>
            <div class="actions">
              <button class="update-btn" data-request-id="${request.RequestID}">Update Status</button>
            </div>
          </div>
        `).join('')
      : '<p>No assigned requests found.</p>';

    // Add event listeners
    document.querySelectorAll('.update-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('update-request-id').value = btn.dataset.requestId;
        updateStatusModal.style.display = 'block';
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
        case 'requestId':
          valA = a.RequestID;
          valB = b.RequestID;
          break;
        case 'title':
          valA = a.RequestTitle.toLowerCase();
          valB = b.RequestTitle.toLowerCase();
          break;
        case 'category':
          valA = a.RequestCategory.toLowerCase();
          valB = b.RequestCategory.toLowerCase();
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
        default:
          return 0;
      }
      return ascending ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
    });
    renderRequests(allRequests);
  }

  // Load notifications
  async function loadNotifications(contractorId) {
    try {
      const { data: messages, error } = await supabase
        .from('RequestMessages')
        .select('*')
        .eq('ContractorID', contractorId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase fetch error:', error);
        throw new Error(`Error fetching notifications: ${error.message}`);
      }

      const unreadCount = messages.filter(m => !m.isRead).length;
      notificationBadge.textContent = unreadCount;

      // Add notification dropdown (simplified)
      notificationIcon.addEventListener('click', () => {
        alert(`You have ${unreadCount} new notifications.`); // Replace with dropdown in production
      });
    } catch (error) {
      console.error('Load notifications error:', error);
      showToast(`Error loading notifications: ${error.message}`, 'error');
    }
  }
});