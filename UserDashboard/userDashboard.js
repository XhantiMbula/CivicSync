document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById("request-modal");
    const addRequestButton = document.getElementById("add-request-button");
    const closeBtn = document.querySelector(".close");
    const requestForm = document.getElementById("add-request-form");
    const requestTable = document.getElementById("request-table");
    const modalCancelButton = document.querySelector(".modal-cancel-button");
    const profileIcon = document.querySelector('.profile-icon');
    const dashboardContainer = document.querySelector('.dashboard-container');

    // Initialize Supabase client (already in HTML, but ensure session persistence)
    if (!window.supabase) {
        console.error('Supabase client not initialized.');
        alert('Application error: Supabase client not found.');
        return;
    }

    // Check user authentication and debug UserID
    async function getUser() {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) {
                console.error('Authentication error:', error?.message || 'No user found');
                console.log('User data:', user); // Debug user object
                alert('You must be logged in to submit a request.');
                window.location.href = '/login.html';
                return null;
            }
            console.log('Authenticated UserID:', user.id); // Debug UserID
            return user;
        } catch (err) {
            console.error('Error checking authentication:', err);
            alert('An error occurred while verifying your session.');
            return null;
        }
    }

    // Toast-like alert for better UX
    function showToast(message, type = 'error') {
        alert(message); // Replace with Toastify if desired
    }

    // Check user on page load
    async function checkUserOnLoad() {
        const user = await getUser();
        if (!user) {
            window.location.href = '/login.html';
        }
    }
    checkUserOnLoad();

    addRequestButton.addEventListener("click", async () => {
        const user = await getUser();
        if (user) {
            modal.style.display = "block";
        }
    });

    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
    });

    modalCancelButton.addEventListener("click", () => {
        modal.style.display = "none";
    });

    window.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    });

    requestForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Get authenticated user
        const user = await getUser();
        if (!user) return;

        const title = document.getElementById("title").value;
        const category = document.getElementById("category").value;
        const imageInput = document.getElementById("image");
        const description = document.getElementById("description").value;
        const location = document.getElementById("location").value;
        const status = "Pending";
        const userId = user.id;

        console.log('Submitting request with UserID:', userId); // Debug UserID before insert

        let imageURL = "";

        // Step 1: Upload image to Supabase Storage
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
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('request-images')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) {
                    console.error('Image upload failed:', uploadError.message);
                    showToast(`Failed to upload image: ${uploadError.message}`, 'error');
                    return;
                }

                const { data: urlData } = supabase.storage
                    .from('request-images')
                    .getPublicUrl(fileName);

                imageURL = urlData.publicUrl;
                if (!imageURL) {
                    console.error('Failed to retrieve public URL.');
                    showToast('Image uploaded, but could not retrieve URL.', 'error');
                    return;
                }
                console.log('Image URL:', imageURL); // Debug image URL
            } catch (error) {
                console.error('Error during image upload:', error);
                showToast('An error occurred while uploading the image.', 'error');
                return;
            }
        } else {
            console.warn('No image provided.');
        }

        // Step 2: Insert request into RequestTable
        try {
            const requestData = {
                RequestTitle: title,
                RequestCategory: category,
                RequestImageURL: imageURL,
                RequestDescription: description,
                RequestLocation: location,
                RequestStatus: status,
                UserID: userId,
                created_at: new Date().toISOString()
            };
            console.log('Request data to insert:', requestData); // Debug request data

            const { data, error: requestError } = await supabase
                .from('RequestTable')
                .insert([requestData])
                .select();

            if (requestError) {
                console.error('Request insertion failed:', requestError.message);
                showToast(`Failed to submit request: ${requestError.message}`, 'error');
                return;
            }

            console.log('Request submitted successfully:', data);
            showToast('Request submitted successfully!', 'success');

            // Step 3: Add to local table
            addNewRequestToTable(title, category, imageURL, description, location, category, status);
            modal.style.display = "none";
            requestForm.reset();
        } catch (error) {
            console.error('Error during request submission:', error);
            showToast('An error occurred while submitting the request.', 'error');
        }
    });

    function addNewRequestToTable(title, category, image, description, location, category2, status) {
        const newRow = requestTable.insertRow();
        const numberCell = newRow.insertCell();
        const titleCell = newRow.insertCell();
        const categoryCell = newRow.insertCell();
        const imageCell = newRow.insertCell();
        const descriptionCell = newRow.insertCell();
        const locationCell = newRow.insertCell();
        const categoryCell2 = newRow.insertCell();
        const statusCell = newRow.insertCell();

        numberCell.textContent = "Form " + (requestTable.rows.length - 1);
        titleCell.textContent = title;
        categoryCell.textContent = category;

        if (image) {
            const imgElement = document.createElement("img");
            imgElement.src = image;
            imgElement.alt = "Request Image";
            imgElement.style.maxWidth = "100px";
            imageCell.appendChild(imgElement);
        } else {
            imageCell.textContent = "No Image";
        }

        descriptionCell.textContent = description;
        locationCell.textContent = location;
        categoryCell2.textContent = category2;
        statusCell.textContent = status;
    }

    // Load existing requests
    async function loadUserRequests() {
        const user = await getUser();
        if (!user) return;

        try {
            const { data: requests, error } = await supabase
                .from('RequestTable')
                .select('*')
                .eq('UserID', user.id);

            if (error) {
                console.error('Error fetching requests:', error.message);
                showToast(`Error fetching requests: ${error.message}`, 'error');
                return;
            }

            requests.forEach(request => {
                addNewRequestToTable(
                    request.RequestTitle,
                    request.RequestCategory,
                    request.RequestImageURL,
                    request.RequestDescription,
                    request.RequestLocation,
                    request.RequestCategory,
                    request.RequestStatus
                );
            });
        } catch (error) {
            console.error('Error loading requests:', error);
            showToast('Error loading your requests.', 'error');
        }
    }
    loadUserRequests();

    // Profile dropdown (simplified, unchanged except for user data)
    if (profileIcon) {
        profileIcon.addEventListener('click', async () => {
            const user = await getUser();
            if (!user) return;

            const existingProfileDropdown = document.getElementById('profile-dropdown');
            if (existingProfileDropdown) {
                existingProfileDropdown.remove();
                return;
            }

            const profileDropdown = document.createElement('div');
            profileDropdown.id = 'profile-dropdown';
            profileDropdown.classList.add('profile-dropdown');

            const userData = {
                profilePicture: 'default-profile.png',
                username: user.email || 'User',
                location: 'Unknown Location'
            };

            let profileHTML = `
                <div class="profile-header">
                    <img src="${userData.profilePicture}" alt="Profile Picture" class="profile-picture">
                    <h3>${userData.username}</h3>
                    <p class="location"><i class="fas fa-map-marker-alt"></i> ${userData.location}</p>
                </div>
                <ul class="profile-actions">
                    <li><a href="#activity"><i class="fas fa-history"></i> View Activity</a></li>
                    <li class="logout-link"><i class="fas fa-sign-out-alt"></i> Logout</li>
                </ul>
            `;

            profileDropdown.innerHTML = profileHTML;
            dashboardContainer.appendChild(profileDropdown);

            const logoutLink = profileDropdown.querySelector('.logout-link');
            logoutLink.addEventListener('click', async () => {
                await supabase.auth.signOut();
                window.location.href = '/login.html';
            });

            function closeDropdown(event) {
                if (!profileIcon.contains(event.target) && !profileDropdown.contains(event.target)) {
                    profileDropdown.remove();
                    document.removeEventListener('click', closeDropdown);
                }
            }

            setTimeout(() => {
                document.addEventListener('click', closeDropdown);
            }, 10);
        });
    }
});