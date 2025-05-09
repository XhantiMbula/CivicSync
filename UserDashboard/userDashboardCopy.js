// Store the original form handler at the beginning
let originalFormHandler = null;

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById("request-modal");
    const addRequestButton = document.getElementById("add-request-button");
    const closeBtn = document.querySelector(".close");
    const requestForm = document.getElementById("add-request-form");
    const requestTableBody = document.querySelector("#request-table .table-body");
    const modalCancelButton = document.querySelector(".modal-cancel-button");
    const profileIcon = document.querySelector('.profile-icon');
    const dashboardContainer = document.querySelector('.dashboard-container');
    const logoutLink = document.querySelector('.logout');
    const welcomeHead = document.querySelector('.welcome-head');
    const notificationIcon = document.querySelector('.notification-icon');
    const notificationBadge = document.getElementById('notification-badge');
    const complaintModal = document.getElementById('complaintModal');
    const viewComplaintModal = document.getElementById('viewComplaintModal');
    const addComplaintBtn = document.getElementById('addComplaintBtn');
    const viewComplaintBtn = document.getElementById('viewComplaintBtn');
    const closeComplaintBtn = complaintModal.querySelector('.closeBtn');
    const closeViewComplaintBtn = viewComplaintModal.querySelector('.closeBtn2');
    const complaintForm = document.getElementById('complaintForm');

    const completedRequestsSection = document.querySelector('.completed-requests');
    const updatedRequestsSection = document.querySelector('.updated-requests');
    const pendingRequestsSection = document.querySelector('.pending-requests');

    if (!window.supabase) {
        console.error('Supabase client not initialized.');
        alert('Application error: Supabase client not found.');
        return;
    }

    // Google Maps Autocomplete
    let autocomplete;
    const locationInput = document.getElementById('location');
    const locationOptions = document.querySelectorAll('input[name="location-type"]');

    function initializeAutocomplete() {
        if (window.google && window.google.maps) {
            autocomplete = new google.maps.places.Autocomplete(locationInput, {
                types: ['address'],
                fields: ['formatted_address']
            });
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place.formatted_address) {
                    locationInput.value = place.formatted_address;
                }
            });
        } else {
            console.error('Google Maps API not loaded.');
            showToast('Location services unavailable. Please enter address manually.', 'error');
        }
    }

    // Geolocation
    function getCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=YOUR_API_KEY`)
                        .then(response => response.json())
                        .then(data => {
                            if (data.results && data.results[0]) {
                                locationInput.value = data.results[0].formatted_address;
                            } else {
                                showToast('Unable to find address for current location.', 'error');
                            }
                        })
                        .catch(error => {
                            console.error('Geocoding error:', error);
                            showToast('Error fetching address. Please try again.', 'error');
                        });
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    showToast('Unable to access location. Please allow location permissions or enter address manually.', 'error');
                }
            );
        } else {
            showToast('Geolocation not supported by your browser.', 'error');
        }
    }

    // Handle radio button changes
    locationOptions.forEach(option => {
        option.addEventListener('change', () => {
            if (option.value === 'current') {
                locationInput.disabled = true;
                locationInput.value = 'Fetching location...';
                getCurrentLocation();
            } else {
                locationInput.disabled = false;
                locationInput.value = '';
                locationInput.focus();
            }
        });
    });

    // Initialize autocomplete when Google Maps API loads
    if (document.readyState === 'complete') {
        initializeAutocomplete();
    } else {
        window.addEventListener('load', initializeAutocomplete);
    }

    async function getUser() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
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

    function showToast(message, type = 'error') {
        alert(message);
    }

    async function checkUserOnLoad() {
        const user = await getUser();
        if (!user) return;
        const { data: userData, error } = await supabase
            .from('UserTable')
            .select('UserUsername')
            .eq('UserID', user.id)
            .single();
        if (error) {
            console.error('Error fetching user data:', error.message);
        } else {
            welcomeHead.textContent = `Welcome ${userData.UserUsername || 'User'}`;
        }
        loadUserRequests();
        loadFeed();
        loadNotifications();
    }
    checkUserOnLoad();

    logoutLink.addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error logging out:', error);
            showToast('Error logging out.', 'error');
        } else {
            window.location.href = '/loginPage/loginPage.html';
        }
    });

    addRequestButton.addEventListener("click", async () => {
        const user = await getUser();
        if (user) {
            modal.style.display = "block";
            locationOptions[0].checked = true; // Reset to manual
            locationInput.disabled = false;
            locationInput.value = '';
        }
    });

    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
        resetFormToDefaultBehavior();
    });

    modalCancelButton.addEventListener("click", () => {
        modal.style.display = "none";
        resetFormToDefaultBehavior();
    });

    window.addEventListener("click", (event) => {
        if (event.target === modal) modal.style.display = "none";
        if (event.target === complaintModal) complaintModal.style.display = "none";
        if (event.target === viewComplaintModal) viewComplaintModal.style.display = "none";
    });

    // Store the original submit handler
    originalFormHandler = async (event) => {
        event.preventDefault();
        const user = await getUser();
        if (!user) return;

        const title = document.getElementById("title").value;
        const category = document.getElementById("category").value;
        const imageInput = document.getElementById("image");
        const description = document.getElementById("description").value;
        const location = document.getElementById("location").value;
        const status = "Pending";
        const userId = user.id;

        let imageURL = "";
        if (imageInput.files && imageInput.files[0]) {
            const file = imageInput.files[0];
            if (!file.type.startsWith('image/')) {
                showToast('Please upload a valid image file.', 'error');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                showToast('Image size must be less than 5MB.', 'error');
                return;
            }

            const fileName = `request-images/${userId}/${Date.now()}-${file.name}`;
            try {
                const { error: uploadError } = await supabase.storage
                    .from('request-images')
                    .upload(fileName, file, { cacheControl: '3600', upsert: false });
                if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

                const { data: urlData } = supabase.storage
                    .from('request-images')
                    .getPublicUrl(fileName);
                imageURL = urlData.publicUrl;
                if (!imageURL) throw new Error('Failed to retrieve public URL.');
            } catch (error) {
                console.error('Error during image upload:', error);
                showToast('An error occurred while uploading the image.', 'error');
                return;
            }
        }

        try {
            const requestData = {
                RequestID: crypto.randomUUID(),
                RequestTitle: title,
                RequestCategory: category,
                RequestImageURL: imageURL,
                RequestDescription: description,
                RequestLocation: location,
                RequestStatus: status,
                UserID: userId,
                created_at: new Date().toISOString()
            };
            const { error: requestError } = await supabase
                .from('RequestTable')
                .insert([requestData]);
            if (requestError) throw new Error(`Request insertion failed: ${requestError.message}`);

            showToast('Request submitted successfully!', 'success');
            loadUserRequests();
            loadFeed();
            modal.style.display = "none";
            requestForm.reset();
        } catch (error) {
            console.error('Error during request submission:', error);
            showToast('An error occurred while submitting the request.', 'error');
        }
    };

    // Assign the original handler
    requestForm.addEventListener("submit", originalFormHandler);

    function resetFormToDefaultBehavior() {
        // Remove any custom onsubmit handlers
        requestForm.onsubmit = null;
        
        // Reset form fields
        requestForm.reset();
        
        // Re-attach the original event listener if it was removed
        const newHandler = requestForm.onsubmit;
        if (!newHandler) {
            requestForm.addEventListener("submit", originalFormHandler);
        }
    }

    async function loadUserRequests() {
        const user = await getUser();
        if (!user) return;

        try {
            const { data: requests, error } = await supabase
                .from('RequestTable')
                .select('*')
                .eq('UserID', user.id)
                .order('created_at', { ascending: false });
            if (error) throw new Error(`Error fetching requests: ${error.message}`);

            requestTableBody.innerHTML = '';
            requests.forEach((request, index) => {
                const row = document.createElement('div');
                row.classList.add('table-row');
                row.innerHTML = `
                    <div>${request.RequestTitle}</div>
                    <div>${request.RequestCategory}</div>
                    <div>${request.RequestImageURL ? `<img src="${request.RequestImageURL}" alt="Request Image">` : 'No Image'}</div>
                    <div>${request.RequestDescription}</div>
                    <div>${request.RequestLocation}</div>
                    <div>${request.RequestStatus}</div>
                    <div>
                        <button onclick="editRequest('${request.RequestID}')">Edit</button>
                        <button onclick="deleteRequest('${request.RequestID}')">Delete</button>
                    </div>
                `;
                requestTableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading requests:', error);
            showToast('Error loading your requests.', 'error');
        }
    }

    async function loadFeed() {
        const user = await getUser();
        if (!user) return;

        try {
            const { data: requests, error } = await supabase
                .from('RequestTable')
                .select('*')
                .eq('UserID', user.id)
                .order('created_at', { ascending: false });
            if (error) {
                console.error('Error fetching feed requests:', error.message);
                showToast('Error loading feed.', 'error');
                return;
            }

            completedRequestsSection.querySelectorAll('.feed-item').forEach(item => item.remove());
            updatedRequestsSection.querySelectorAll('.feed-item').forEach(item => item.remove());
            pendingRequestsSection.querySelectorAll('.feed-item').forEach(item => item.remove());

            requests.forEach(request => {
                const feedItem = document.createElement('div');
                feedItem.classList.add('feed-item');
                feedItem.innerHTML = `
                    <img src="${request.RequestImageURL || 'https://dummyimage.com/200x150/cccccc/ffffff&text=Image+Not+Found'}" 
                         alt="Request Image" 
                         onerror="this.onerror=null; this.src='https://dummyimage.com/200x150/cccccc/ffffff&text=Image+Not+Found';">
                    <div class="feed-item-content">
                        <p class="feed-item-description">${request.RequestDescription}</p>
                        <p class="feed-item-location">Location: ${request.RequestLocation}</p>
                    </div>
                `;
                if (request.RequestStatus === 'Completed') {
                    completedRequestsSection.appendChild(feedItem);
                } else if (request.RequestStatus === 'Updated') {
                    updatedRequestsSection.appendChild(feedItem);
                } else if (request.RequestStatus === 'Pending') {
                    pendingRequestsSection.appendChild(feedItem);
                }
            });

            if (!completedRequestsSection.querySelector('.feed-item')) {
                completedRequestsSection.innerHTML += '<p>No completed requests.</p>';
            }
            if (!updatedRequestsSection.querySelector('.feed-item')) {
                updatedRequestsSection.innerHTML += '<p>No updated requests.</p>';
                updatedRequestsSection.innerHTML += '<p>No updated requests.</p>';
            }
            if (!pendingRequestsSection.querySelector('.feed-item')) {
                pendingRequestsSection.innerHTML += '<p>No pending requests.</p>';
            }
        } catch (error) {
            console.error('Error loading feed:', error);
            showToast('Error loading feed.', 'error');
        }
    }

    async function loadNotifications() {
        const user = await getUser();
        if (!user) return;

        try {
            const { data: messages, error } = await supabase
                .from('RequestMessages')
                .select('*, RequestTable(RequestTitle)')
                .eq('UserID', user.id)
                .eq('IsRead', false)
                .order('created_at', { ascending: false });
            if (error) throw new Error(`Error fetching notifications: ${error.message}`);

            notificationBadge.textContent = messages.length;
        } catch (error) {
            console.error('Error loading notifications:', error);
            showToast('Error loading notifications.', 'error');
        }
    }

    notificationIcon.addEventListener('click', async () => {
        const user = await getUser();
        if (!user) return;

        const existingDropdown = document.getElementById('notification-dropdown');
        if (existingDropdown) {
            existingDropdown.remove();
            return;
        }

        try {
            const { data: messages, error } = await supabase
                .from('RequestMessages')
                .select('*, RequestTable(RequestTitle)')
                .eq('UserID', user.id)
                .order('created_at', { ascending: false });
            if (error) throw new Error(`Error fetching notifications: ${error.message}`);

            const dropdown = document.createElement('div');
            dropdown.id = 'notification-dropdown';
            dropdown.classList.add('notification-dropdown');

            if (messages.length === 0) {
                dropdown.innerHTML = '<p class="no-notifications">No new notifications.</p>';
            } else {
                let html = '<ul class="notification-list">';
                messages.forEach(message => {
                    const statusClass = message.MessageType === 'Approval' ? 'notification-approval' : 'notification-rejection';
                    html += `
                        <li class="${statusClass}">
                            <strong>${message.RequestTable.RequestTitle}</strong><br>
                            ${message.MessageContent}<br>
                            <small>${new Date(message.created_at).toLocaleString()}</small>
                        </li>
                    `;
                });
                html += '</ul>';
                dropdown.innerHTML = html;
            }

            dashboardContainer.appendChild(dropdown);

            const unreadMessageIds = messages.filter(m => !m.IsRead).map(m => m.MessageID);
            if (unreadMessageIds.length > 0) {
                const { error: updateError } = await supabase
                    .from('RequestMessages')
                    .update({ IsRead: true })
                    .in('MessageID', unreadMessageIds);
                if (updateError) console.error('Error marking notifications as read:', updateError);
                notificationBadge.textContent = '0';
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
            showToast('Error displaying notifications.', 'error');
        }
    });

    // FIXED EDIT REQUEST FUNCTION
    async function editRequest(requestId) {
        const { data: request, error } = await supabase
            .from('RequestTable')
            .select('*')
            .eq('RequestID', requestId)
            .single();
        if (error) {
            console.error('Error fetching request for edit:', error.message);
            showToast(`Error fetching request: ${error.message}`, 'error');
            return;
        }

        // Fill the form with existing data
        document.getElementById('title').value = request.RequestTitle;
        document.getElementById('category').value = request.RequestCategory;
        document.getElementById('description').value = request.RequestDescription;
        document.getElementById('location').value = request.RequestLocation;
        document.querySelector('input[name="location-type"][value="manual"]').checked = true;
        locationInput.disabled = false;

        // Show the modal
        modal.style.display = 'block';

        // IMPORTANT: Remove the default form submission handler
        // Clear any existing event listeners by cloning the form
        const oldForm = requestForm;
        const newForm = oldForm.cloneNode(true);
        oldForm.parentNode.replaceChild(newForm, oldForm);
        
        // Add the edit-specific submit handler
        newForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const updatedTitle = document.getElementById('title').value;
            const updatedCategory = document.getElementById('category').value;
            const updatedDescription = document.getElementById('description').value;
            const updatedLocation = document.getElementById('location').value;

            // Perform the update operation
            const { error: updateError } = await supabase
                .from('RequestTable')
                .update({
                    RequestTitle: updatedTitle,
                    RequestCategory: updatedCategory,
                    RequestDescription: updatedDescription,
                    RequestLocation: updatedLocation,
                    RequestStatus: 'Updated',
                    updated_at: new Date().toISOString()
                })
                .eq('RequestID', requestId);

            if (updateError) {
                console.error('Error updating request:', updateError.message);
                showToast(`Error updating request: ${updateError.message}`, 'error');
            } else {
                showToast('Request updated successfully!', 'success');
                loadUserRequests();
                loadFeed();
                modal.style.display = 'none';
                
                // Reset the form to default behavior
                resetFormToDefaultBehavior();
            }
        });
        
        // Store reference to the new form
        requestForm = newForm;
    }

    async function deleteRequest(requestId) {
        if (confirm('Are you sure you want to delete this request?')) {
            const { error } = await supabase
                .from('RequestTable')
                .delete()
                .eq('RequestID', requestId);
            if (error) {
                console.error('Error deleting request:', error.message);
                showToast(`Error deleting request: ${error.message}`, 'error');
            } else {
                showToast('Request deleted successfully!', 'success');
                loadUserRequests();
                loadFeed();
            }
        }
    }

    profileIcon.addEventListener('click', async () => {
        const user = await getUser();
        if (!user) return;

        const { data: userData, error } = await supabase
            .from('UserTable')
            .select('UserUsername, UserLocation')
            .eq('UserID', user.id)
            .single();
        if (error) {
            console.error('Error fetching user data:', error.message);
            showToast('Error loading profile data.', 'error');
            return;
        }
    })
});