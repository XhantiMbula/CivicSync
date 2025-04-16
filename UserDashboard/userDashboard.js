
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById("request-modal");
    const addRequestButton = document.getElementById("add-request-button");
    const closeBtn = document.querySelector(".close");
    const requestForm = document.getElementById("add-request-form");
    const requestTable = document.getElementById("request-table");
    const modalCancelButton = document.querySelector(".modal-cancel-button");
    const profileIcon = document.querySelector('.profile-icon');
    const dashboardContainer = document.querySelector('.dashboard-container'); // Or a more appropriate container

    addRequestButton.addEventListener("click", () => {
        modal.style.display = "block";
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

    requestForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const title = document.getElementById("title").value;
        const category = document.getElementById("category").value;
        const imageInput = document.getElementById("image");
        const description = document.getElementById("description").value;
        const location = document.getElementById("location").value;

        const status = "Pending";

        let imageURL = "";
        if (imageInput.files && imageInput.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imageURL = e.target.result;
                addNewRequestToTable(title, category, imageURL, description, location, status);
                modal.style.display = "none";
                requestForm.reset();
            };
            reader.readAsDataURL(imageInput.files[0]);
        } else {
            addNewRequestToTable(title, category, imageURL, description, location, status);
            modal.style.display = "none";
            requestForm.reset();
        }
    });

    function addNewRequestToTable(title, category, image, description, location, status) {
        const newRow = requestTable.insertRow();
        const numberCell = newRow.insertCell();
        const titleCell = newRow.insertCell();
        const imageCell = newRow.insertCell();
        const descriptionCell = newRow.insertCell();
        const locationCell = newRow.insertCell();
        const statusCell = newRow.insertCell();

        numberCell.textContent = "Form " + (requestTable.rows.length - 1);
        titleCell.textContent = title;

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
        statusCell.textContent = status;
    }

    if (profileIcon) {
        profileIcon.addEventListener('click', () => {
            const existingProfileDropdown = document.getElementById('profile-dropdown');
            if (existingProfileDropdown) {
                existingProfileDropdown.remove();
                return;
            }

            const profileDropdown = document.createElement('div');
            profileDropdown.id = 'profile-dropdown';
            profileDropdown.classList.add('profile-dropdown');

            // Sample user data (replace with actual data fetching)
            const userData = {
                profilePicture: 'default-profile.png', // Replace with actual image URL
                username: 'JohnDoe123',
                location: 'Cape Town, South Africa',
            };

            let profileHTML = `
                <div class="profile-header">
                    <div class="profile-picture-container">
                        <img src="${userData.profilePicture}" alt="Profile Picture" class="profile-picture clickable">
                        <input type="file" id="upload-picture" accept="image/*" style="display: none;">
                        <label for="upload-picture" class="upload-label"><i class="fas fa-camera"></i> Upload</label>
                    </div>
                    <h3 class="username" contenteditable="true">${userData.username}</h3>
                    <p class="location">
                        <i class="fas fa-map-marker-alt"></i>
                        <span class="location-text" contenteditable="true">${userData.location}</span>
                    </p>
                </div>
                <ul class="profile-actions">
                    <li><a href="#activity"><i class="fas fa-history"></i> View Activity</a></li>
                    <li class="logout-link"><i class="fas fa-sign-out-alt"></i> Logout</li>
                </ul>
            `;

            profileDropdown.innerHTML = profileHTML;
            dashboardContainer.appendChild(profileDropdown);

            const uploadPictureInput = profileDropdown.querySelector('#upload-picture');
            const profilePictureImg = profileDropdown.querySelector('.profile-picture');
            const usernameElement = profileDropdown.querySelector('.username');
            const locationElement = profileDropdown.querySelector('.location-text');
            const logoutLink = profileDropdown.querySelector('.logout-link');

            // Make profile picture container clickable to trigger file upload
            const profilePictureContainer = profileDropdown.querySelector('.profile-picture-container');
            profilePictureContainer.addEventListener('click', () => {
                uploadPictureInput.click();
            });

            // Handle image upload
            uploadPictureInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        profilePictureImg.src = e.target.result;
                        // In a real application, you would also send this data to the server to update the user's profile picture.
                        console.log('New profile picture uploaded:', e.target.result);
                    };
                    reader.readAsDataURL(file);
                }
            });

            // Handle username change (you'd typically save this on blur or a button click)
            usernameElement.addEventListener('blur', (event) => {
                const newUsername = event.target.innerText.trim();
                if (newUsername !== userData.username) {
                    console.log('Username changed to:', newUsername);
                    userData.username = newUsername;
                    // In a real application, you would send this to the server to update the username.
                }
            });

            // Prevent line breaks in editable username
            usernameElement.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    usernameElement.blur(); // Trigger the blur event to save (or you can add a save button)
                }
            });

            // Handle location change (you'd typically save this on blur or a button click)
            locationElement.addEventListener('blur', (event) => {
                const newLocation = event.target.innerText.trim();
                if (newLocation !== userData.location) {
                    console.log('Location changed to:', newLocation);
                    userData.location = newLocation;
                    // In a real application, you would send this to the server to update the location.
                }
            });

            // Prevent line breaks in editable location
            locationElement.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    locationElement.blur(); // Trigger the blur event to save (or you can add a save button)
                }
            });

            if (logoutLink) {
                logoutLink.addEventListener('click', () => {
                    console.log('Logout clicked');
                    // window.location.href = '/logout';
                });
            }

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
    