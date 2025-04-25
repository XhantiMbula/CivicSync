document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById("request-modal");
    const addRequestButton = document.getElementById("add-request-button");
    const closeBtn = document.querySelector(".close");
    const requestForm = document.getElementById("add-request-form");
    const requestTableBody = document.querySelector("#request-table tbody");
    const modalCancelButton = document.querySelector(".modal-cancel-button");
    const profileIcon = document.querySelector('.profile-icon');
    const dashboardContainer = document.querySelector('.dashboard-container');
    const logoutLink = document.querySelector('.logout');
    const welcomeHead = document.querySelector('.welcome-head h2');
    const notificationIcon = document.querySelector('.notification-icon');
    const notificationBadge = document.getElementById('notification-badge');

    // Feed sections
    const completedRequestsSection = document.querySelector('.completed-requests');
    const updatedRequestsSection = document.querySelector('.updated-requests');
    const pendingRequestsSection = document.querySelector('.pending-requests');

    // Initialize Supabase client
    if (!window.supabase) {
        console.error('Supabase client not initialized.');
        alert('Application error: Supabase client not found.');
        return;
    }

    // Check user authentication
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

    // Toast-like alert
    function showToast(message, type = 'error') {
        alert(message); // Replace with Toastify if desired
    }

    // Check user and load data
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

    // Logout
    logoutLink.addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error logging out:', error);
            showToast('Error logging out.', 'error');
        } else {
            window.location.href = '/loginPage/loginPage.html';
        }
    });

    // Modal controls
    addRequestButton.addEventListener("click", async () => {
        const user = await getUser();
        if (user) modal.style.display = "block";
    });

    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
    });

    modalCancelButton.addEventListener("click", () => {
        modal.style.display = "none";
    });

    window.addEventListener("click", (event) => {
        if (event.target === modal) modal.style.display = "none";
    });

    // Submit new request
    requestForm.addEventListener("submit", async (event) => {11
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
    });

    // Load user requests
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
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>Form ${index + 1}</td>
                    <td>${request.RequestTitle}</td>
                    <td>${request.RequestCategory}</td>
                    <td>${request.RequestImageURL ? `<img src="${request.RequestImageURL}" alt="Request Image" style="max-width: 100px;">` : 'No Image'}</td>
                    <td>${request.RequestDescription}</td>
                    <td>${request.RequestLocation}</td>

                    <td>${request.RequestStatus}</td>
                    <td>
                        <button onclick="editRequest('${request.RequestID}')">Edit</button>
                        <button onclick="deleteRequest('${request.RequestID}')">Delete</button>
                    </td>
                `;
                requestTableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading requests:', error);
            showToast('Error loading your requests.', 'error');
        }
    }

    // Load feed
    async function loadFeed() {
        const user = await getUser();
        if (!user) return;

        try {
            const { data: requests, error } = await supabase
                .from('RequestTable')
                .select('*')
                .eq('UserID', user.id)
                .order('created_at', { ascending: false });
            if (error) throw new Error(`Error fetching feed requests: ${error.message}`);

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
            }
            if (!pendingRequestsSection.querySelector('.feed-item')) {
                pendingRequestsSection.innerHTML += '<p>No pending requests.</p>';
            }
        } catch (error) {
            console.error('Error loading feed:', error);
            showToast('Error loading feed.', 'error');
        }
    }

    // Load notifications
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

    // Notification dropdown
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

            // Mark notifications as read
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

    // Edit request
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

        document.getElementById('title').value = request.RequestTitle;
        document.getElementById('category').value = request.RequestCategory;
        document.getElementById('description').value = request.RequestDescription;
        document.getElementById('location').value = request.RequestLocation;

        modal.style.display = 'block';

        requestForm.onsubmit = async (event) => {
            event.preventDefault();
            const updatedTitle = document.getElementById('title').value;
            const updatedCategory = document.getElementById('category').value;
            const updatedDescription = document.getElementById('description').value;
            const updatedLocation = document.getElementById('location').value;

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
                requestForm.reset();
                requestForm.onsubmit = requestFormSubmitHandler;
            }
        };
    }

    const requestFormSubmitHandler = requestForm.onsubmit;

    // Delete request
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

    // Profile dropdown
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

    // Expose functions globally
    window.editRequest = editRequest;
    window.deleteRequest = deleteRequest;

    //
document.getElementById('addComplaintBtn').onclick = function() {
      document.getElementById('complaintModal').style.display = 'block';
    }
    
    document.getElementsByClassName('closeBtn')[0].onclick = function() {
      document.getElementById('complaintModal').style.display = 'none';
    }
    
    window.onclick = function(event) {
      if (event.target == document.getElementById('complaintModal')) {
        document.getElementById('complaintModal').style.display = 'none';
      }
    }
    
});


document.getElementById('viewComplaintBtn').onclick = function() {
      document.getElementById('viewComplaintModal').style.display = 'block'
    }
    
    document.getElementsByClassName('closeBtn')[1].onclick = function() {
     style.display = 'none'
    }
    
    window.onclick = function(event) {
      if (event.target == document.getElementById('viewComplaintModal')) {
        document.getElementById('viewComplaintModal').style.display = 'none'
      }
    }
    
