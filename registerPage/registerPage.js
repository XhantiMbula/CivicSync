document.addEventListener("DOMContentLoaded", function () {
    console.log("DOM fully loaded, initializing Supabase...");

    // ✅ Ensure Supabase is available before using it
    if (typeof supabase === "undefined") {
        console.error("Supabase is not loaded.");
        return;
    }

    // ✅ Supabase Credentials
    const supabaseUrl = "https://lywylvbgsnmqwcwgiyhc.supabase.co";
    const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg";

    // ✅ Initialize Supabase
    window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);
    console.log("Supabase initialized:", window.supabaseClient);

    // ✅ Function to Send Verification Email
    async function sendVerificationEmail(email) {
        try {
            const { error } = await window.supabaseClient.auth.resend({
                type: "signup",
                email: email
            });

            if (error) throw error;

            showMessage("Verification email sent! Check your inbox.", "success");
        } catch (err) {
            showMessage(`Error sending verification email: ${err.message}`, "error");
        }
    }

    // ✅ Function to Register User
    async function registerUser() {
        const FirstName = document.getElementById("name").value.trim();
        const LastName = document.getElementById("surname").value.trim();
        const Username = document.getElementById("username").value.trim();
        const Email = document.getElementById("email").value.trim();
        const Password = document.getElementById("password").value;
        const ConfirmPassword = document.getElementById("confirm-password").value;

        if (!FirstName || !LastName || !Username || !Email || !Password || !ConfirmPassword) {
            showMessage("Please fill in all fields.", "error");
            return;
        }

        if (Password !== ConfirmPassword) {
            showMessage("Passwords do not match.", "error");
            return;
        }

        try {
            // ✅ Step 1: Register the user with metadata
            const { data, error } = await window.supabaseClient.auth.signUp({
                email: Email,
                password: Password,
                options: {
                    data: { 
                        FirstName, 
                        LastName, 
                        Username // ✅ This will be stored in `user_metadata`
                    },
                    emailRedirectTo: "/loginPage/loginPage.html"  
                }
            });

            if (error) throw error;

            const user = data.user;
            if (!user) {
                throw new Error("User registration successful, but no user ID available.");
            }

            console.log("User registered with metadata:", user);

            // ✅ Step 2: Insert User Data into Custom `UserTable`
            const { error: insertError } = await window.supabaseClient
            .from("UserTable")
            .insert([{ 
                "UserFirstname": FirstName,  
                "UserLastname": LastName,
                "UserUsername": Username,
                "UserEmail": Email,  
                "UserPassword": Password
            }]);

            if (insertError) throw insertError;

            // ✅ Step 3: Send Verification Email
            await sendVerificationEmail(Email);

            showMessage("Registration successful! Check your email to verify your account.", "success");

        } catch (err) {
            showMessage(`Error: ${err.message}`, "error");
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

    // ✅ Attach function to button
    document.querySelector("button").addEventListener("click", registerUser);
});
