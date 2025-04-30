// Initialize Supabase client
const supabaseClient = supabase.createClient(
  'https://lywylvbgsnmqwcwgiyhc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg'
);

// Initialize Google Map
let map;
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: -33.9249, lng: 18.4241 },
    zoom: 10,
  });
}

// Fetch requests and display them
async function fetchRequests() {
  try {
    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError) {
      console.error('Error getting user:', userError);
      return;
    }

    // Fetch contractor's ID from ContractorTable
    const { data: contractorData, error: contractorError } = await supabaseClient
      .from('ContractorTable')
      .select('ContractorID')
      .eq('UserID', user.id)
      .single();

    if (contractorError || !contractorData) {
      console.error('Error fetching contractor details:', contractorError);
      return;
    }

    // Fetch requests assigned to this contractor
    const { data, error } = await supabaseClient
      .from('RequestTable')
      .select('*')
      .eq('ContractorID', contractorData.ContractorID);

    if (error) {
      console.error('Error fetching requests:', error);
      return;
    }

    // Update stats
    document.getElementById('total-requests').textContent = data.length;
    document.getElementById('pending-requests').textContent = data.filter(r => r.RequestStatus === 'Allocated').length;
    document.getElementById('accepted-requests').textContent = data.filter(r => r.RequestStatus === 'Accepted').length;
    document.getElementById('completed-requests').textContent = data.filter(r => r.RequestStatus === 'Completed').length;

    const requestsDiv = document.getElementById('requests');
    requestsDiv.innerHTML = '';

    // Process each request
    data.forEach(request => {
      const card = document.createElement('div');
      card.className = 'request-card';
      card.dataset.id = request.RequestID;

      let buttonGroup = '';
      switch (request.RequestStatus) {
        case 'Allocated':
          buttonGroup = `
            <div class="button-group">
              <button class="accept-btn" data-id="${request.RequestID}">Accept</button>
              <button class="reject-btn" data-id="${request.RequestID}">Decline</button>
              <button class="details-btn" data-id="${request.RequestID}">View Details</button>
            </div>
          `;
          break;
        case 'Accepted':
          buttonGroup = `
            <div class="button-group">
              <button class="complete-btn" data-id="${request.RequestID}">Mark as Completed</button>
              <button class="details-btn" data-id="${request.RequestID}">View Details</button>
            </div>
          `;
          break;
        case 'Completed':
          buttonGroup = `
            <div class="button-group">
              <button class="details-btn" data-id="${request.RequestID}">View Details</button>
            </div>
          `;
          break;
        default:
          buttonGroup = `
            <div class="button-group">
              <button class="details-btn" data-id="${request.RequestID}">View Details</button>
            </div>
          `;
      }

      const statusClass = request.RequestStatus.toLowerCase() === 'allocated'
        ? 'status-pending'
        : request.RequestStatus.toLowerCase() === 'accepted'
        ? 'status-approved'
        : request.RequestStatus.toLowerCase() === 'completed'
        ? 'status-approved'
        : 'status-rejected';

      card.innerHTML = `
        <h3>${request.RequestTitle}</h3>
        <img src="${request.RequestImageURL || 'https://dummyimage.com/200x150/cccccc/ffffff&text=No+Image'}" alt="${request.RequestTitle}">
        <p><strong>Description:</strong> ${request.RequestDescription}</p>
        <p><strong>Location:</strong> ${request.RequestLocation}</p>
        <p><strong>Status:</strong> <span class="status ${statusClass}">${request.RequestStatus}</span></p>
        ${buttonGroup}
      `;

      requestsDiv.appendChild(card);
    });

    // Add event listeners for buttons
    document.querySelectorAll('.details-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const requestId = btn.dataset.id;
        const { data: request, error } = await supabaseClient
          .from('RequestTable')
          .select('*')
          .eq('RequestID', requestId)
          .single();

        if (error) {
          console.error('Error fetching request details:', error);
          return;
        }

        const detailsModal = document.getElementById('request-details-modal');
        const detailsContent = document.getElementById('request-details-content');

        // Fetch message history
        const { data: messages, error: messageError } = await supabaseClient
          .from('RequestMessages')
          .select('*')
          .eq('RequestID', requestId)
          .order('created_at', { ascending: true });

        if (messageError) {
          console.error('Error fetching messages:', messageError);
        }

        // Populate modal with request details
        detailsContent.innerHTML = `
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
      });
    });

    // Add event listeners for accept button
    document.querySelectorAll('.accept-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const requestId = btn.dataset.id;
        const { error } = await supabaseClient
          .from('RequestTable')
          .update({ 
            RequestStatus: 'Accepted',
            updated_at: new Date().toISOString()
          })
          .eq('RequestID', requestId);

        if (error) {
          console.error('Error accepting request:', error);
          alert('Failed to accept request. Please try again.');
          return;
        }

        fetchRequests();
      });
    });

    // Add event listeners for complete button
    document.querySelectorAll('.complete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const requestId = btn.dataset.id;
        const { error } = await supabaseClient
          .from('RequestTable')
          .update({ 
            RequestStatus: 'Completed',
            updated_at: new Date().toISOString()
          })
          .eq('RequestID', requestId);

        if (error) {
          console.error('Error completing request:', error);
          alert('Failed to complete request. Please try again.');
          return;
        }

        fetchRequests();
      });
    });

    // Close modal when clicking the close button or outside the modal
    const modalCloseBtn = document.querySelector('#request-details-modal .close');
    modalCloseBtn.addEventListener('click', () => {
      document.getElementById('request-details-modal').style.display = 'none';
    });

    window.addEventListener('click', (event) => {
      if (event.target === document.getElementById('request-details-modal')) {
        document.getElementById('request-details-modal').style.display = 'none';
      }
    });

  } catch (error) {
    console.error('Error in fetchRequests:', error);
  }
}

// Initialize the dashboard
window.onload = () => {
  initMap();
  fetchRequests();
};

// Handle Logout
document.getElementById('logout').addEventListener('click', (e) => {
  e.preventDefault();
  alert('Logged out successfully!');
});

// Handle Language Selector
document.getElementById('language-selector').addEventListener('change', (e) => {
  const lang = e.target.value;
  alert(`Switching to ${lang === 'en' ? 'English' : lang === 'zu' ? 'Zulu' : 'Afrikaans'}. Translation not implemented.`);
});