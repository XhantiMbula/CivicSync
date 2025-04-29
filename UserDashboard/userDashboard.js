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
    const modalHeader = modal.querySelector('.modal-header h2');

    if (!window.supabase) {
        console.error('Supabase client not initialized.');
        alert('Application error: Supabase client not found.');
        return;
    }

    // Google Maps Autocomplete
    let autocomplete;
    const locationInput = document.getElementById('location');
    const locationOptions = document.querySelectorAll('input[name="location-type"]');
    const imageInput = document.getElementById('image');
    let currentRequestId = null; // Track the request being edited

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
                    fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyAFM6HNEnxbn6_VvYaQ_o4n72VlAUajgmc`)
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
        alert(message); // Replace with a proper toast library if needed
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
        loadCommunityFeed();
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
            currentRequestId = null;
            imageInput.required = true;
            document.getElementById('image-preview')?.remove();
            requestForm.reset();
            modalHeader.textContent = 'Add New Request';
            modal.style.display = "block";
            locationOptions[0].checked = true;
            locationInput.disabled = false;
            locationInput.value = '';
        }
    });

    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
        currentRequestId = null;
        imageInput.required = true;
        document.getElementById('image-preview')?.remove();
        modalHeader.textContent = 'Add New Request';
    });

    modalCancelButton.addEventListener("click", () => {
        modal.style.display = "none";
        currentRequestId = null;
        imageInput.required = true;
        document.getElementById('image-preview')?.remove();
        modalHeader.textContent = 'Add New Request';
    });

    window.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
            currentRequestId = null;
            imageInput.required = true;
            document.getElementById('image-preview')?.remove();
            modalHeader.textContent = 'Add New Request';
        }
        if (event.target === complaintModal) complaintModal.style.display = "none";
        if (event.target === viewComplaintModal) viewComplaintModal.style.display = "none";
    });

    requestForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const user = await getUser();
        if (!user) return;

        const title = document.getElementById("title").value;
        const category = document.getElementById("category").value;
        const description = document.getElementById("description").value;
        const location = document.getElementById("location").value;
        const status = currentRequestId ? "Updated" : "Pending";
        const userId = user.id;

        let imageURL = currentRequestId ? (document.getElementById('image-preview')?.src || "") : "";
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
            if (currentRequestId) {
                const requestData = {
                    RequestTitle: title,
                    RequestCategory: category,
                    RequestImageURL: imageURL,
                    RequestDescription: description,
                    RequestLocation: location,
                    RequestStatus: status,
                    updated_at: new Date().toISOString()
                };
                const { error: updateError } = await supabase
                    .from('RequestTable')
                    .update(requestData)
                    .eq('RequestID', currentRequestId);
                if (updateError) throw new Error(`Request update failed: ${updateError.message}`);

                showToast('Request updated successfully!', 'success');
            } else {
                if (!imageURL) {
                    showToast('Image is required for new requests.', 'error');
                    return;
                }
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
            }

            loadUserRequests();
            loadCommunityFeed();
            modal.style.display = "none";
            requestForm.reset();
            currentRequestId = null;
            imageInput.required = true;
            document.getElementById('image-preview')?.remove();
            modalHeader.textContent = 'Add New Request';
        } catch (error) {
            console.error('Error during request submission:', error);
            showToast('An error occurred while submitting the request.', 'error');
        }
    });

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
                const truncatedDesc = request.RequestDescription.length > 100
                    ? request.RequestDescription.substring(0, 100) + '...'
                    : request.RequestDescription;
                const card = document.createElement('div');
                card.classList.add('request-card');
                card.innerHTML = `
                    <div class="card-header">
                        <h3>${request.RequestTitle}</h3>
                        <i class="fas fa-chevron-down expand-icon"></i>
                    </div>
                    <div class="card-content">
                        <div class="card-field">
                            <span class="field-label">Category:</span>
                            <span>${request.RequestCategory}</span>
                        </div>
                        <div class="card-field">
                            <span class="field-label">Image:</span>
                            ${request.RequestImageURL ? `<img src="${request.RequestImageURL}" alt="Request Image" class="card-image">` : 'No Image'}
                        </div>
                        <div class="card-field description-field">
                            <span class="field-label">Description:</span>
                            <span class="description-text">${truncatedDesc}</span>
                            ${request.RequestDescription.length > 100 ? `<span class="full-description hidden">${request.RequestDescription}</span>` : ''}
                        </div>
                        <div class="card-field">
                            <span class="field-label">Location:</span>
                            <span>${request.RequestLocation}</span>
                        </div>
                        <div class="card-field">
                            <span class="field-label">Status:</span>
                            <span class="status-badge status-${request.RequestStatus.toLowerCase()}">${request.RequestStatus}</span>
                        </div>
                        <div class="card-actions">
                            <button onclick="editRequest('${request.RequestID}')">Edit</button>
                            <button onclick="deleteRequest('${request.RequestID}')">Delete</button>
                        </div>
                    </div>
                `;
                requestTableBody.appendChild(card);

                // Animation on load
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    card.style.transition = 'all 0.5s ease';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, index * 100);

                // Expand/collapse
                const header = card.querySelector('.card-header');
                header.addEventListener('click', () => {
                    const content = card.querySelector('.card-content');
                    const icon = card.querySelector('.expand-icon');
                    const descriptionText = card.querySelector('.description-text');
                    const fullDescription = card.querySelector('.full-description');
                    if (content.classList.contains('expanded')) {
                        content.classList.remove('expanded');
                        icon.classList.remove('fa-chevron-up');
                        icon.classList.add('fa-chevron-down');
                        if (fullDescription) {
                            descriptionText.textContent = truncatedDesc;
                            fullDescription.classList.add('hidden');
                        }
                    } else {
                        content.classList.add('expanded');
                        icon.classList.remove('fa-chevron-down');
                        icon.classList.add('fa-chevron-up');
                        if (fullDescription) {
                            descriptionText.textContent = request.RequestDescription;
                            fullDescription.classList.remove('hidden');
                        }
                    }
                });
            });

            // Sorting
            const sortableHeaders = document.querySelectorAll('.table-header .sortable');
            sortableHeaders.forEach(header => {
                header.addEventListener('click', () => {
                    const sortKey = header.dataset.sort;
                    const isAscending = !header.classList.contains('sort-asc');
                    sortableHeaders.forEach(h => {
                        h.classList.remove('sort-asc', 'sort-desc');
                        h.querySelector('i').classList.remove('fa-sort-up', 'fa-sort-down');
                        h.querySelector('i').classList.add('fa-sort');
                    });
                    header.classList.add(isAscending ? 'sort-asc' : 'sort-desc');
                    header.querySelector('i').classList.add(isAscending ? 'fa-sort-up' : 'fa-sort-down');
                    header.querySelector('i').classList.remove('fa-sort');

                    requests.sort((a, b) => {
                        const valA = a[sortKey] || '';
                        const valB = b[sortKey] || '';
                        return isAscending
                            ? valA.localeCompare(valB)
                            : valB.localeCompare(valA);
                    });

                    loadUserRequests(); // Reload sorted
                });
            });
        } catch (error) {
            console.error('Error loading requests:', error);
            showToast('Error loading your requests.', 'error');
        }
    }

    async function loadCommunityFeed() {
        try {
            const { data: requests, error } = await supabase
                .from('RequestTable')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) {
                console.error('Error fetching community feed:', error.message);
                showToast('Error loading community feed.', 'error');
                return;
            }

            const feedContainer = document.getElementById('community-feed');
            feedContainer.innerHTML = '';

            requests.forEach((request, index) => {
                const card = document.createElement('div');
                card.classList.add('masonry-card', `category-${request.RequestCategory.toLowerCase().replace(/\s+/g, '-')}`);
                card.dataset.tilt = '';
                card.innerHTML = `
                    <div class="card-image-wrapper">
                        <img src="${request.RequestImageURL || 'https://dummyimage.com/300x200/cccccc/ffffff&text=Image+Not+Found'}" 
                             alt="Request Image" 
                             onerror="this.src='https://dummyimage.com/300x200/cccccc/ffffff&text=Image+Not+Found';">
                        <div class="category-icon">
                            <i class="fas ${getCategoryIcon(request.RequestCategory)}"></i>
                        </div>
                    </div>
                    <div class="card-content">
                        <h3>${request.RequestTitle}</h3>
                        <p class="card-description">${request.RequestDescription.length > 150 ? request.RequestDescription.substring(0, 150) + '...' : request.RequestDescription}</p>
                        <p class="card-location"><i class="fas fa-map-marker-alt"></i> ${request.RequestLocation}</p>
                        <span class="status-badge status-${request.RequestStatus.toLowerCase()}">${request.RequestStatus}</span>
                        <button class="view-details hidden">View Details</button>
                    </div>
                `;
                feedContainer.appendChild(card);

                // Animation on scroll
                card.style.opacity = '0';
                card.style.transform = 'translateY(50px)';
                const observer = new IntersectionObserver((entries) => {
                    if (entries[0].isIntersecting) {
                        card.style.transition = 'all 0.5s ease';
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                        observer.unobserve(card);
                    }
                }, { threshold: 0.1 });
                observer.observe(card);

                // View Details toggle
                const viewDetailsBtn = card.querySelector('.view-details');
                card.addEventListener('mouseenter', () => viewDetailsBtn.classList.remove('hidden'));
                card.addEventListener('mouseleave', () => viewDetailsBtn.classList.add('hidden'));
                viewDetailsBtn.addEventListener('click', () => {
                    const description = card.querySelector('.card-description');
                    if (description.classList.contains('expanded')) {
                        description.classList.remove('expanded');
                        description.textContent = request.RequestDescription.length > 150
                            ? request.RequestDescription.substring(0, 150) + '...'
                            : request.RequestDescription;
                        viewDetailsBtn.textContent = 'View Details';
                    } else {
                        description.classList.add('expanded');
                        description.textContent = request.RequestDescription;
                        viewDetailsBtn.textContent = 'Hide Details';
                    }
                });
            });

            // Initialize VanillaTilt
            if (window.VanillaTilt) {
                VanillaTilt.init(document.querySelectorAll('.masonry-card'), {
                    max: 15,
                    speed: 400,
                    glare: true,
                    'max-glare': 0.3
                });
            }
        } catch (error) {
            console.error('Error loading community feed:', error);
            showToast('Error loading community feed.', 'error');
        }
    }

    function getCategoryIcon(category) {
        const icons = {
            'Crime': 'fa-shield-alt',
            'Infrastructure': 'fa-road',
            'Electricity': 'fa-bolt',
            'Plumbing': 'fa-faucet',
            'Public Spaces': 'fa-tree',
            'Government Housing': 'fa-home'
        };
        return icons[category] || 'fa-question';
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

        currentRequestId = requestId;
        imageInput.required = false;
        document.getElementById('title').value = request.RequestTitle;
        document.getElementById('category').value = request.RequestCategory;
        document.getElementById('description').value = request.RequestDescription;
        document.getElementById('location').value = request.RequestLocation;
        document.querySelector('input[name="location-type"][value="manual"]').checked = true;
        locationInput.disabled = false;

        document.getElementById('image-preview')?.remove();
        if (request.RequestImageURL) {
            const imgPreview = document.createElement('img');
            imgPreview.id = 'image-preview';
            imgPreview.src = request.RequestImageURL;
            imgPreview.style.maxWidth = '100%';
            imgPreview.style.maxHeight = '150px';
            imgPreview.style.marginBottom = '10px';
            imageInput.parentNode.insertBefore(imgPreview, imageInput);
        }

        modalHeader.textContent = 'Edit Request';
        modal.style.display = 'block';
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
                loadCommunityFeed();
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

        const existingProfileDropdown = document.getElementById('profile-dropdown');
        if (existingProfileDropdown) {
            existingProfileDropdown.remove();
            return;
        }

        const profileDropdown = document.createElement('div');
        profileDropdown.id = 'profile-dropdown';
        profileDropdown.classList.add('profile-dropdown');

        const userDataFormatted = {
            profilePicture: 'default-profile.png',
            username: userData.UserUsername || user.email || 'User',
            location: userData.UserLocation || 'Unknown Location'
        };

        profileDropdown.innerHTML = `
            <div class="profile-header">
                <img src="${userDataFormatted.profilePicture}" alt="Profile Picture" class="profile-picture">
                <h3>${userDataFormatted.username}</h3>
                <p class="location"><i class="fas fa-map-marker-alt"></i> ${userDataFormatted.location}</p>
            </div>
            <ul class="profile-actions">
                <li><a href="#activity"><i class="fas fa-history"></i> View Activity</a></li>
                <li class="logout-link"><i class="fas fa-sign-out-alt"></i> Logout</li>
            </ul>
        `;

        dashboardContainer.appendChild(profileDropdown);

        const logoutLink = profileDropdown.querySelector('.logout-link');
        logoutLink.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/loginPage/loginPage.html';
        });

        function closeDropdown(event) {
            if (!profileIcon.contains(event.target) && !profileDropdown.contains(event.target)) {
                profileDropdown.remove();
                document.removeEventListener('click', closeDropdown);
            }
        }
        setTimeout(() => document.addEventListener('click', closeDropdown), 10);
    });

    // Complaint Modal Handlers
    addComplaintBtn.addEventListener('click', () => {
        complaintModal.style.display = 'block';
    });

    closeComplaintBtn.addEventListener('click', () => {
        complaintModal.style.display = 'none';
    });

    viewComplaintBtn.addEventListener('click', async () => {
        viewComplaintModal.style.display = 'block';
        const container = viewComplaintModal.querySelector('.complaint-cards-container');
        container.innerHTML = '<p>Loading complaints...</p>';
        // Placeholder for complaint loading
    });

    closeViewComplaintBtn.addEventListener('click', () => {
        viewComplaintModal.style.display = 'none';
    });

    complaintForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const user = await getUser();
        if (!user) return;

        const subject = document.getElementById('complaintSubject').value;
        const description = document.getElementById('complaintDescription').value;
        const response = document.getElementById('complaintResponse').value;

        try {
            const complaintData = {
                ComplaintID: crypto.randomUUID(),
                ComplaintSubject: subject,
                ComplaintDescription: description,
                ComplaintResponse: response,
                UserID: user.id,
                created_at: new Date().toISOString()
            };
            const { error } = await supabase
                .from('ComplaintTable')
                .insert([complaintData]);
            if (error) throw new Error(`Complaint insertion failed: ${error.message}`);

            showToast('Complaint submitted successfully!', 'success');
            complaintModal.style.display = 'none';
            complaintForm.reset();
        } catch (error) {
            console.error('Error submitting complaint:', error);
            showToast('Error submitting complaint.', 'error');
        }
    });

    window.editRequest = editRequest;
    window.deleteRequest = deleteRequest;
});