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
    // Handle Logout button
    document.getElementById('logout-btn').addEventListener('click', async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error during logout:', error);
            return;
        }
        // Redirect to login or home page after successful logout
        window.location.href = '../loginPage/loginPage.html'; // Change this path as needed
    });
    async function loadRecentNotifications() {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) return;
    
        const userId = userData.user.id;
    
        try {
            const { data: messages, error } = await supabase
                .from('RequestMessages')
                .select('*, RequestTable(RequestTitle)')
                .eq('UserID', userId)
                .order('created_at', { ascending: false })
                .limit(5); // Show only the 5 most recent notifications
    
            if (error) throw new Error(error.message);
    
            const container = document.getElementById('notifications-container');
            container.innerHTML = ''; // Clear any previous notifications

            if (!section) return;

            if (!messages || messages.length === 0) {
                const noMsg = document.createElement('p');
                noMsg.className = 'no-notifications';
                noMsg.textContent = 'You have no recent notifications.';
                section.appendChild(noMsg);
            } else {
                const container = document.createElement('div');
                container.classList.add('recent-notifications');

                let html = '<ul class="notification-list">';
                messages.forEach(message => {
                    const statusClass = message.MessageType === 'Approval' ? 'notification-approval' : 'notification-rejection';
                    html += `
                        <li class="${statusClass}">
                            <strong>${message.RequestTable?.RequestTitle || 'Untitled Request'}</strong><br>
                            ${message.MessageContent}<br>
                            <small>${new Date(message.created_at).toLocaleString()}</small>
                        </li>
                    `;
                });
                html += '</ul>';
                container.innerHTML = html;
            }
            } catch (error) {
            console.error('Error loading recent notifications:', error);
        }
    }
    
    // Call it at the end of DOMContentLoaded
    loadRecentNotifications();    
});
