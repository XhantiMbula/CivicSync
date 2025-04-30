// Initialize Supabase client
const supabase = window.supabase.createClient(
    "https://lywylvbgsnmqwcwgiyhc.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg"
);

// DOM Elements
const usernameInput = document.getElementById('username');
const nameInput = document.getElementById('name');
const surnameInput = document.getElementById('surname');
const emailInput = document.getElementById('email');
const numberInput = document.getElementById('number');
const editBtn = document.getElementById('edit-profile-btn');
const logoutBtn = document.getElementById('logout-btn');
const notificationsContainer = document.getElementById('notifications-container');

let isEditing = false;
let currentUserId = null;

// Check if user is logged in, if not redirect to login page
async function checkSession() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        console.error('No active session found:', error);
        window.location.href = '../loginPage/loginPage.html';
        return;
    }

    currentUserId = session.user.id;
    loadProfile();
}

// Load profile data
async function loadProfile() {
    const { data, error } = await supabase
        .from('UserTable')
        .select('UserUsername, UserFirstname, UserLastname, UserEmail, UserPhonenumber')
        .eq('UserID', currentUserId)
        .single();

    if (error || !data) {
        console.error('Error loading profile data:', error);
        return;
    }

    usernameInput.value = data.UserUsername || '';
    nameInput.value = data.UserFirstname || '';
    surnameInput.value = data.UserLastname || '';
    emailInput.value = data.UserEmail || '';
    numberInput.value = data.UserPhonenumber || '';
}

// Toggle edit/save
editBtn.addEventListener('click', async () => {
    if (!isEditing) {
        [usernameInput, nameInput, surnameInput, emailInput, numberInput].forEach(input => {
            input.disabled = false;
            input.classList.add('editable');
        });
        editBtn.textContent = 'Save';
    } else {
        const updates = {
            UserUsername: usernameInput.value.trim(),
            UserFirstname: nameInput.value.trim(),
            UserLastname: surnameInput.value.trim(),
            UserEmail: emailInput.value.trim(),
            UserPhonenumber: numberInput.value.trim()
        };

        const { error } = await supabase
            .from('UserTable')
            .update(updates)
            .eq('UserID', currentUserId);

        if (error) {
            console.error('Error updating profile:', error);
            return;
        }

        [usernameInput, nameInput, surnameInput, emailInput, numberInput].forEach(input => {
            input.disabled = true;
            input.classList.remove('editable');
        });
        editBtn.textContent = 'Edit Profile';
    }

    isEditing = !isEditing;
});

// Logout
logoutBtn.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Logout error:', error.message);
        return;
    }
    window.location.href = '../loginPage/loginPage.html';
});

// Load recent notifications
async function loadRecentNotifications() {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        console.error('Error fetching user for notifications:', error);
        return;
    }

    try {
        const { data: messages, error: notifError } = await supabase
            .from('RequestMessages')
            .select('*, RequestTable(RequestTitle)')
            .eq('UserID', user.id)
            .order('created_at', { ascending: false })
            .limit(5);

        if (notifError) throw notifError;

        if (!messages || messages.length === 0) {
            notificationsContainer.innerHTML = '<p class="no-notifications">No recent notifications.</p>';
            return;
        }

        const list = document.createElement('ul');
        list.classList.add('notification-list');

        messages.forEach(message => {
            const item = document.createElement('li');
            const statusClass = message.MessageType === 'Approval'
                ? 'notification-approval'
                : 'notification-rejection';
            item.classList.add(statusClass);
            item.innerHTML = `
                <strong>${message.RequestTable?.RequestTitle || 'Request'}</strong><br>
                ${message.MessageContent}<br>
                <small>${new Date(message.created_at).toLocaleString()}</small>
            `;
            list.appendChild(item);
        });

        notificationsContainer.innerHTML = '';
        notificationsContainer.appendChild(list);

        // Mark messages as read
        const unreadMessageIds = messages.filter(m => !m.IsRead).map(m => m.MessageID);
        if (unreadMessageIds.length > 0) {
            const { error: updateError } = await supabase
                .from('RequestMessages')
                .update({ IsRead: true })
                .in('MessageID', unreadMessageIds);
            if (updateError) {
                console.error('Error marking messages as read:', updateError);
            }
        }
    } catch (err) {
        console.error('Error loading recent notifications:', err);
    }
}


// Initial load
checkSession();
loadRecentNotifications();
