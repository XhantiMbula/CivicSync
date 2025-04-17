// Initialize Supabase client using a different variable name
const supabaseClient = supabase.createClient('https://lywylvbgsnmqwcwgiyhc.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg');

// Initialize Google Map
let map;
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: -33.9249, lng: 18.4241 }, // Center on Cape Town
    zoom: 10,
  });
}

// Fetch requests and display them
async function fetchRequests() {
  const { data, error } = await supabaseClient.from('RequestTable').select('*');
  if (error) {
    console.error('Error fetching requests:', error);
    return;
  }

  // Update stats
  const totalRequests = data.length;
  const pendingRequests = data.filter(r => r.RequestStatus.toLowerCase() === 'pending').length;
  const approvedRequests = data.filter(r => r.RequestStatus.toLowerCase() === 'approved').length;
  const rejectedRequests = data.filter(r => r.RequestStatus.toLowerCase() === 'rejected').length;

  document.getElementById('total-requests').textContent = totalRequests;
  document.getElementById('pending-requests').textContent = pendingRequests;
  document.getElementById('approved-requests').textContent = approvedRequests;
  document.getElementById('rejected-requests').textContent = rejectedRequests;

  const requestsDiv = document.getElementById('requests');
  requestsDiv.innerHTML = ''; // Clear existing cards

  const geocoder = new google.maps.Geocoder();
  const markers = [];

  // Process each request
  data.forEach(request => {
    // Create request card
    const card = document.createElement('div');
    card.className = 'request-card';

    const statusClass = request.RequestStatus.toLowerCase() === 'pending'
      ? 'status-pending'
      : request.RequestStatus.toLowerCase() === 'approved'
      ? 'status-approved'
      : 'status-rejected';

    card.innerHTML = `
      <h3>${request.RequestTitle}</h3>
      <img src="${request.RequestImageURL}" alt="${request.RequestTitle}">
      <p><strong>Description:</strong> ${request.RequestDescription}</p>
      <p><strong>Location:</strong> ${request.RequestLocation}</UGGEST>
      <p><strong>Status:</strong> <span class="status ${statusClass}">${request.RequestStatus}</span></p>
      <div class="button-group">
        <button class="approve-btn" data-id="${request.RequestID}" ${request.RequestStatus === 'Approved' ? 'disabled' : ''}>Approve</button>
        <button class="delete-btn" data-id="${request.RequestID}">Delete</button>
      </div>
    `;

    requestsDiv.appendChild(card);

    // Geocode the location and add a marker
    geocoder.geocode({ address: request.RequestLocation }, (results, status) => {
      if (status === 'OK') {
        const marker = new google.maps.Marker({
          map: map,
          position: results[0].geometry.location,
          title: request.RequestTitle,
        });
        markers.push(marker);

        // Add info window for the marker
        const infoWindow = new google.maps.InfoWindow({
          content: `<h3>${request.RequestTitle}</h3><p>${request.RequestLocation}</p>`,
        });
        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
      } else {
        console.error('Geocode failed for', request.RequestLocation, status);
      }
    });
  });

  // Adjust map bounds to fit all markers
  if (markers.length > 0) {
    const bounds = new google.maps.LatLngBounds();
    markers.forEach(marker => bounds.extend(marker.getPosition()));
    map.fitBounds(bounds);
  }
}

// Handle Approve button click
document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('approve-btn') && !e.target.disabled) {
    const requestId = e.target.dataset.id;
    const { error } = await supabaseClient
      .from('RequestTable')
      .update({ RequestStatus: 'Approved' })
      .eq('RequestID', requestId);

    if (error) {
      console.error('Error approving request:', error);
    } else {
      fetchRequests(); // Refresh the dashboard
    }
  }
});

// Handle Delete button click
document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const requestId = e.target.dataset.id;
    const { error } = await supabaseClient
      .from('RequestTable')
      .delete()
      .eq('RequestID', requestId);

    if (error) {
      console.error('Error deleting request:', error);
    } else {
      fetchRequests(); // Refresh the dashboard
    }
  }
});

// Handle Logout (mock)
document.getElementById('logout').addEventListener('click', (e) => {
  e.preventDefault();
  alert('Logged out successfully!');
  // In a real app, redirect to login page or clear session
});

// Handle Language Selector (mock translation)
document.getElementById('language-selector').addEventListener('change', (e) => {
  const lang = e.target.value;
  if (lang === 'zu') {
    alert('Switching to Zulu (isiZulu) - Translation not implemented yet.');
  } else if (lang === 'af') {
    alert('Switching to Afrikaans - Translation not implemented yet.');
  } else {
    alert('Switching to English.');
  }
  // In a real app, update UI text based on language
});

// Initialize the dashboard
window.onload = () => {
  initMap();
  fetchRequests();
};