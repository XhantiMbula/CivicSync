import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://lywylvbgsnmqwcwgiyhc.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg";

// ✅ Initialize Supabase Client
const supabase = createClient(supabaseUrl, supabaseAnonKey);
console.log("Supabase initialized:", supabase);

async function resetPassword() {
    const password = document.getElementById("new-password").value.trim();
    const confirmPassword = document.getElementById("confirm-password").value.trim();

    if (!password || !confirmPassword) {
        showMessage("Please enter both the new password and confirm password.", "error");
        return;
    }

    if (password !== confirmPassword) {
        showMessage("Passwords do not match.", "error");
        return;
    }

    // ✅ Check if a user is signed in
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        showMessage("Session expired. Please request a new password reset link.", "error");
        return;
    }

    console.log("Authenticated user:", user);

    try {
        // ✅ Update password
        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            showMessage("Error resetting password: " + error.message, "error");
        } else {
            showMessage("Password reset successful! Redirecting to login...", "success");
            setTimeout(() => {
                window.location.href = "/loginpage/loginpage";
            }, 2000);
        }
    } catch (err) {
        showMessage("Unexpected error: " + err.message, "error");
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

// ✅ Attach event listener after DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("reset-password-btn").addEventListener("click", resetPassword);
});
