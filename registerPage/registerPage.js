import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://lywylvbgsnmqwcwgiyhc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg';

// Initialize Supabase Client
const supabase = createClient(supabaseUrl, supabaseAnonKey);
console.log("Supabase initialized:", supabase);

async function registerUser() {
    const FirstName = document.getElementById("name").value.trim();
    const LastName = document.getElementById("surname").value.trim();
    const Username = document.getElementById("username").value.trim();
    const Email = document.getElementById("email").value.trim();
    const Phone = document.getElementById("phone").value.trim();
    const Password = document.getElementById("password").value;
    const ConfirmPassword = document.getElementById("confirm-password").value;

    if (!FirstName || !LastName || !Username || !Email || !Phone || !Password || !ConfirmPassword) {
        showMessage("Please fill in all fields.", "error");
        return;
    }

    if (Password !== ConfirmPassword) {
        showMessage("Passwords do not match.", "error");
        return;
    }

    // Password requirements validation
    if (Password.length < 8) {
        showMessage("Password must be at least 8 characters long.", "error");
        return;
    }

    if (!Password.match(/[A-Z]/) || !Password.match(/[a-z]/) || !Password.match(/[0-9]/) || !Password.match(/[^A-Za-z0-9]/)) {
        showMessage("Password must contain uppercase, lowercase, number, and special character.", "error");
        return;
    }

    try {
        // Clean phone number by removing all non-digit characters
        const cleanedPhone = Phone.replace(/\D/g, ''); // Remove non-digit characters

        // Check if username already exists
        const { data: usernameExists, error: usernameError } = await supabase
            .from("UserTable")
            .select("UserUsername")
            .eq("UserUsername", Username)
            .limit(1);

        if (usernameError) {
            showMessage("Error checking username: " + usernameError.message, "error");
            return;
        }
        if (usernameExists.length > 0) {
            showMessage("Username already exists. Please choose a different username.", "error");
            return;
        }

        // Check if email already exists
        const { data: emailExists, error: emailError } = await supabase
            .from("UserTable")
            .select("UserEmail")
            .eq("UserEmail", Email)
            .limit(1);

        if (emailError) {
            showMessage("Error checking email: " + emailError.message, "error");
            return;
        }
        if (emailExists.length > 0) {
            showMessage("Email already exists. Please use a different email or login.", "error");
            return;
        }

        // Validate phone number
        if (cleanedPhone.length !== 10 || !/^\d+$/.test(cleanedPhone)) {
            showMessage("Phone number must be exactly 10 digits and contain numbers only.", "error");
            return;
        }

        // Check if phone number already exists
        const { data: phoneExists, error: phoneError } = await supabase
            .from("UserTable")
            .select("UserPhonenumber")
            .eq("UserPhonenumber", cleanedPhone)
            .limit(1);

        if (phoneError) {
            showMessage("Error checking phone number: " + phoneError.message, "error");
            return;
        }
        if (phoneExists.length > 0) {
            showMessage("Phone number already exists. Please use a different phone number.", "error");
            return;
        }

        // Register the user with metadata
        const { data, error } = await supabase.auth.signUp({
            email: Email,
            password: Password,
            options: {
                data: { 
                    FirstName, 
                    LastName, 
                    Username,
                    phone: cleanedPhone || null // Store cleaned phone number
                },
                emailRedirectTo: "https://civicsync.netlify.app/loginPage/loginPage.html"
            }
        });

        if (error) {
            console.error("Signup error:", error);
            showMessage("Registration failed: " + error.message, "error");
            return;
        }

        const user = data.user;
        if (!user) {
            throw new Error("User registration successful, but no user ID available.");
        }

        console.log("User registered with metadata:", user);

        showMessage("Registration successful! Check your email to verify your account.", "success");

    } catch (err) {
        showMessage(`Error: ${err.message}`, "error");
        console.error("Signup error details:", err);
    }
}

function showMessage(msg, type) {
    const messageBox = document.getElementById("message-box");
    messageBox.innerHTML = msg;
    messageBox.className = type;
    messageBox.style.display = "block";

    setTimeout(() => {
        messageBox.style.display = "none";
    }, 4000);
}

// Attach event listener after DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("register-form").addEventListener("submit", function(event) {
        event.preventDefault();
        registerUser();
    });
});