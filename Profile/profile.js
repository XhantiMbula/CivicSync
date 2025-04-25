// Initialize Supabase
const supabaseUrl = 'https://lywylvbgsnmqwcwgiyhc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Fetch user data on page load
document.addEventListener('DOMContentLoaded', async () => {
    const { data: user, error } = await supabase.auth.getUser();
    if (error) {
        console.error('Error fetching user data:', error);
        return;
    }

    // Populate the text boxes with user data
    document.getElementById('username').value = user.username;
    document.getElementById('name').value = user.name;
    document.getElementById('email').value = user.email;
    document.getElementById('number').value = user.phone;
    document.getElementById('password').value = user.password;
});

// Handle edit/save button click
document.getElementById('edit-profile-btn').addEventListener('click', async function() {
    const inputs = document.querySelectorAll('.profile-personal-info input');
    const button = document.getElementById('edit-profile-btn');

    if (button.textContent === 'Edit Profile') {
        inputs.forEach(input => {
            input.disabled = false;
            input.classList.add('editable');
        });
        button.textContent = 'Save';
    } else {
        // Update user data in Supabase
        const updates = {
            username: document.getElementById('username').value,
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('number').value,
            password: document.getElementById('password').value
        };

        const { data, error } = await supabase.auth.updateUser(updates);
        if (error) {
            console.error('Error updating user data:', error);
            return;
        }

        inputs.forEach(input => {
            input.disabled = true;
            input.classList.remove('editable');
        });
        button.textContent = 'Edit Profile';
    }
});
