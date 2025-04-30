const supabaseUrl = "https://bvmohzddhmqvbwtxzgbb.supabase.co";
const supabaseKey = "YOUR_SUPABASE_KEY"; // Replace with your actual key
const client = supabase.createClient(supabaseUrl, supabaseKey);

// DOM Elements
const usernameInput = document.getElementById("username");
const nameInput = document.getElementById("name");
const surnameInput = document.getElementById("surname");
const emailInput = document.getElementById("email");
const numberInput = document.getElementById("number");
const editButton = document.getElementById("edit-profile-btn");
const logoutButton = document.getElementById("logout-btn");
const notificationsContainer = document.getElementById("notifications-container");

let isEditing = false;

// Load user data on page load
window.addEventListener("DOMContentLoaded", async () => {
    const {
        data: { user },
        error: userError
    } = await client.auth.getUser();

    if (userError || !user) {
        console.error("User not logged in:", userError);
        window.location.href = "../loginPage/loginPage.html";
        return;
    }

    const { data, error } = await client
        .from("Users")
        .select("*")
        .eq("UserEmail", user.email)
        .single();

    if (error) {
        console.error("Error fetching user data:", error.message);
    } else {
        usernameInput.value = data.UserUsername || "";
        nameInput.value = data.UserFirstname || "";
        surnameInput.value = data.UserLastname || "";
        emailInput.value = data.UserEmail || "";
        numberInput.value = data.UserNumber || "";
    }

    loadRecentNotifications(user.email);
});

// Toggle Edit Mode
editButton.addEventListener("click", async () => {
    if (!isEditing) {
        isEditing = true;
        [usernameInput, nameInput, surnameInput, numberInput].forEach(input => {
            input.disabled = false;
            input.classList.add("editable");
        });
        editButton.textContent = "Save Profile";
    } else {
        const updatedData = {
            UserUsername: usernameInput.value,
            UserFirstname: nameInput.value,
            UserLastname: surnameInput.value,
            UserNumber: numberInput.value
        };

        const { data: { user } } = await client.auth.getUser();

        const { error } = await client
            .from("Users")
            .update(updatedData)
            .eq("UserEmail", user.email);

        if (error) {
            console.error("Failed to update profile:", error.message);
        } else {
            console.log("Profile updated");
        }

        [usernameInput, nameInput, surnameInput, numberInput].forEach(input => {
            input.disabled = true;
            input.classList.remove("editable");
        });
        editButton.textContent = "Edit Profile";
        isEditing = false;
    }
});

// Logout Functionality
logoutButton.addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) {
        console.error("Logout failed:", error.message);
    } else {
        window.location.href = "../loginPage/loginPage.html";
    }
});

// Load Notifications
async function loadRecentNotifications(email) {
    try {
        const { data, error } = await client
            .from("Notifications")
            .select("*")
            .eq("UserEmail", email)
            .order("created_at", { ascending: false })
            .limit(5);

        if (error) throw error;

        if (!data || data.length === 0) {
            notificationsContainer.innerHTML = `<p class="no-notifications">No recent notifications.</p>`;
            return;
        }

        const ul = document.createElement("ul");
        ul.classList.add("notification-list");

        data.forEach(notification => {
            const li = document.createElement("li");
            li.textContent = notification.Message;

            if (notification.Type === "Approval") {
                li.classList.add("notification-approval");
            } else if (notification.Type === "Rejection") {
                li.classList.add("notification-rejection");
            }

            ul.appendChild(li);
        });

        notificationsContainer.innerHTML = "";
        notificationsContainer.appendChild(ul);
    } catch (err) {
        console.error("Error loading recent notifications:", err.message);
        notificationsContainer.innerHTML = `<p class="no-notifications">Failed to load notifications.</p>`;
    }
}
