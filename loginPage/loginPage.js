import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://lywylvbgsnmqwcwgiyhc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg';

// Initialize Supabase Client
const supabase = createClient(supabaseUrl, supabaseAnonKey);
console.log("Supabase initialized:", supabase);

async function loginUser() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!email || !password) {
        showMessage("Please fill in both email and password.", "error");
        return;
    }

    try {
        // Sign in user
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            console.error("Login error:", error);
            showMessage("Login failed: " + error.message, "error");
            return;
        }

        console.log("User logged in successfully:", data);
        console.log("User token:", data.session.access_token);

        // Get user ID from Supabase
        const userId = data.user.id;

        // Check user role from UserTable
        const { data: userData, error: userError } = await supabase
            .from("UserTable")
            .select("Role")
            .eq("UserEmail", email)
            .single();

        if (userError) {
            console.error("User role check error:", userError);
            showMessage("Error checking user role.", "error");
            return;
        }

        if (userData.Role === 'Admin' || userData.Role === 'admin') {
            // Check if the user is an admin
            console.log("Admin detected, redirecting...");
            window.location.href = "/AdminDashboard/adminDashboard.html";
        } else if(userData.Role === 'Contractor'|| userData.Role === 'contractor') {
            // Check if the user is a contractor
            console.log("Contractor detected, redirecting...");
            window.location.href = "/ContractorDashboard/contractorDashboard.html";
        }
        else {
            console.log("Regular user detected, redirecting...");
            window.location.href = "/UserDashboard/userDashboard.html";
        }
    } catch (error) {
        showMessage("Login failed: " + error.message, "error");
    }
}

async function forgotPassword() {
    const email = document.getElementById("forgot-password-email").value.trim();

    if (!email) {
        showMessage("Please enter your email address.", "error");
        return;
    }

    try {
        await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: "https://civicsync.netlify.app/resetPassword/resetPassword.html"
        });

        showMessage("Password reset email sent successfully! Please check your inbox.", "success");
    } catch (error) {
        showMessage("Error sending reset email: " + error.message, "error");
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

// Attach event listeners after the DOM has loaded
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("login-form").addEventListener("submit", function(event) {
        event.preventDefault();
        loginUser();
    });
    document.getElementById("forgot-password-btn").addEventListener("click", forgotPassword);
});