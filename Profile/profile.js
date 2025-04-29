// Initialize Supabase
const supabaseUrl = 'https://lywylvbgsnmqwcwgiyhc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg';

// Fetch user data on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Supabase client using UMD global
    const { createClient } = window.supabase;

    const supabase = createClient(
        'https://lywylvbgsnmqwcwgiyhc.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg'
    );

    window.supabaseClient = supabase; // Make globally accessible

    // Fetch user data
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
        console.error('Error fetching user data:', error);
        return;
    }

    const user = data.user.user_metadata;

    document.getElementById('username').value = user.username || '';
    document.getElementById('name').value = user.name || '';
    document.getElementById('surname').value = user.surname || '';
    document.getElementById('email').value = data.user.email || '';
    document.getElementById('number').value = user.phone || '';
    document.getElementById('password').value = '';
    
    // Handle Edit/Save button
    document.getElementById('edit-profile-btn').addEventListener('click', async function () {
        const inputs = document.querySelectorAll('.profile-personal-info input');
        const button = document.getElementById('edit-profile-btn');

        if (button.textContent === 'Edit Profile') {
            inputs.forEach(input => {
                input.disabled = false;
                input.classList.add('editable');
            });
            button.textContent = 'Save';
        } else {
            const updates = {
                data: {
                    username: document.getElementById('username').value,
                    name: document.getElementById('name').value,
                    surname: document.getElementById('surname').value,
                    phone: document.getElementById('number').value
                }
            };

            const { error } = await supabase.auth.updateUser(updates);
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
});
