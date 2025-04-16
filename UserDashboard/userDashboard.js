document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById("request-modal");
    const addRequestButton = document.getElementById("add-request-button");
    const closeBtn = document.querySelector(".close");
    const requestForm = document.getElementById("add-request-form");
    const requestTable = document.getElementById("request-table");
    const modalCancelButton = document.querySelector(".modal-cancel-button");
    const locationInput = document.getElementById("location");
    const locationSuggestions = document.createElement('div');
    locationSuggestions.id = 'location-suggestions';
    locationSuggestions.style.position = 'absolute';
    locationSuggestions.style.zIndex = '1000';
    locationSuggestions.style.backgroundColor = 'white';
    locationSuggestions.style.border = '1px solid #ccc';
    locationSuggestions.style.width = locationInput.offsetWidth + 'px'; // Match input width
    locationSuggestions.style.display = 'none';
    locationInput.parentNode.appendChild(locationSuggestions);

    const apiKey = 'YOUR_GEOCODING_API_KEY'; // Replace with your actual API key
    const autocompleteService = 'google'; // Choose your service: 'google', 'opencage', 'mapbox'

    function autocompleteLocation(query) {
        if (!query.trim()) {
            locationSuggestions.style.display = 'none';
            locationSuggestions.innerHTML = '';
            return;
        }

        let autocompleteUrl = '';

        switch (autocompleteService) {
            case 'google':
                autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&sessiontoken=YOUR_SESSION_TOKEN&types=geocode`;
                // **Note:** For production, you should implement session tokens properly
                break;
            case 'opencage':
                autocompleteUrl = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&language=en&limit=5`;
                break;
            case 'mapbox':
                autocompleteUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${apiKey}&types=address,poi&proximity=${longitude},${latitude}`;
                // **Note:** You might want to use the user's current coordinates for proximity if available
                break;
            default:
                console.warn("No valid autocomplete service selected.");
                locationSuggestions.style.display = 'none';
                locationSuggestions.innerHTML = '';
                return;
        }

        fetch(autocompleteUrl)
            .then(response => response.json())
            .then(data => {
                locationSuggestions.innerHTML = '';
                locationSuggestions.style.display = 'block';
                let suggestions = [];

                switch (autocompleteService) {
                    case 'google':
                        if (data.predictions) {
                            suggestions = data.predictions.map(p => ({ description: p.description, place_id: p.place_id }));
                        }
                        break;
                    case 'opencage':
                        if (data.results) {
                            suggestions = data.results.map(r => ({ description: r.formatted, latitude: r.geometry.lat, longitude: r.geometry.lng }));
                        }
                        break;
                    case 'mapbox':
                        if (data.features) {
                            suggestions = data.features.map(f => ({ description: f.place_name, latitude: f.center[1], longitude: f.center[0] }));
                        }
                        break;
                }

                if (suggestions.length > 0) {
                    suggestions.forEach(suggestion => {
                        const suggestionItem = document.createElement('div');
                        suggestionItem.textContent = suggestion.description;
                        suggestionItem.style.padding = '8px';
                        suggestionItem.style.cursor = 'pointer';
                        suggestionItem.addEventListener('click', () => {
                            locationInput.value = suggestion.description;
                            locationSuggestions.style.display = 'none';
                            locationSuggestions.innerHTML = '';
                            // If using Google Places API, you might want to fetch details using place_id here
                            if (autocompleteService === 'opencage' && suggestion.latitude && suggestion.longitude) {
                                // You can store these coordinates if needed
                                console.log('Selected coordinates:', suggestion.latitude, suggestion.longitude);
                            } else if (autocompleteService === 'mapbox' && suggestion.latitude && suggestion.longitude) {
                                console.log('Selected coordinates:', suggestion.latitude, suggestion.longitude);
                            }
                        });
                        locationSuggestions.appendChild(suggestionItem);
                    });
                } else {
                    const noResults = document.createElement('div');
                    noResults.textContent = 'No suggestions found.';
                    noResults.style.padding = '8px';
                    locationSuggestions.appendChild(noResults);
                }
            })
            .catch(error => {
                console.error("Error fetching autocomplete suggestions:", error);
                locationSuggestions.style.display = 'none';
                locationSuggestions.innerHTML = '<div style="padding: 8px;">Error loading suggestions.</div>';
            });
    }

    locationInput.addEventListener('input', (event) => {
        autocompleteLocation(event.target.value);
    });

    // Close suggestions when clicking outside the input and suggestions box
    document.addEventListener('click', (event) => {
        if (!locationInput.contains(event.target) && !locationSuggestions.contains(event.target)) {
            locationSuggestions.style.display = 'none';
            locationSuggestions.innerHTML = '';
        }
    });

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
        const location = locationInput.value;
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
});