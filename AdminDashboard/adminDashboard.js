// Initialize Supabase client
const supabaseClient = supabase.createClient('https://lywylvbgsnmqwcwgiyhc.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg');

// Initialize Google Map
let map;
let selectedCard = null;
let selectedMarker = null;
const markerIcons = {
  default: {
    url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
    scaledSize: new google.maps.Size(40, 40)
  },
  selected: {
    url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
    scaledSize: new google.maps.Size(40, 40)
  }
};

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
    card.dataset.requestId = request.RequestID; // Store request ID for reference

    const statusClass = request.RequestStatus.toLowerCase() === 'pending'
      ? 'status-pending'
      : request.RequestStatus.toLowerCase() === 'approved'
      ? 'status-approved'
      : 'status-rejected';

    card.innerHTML = `
      <h3>${request.RequestTitle}</h3>
      <img src="${request.RequestImageURL}" alt="${request.RequestTitle}">
      <p><strong>Description:</strong> ${request.RequestDescription}</p>
      <p><strong>Location:</strong> ${request.RequestLocation}</p>
      <p><strong>Status:</strong> <span class="status ${statusClass}">${request.RequestStatus}</span></p>
      <div class="button-group">
        <button class="approve-btn" data-id="${request.RequestID}" ${request.RequestStatus === 'Approved' ? 'disabled' : ''}>Approve</button>
        <button class="delete-btn" data-id="${request.RequestID}">Delete</button>
      </div>
    `;

    // Add click event to highlight card and change marker color
    card.addEventListener('click', (e) => {
      // Prevent card click from triggering when clicking buttons
      if (e.target.classList.contains('approve-btn') || e.target.classList.contains('delete-btn')) {
        return;
      }

      // If clicking the same card, deselect it
      if (selectedCard === card) {
        card.classList.remove('selected');
        if (selectedMarker) {
          selectedMarker.setIcon(markerIcons.default);
        }
        selectedCard = null;
        selectedMarker = null;
      } else {
        // Remove highlight from previously selected card
        if (selectedCard) {
          selectedCard.classList.remove('selected');
        }
        // Reset previous marker to default
        if (selectedMarker) {
          selectedMarker.setIcon(markerIcons.default);
        }

        // Highlight the clicked card
        card.classList.add('selected');
        selectedCard = card;

        // Find and update the corresponding marker
        selectedMarker = markers.find(m => m.requestId === request.RequestID);
        if (selectedMarker) {
          selectedMarker.setIcon(markerIcons.selected);
          map.panTo(selectedMarker.getPosition()); // Center map on selected marker
        }
      }
    });

    requestsDiv.appendChild(card);

    // Geocode the location and add a marker
    geocoder.geocode({ address: request.RequestLocation }, (results, status) => {
      if (status === 'OK') {
        const marker = new google.maps.Marker({
          map: map,
          position: results[0].geometry.location,
          title: request.RequestTitle,
          icon: markerIcons.default
        });
        marker.requestId = request.RequestID; // Associate marker with request ID
        markers.push(marker);

        // Add info window for the marker
        const infoWindow = new google.maps.InfoWindow({
          content: `<h3>${request.RequestTitle}</h3><p>${request.RequestLocation}</p>`,
        });
        marker.addListener('click', () => {
          infoWindow.open(map, marker);
          // Highlight corresponding card when marker is clicked
          const correspondingCard = document.querySelector(`.request-card[data-request-id="${request.RequestID}"]`);
          if (correspondingCard) {
            if (selectedCard) {
              selectedCard.classList.remove('selected');
            }
            if (selectedMarker) {
              selectedMarker.setIcon(markerIcons.default);
            }
            correspondingCard.classList.add('selected');
            selectedCard = correspondingCard;
            selectedMarker = marker;
            marker.setIcon(markerIcons.selected);
          }
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
      selectedCard = null;
      selectedMarker = null;
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
      selectedCard = null;
      selectedMarker = null;
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