import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/module/index.js';

// Initialize Supabase client
const supabaseUrl = 'https://lywylvbgsnmqwcwgiyhc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5d3lsdmJnc25tcXdjd2dpeWhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ2MzI4ODYsImV4cCI6MjA2MDIwODg4Nn0.RGkQl_ZwwvQgbrUpP7jDXMPw2qJsEoLIkDmZUb0X5xg';
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

document.addEventListener('DOMContentLoaded', () => {
  const addContractorForm = document.getElementById('add-contractor-form');
  const messageContainer = document.getElementById('message');
  const logoutBtn = document.getElementById('logout');
  const backToDashboardBtn = document.getElementById('back-to-dashboard');
  const settingsTitle = document.getElementById('settings-title');
  const settingsContentArea = document.getElementById('settings-content-area');
  const addContractorSection = document.getElementById('add-contractor-section');
  const comingSoonTemplate = document.getElementById('coming-soon-template');
  const sidebarLinks = document.querySelectorAll('.settings-sidebar a');

  // Get authenticated user
  async function getUser() {
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser();
      if (error || !user) {
        console.error('Authentication error:', error?.message || 'No user found');
        alert('You must be logged in to access this page.');
        window.location.href = '/loginPage/loginPage.html';
        return null;
      }
      return user;
    } catch (err) {
      console.error('Error checking authentication:', err);
      alert('An error occurred while verifying your session.');
      return null;
    }
  }

  // Logout
  logoutBtn.addEventListener('click', async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.error('Error logging out:', error);
      showMessage('Error logging out.', 'error');
    } else {
      window.location.href = '/loginPage/loginPage.html';
    }
  });

  // Back to dashboard
  backToDashboardBtn.addEventListener('click', () => {
    window.location.href = '/AdminDashboard/adminDashboard.html';
  });

  // Add contractor form submission
  addContractorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const contractorUsername = document.getElementById('contractor-username').value.trim();
    const contractorEmail = document.getElementById('contractor-email').value.trim();
    const contractorPassword = document.getElementById('contractor-password').value.trim();
    const contractorPhone = document.getElementById('contractor-phone').value.trim();
    const contractorLocation = document.getElementById('contractor-location').value.trim();
    const contractorCompany = document.getElementById('contractor-company').value.trim();
    const contractorCategory = document.getElementById('contractor-category').value;

    if (!contractorUsername || !contractorEmail || !contractorPassword || !contractorPhone || !contractorLocation || !contractorCompany || !contractorCategory) {
      showMessage('Please fill in all fields.', 'error');
      return;
    }

    try {
      // Create authentication user
      const { user: authUser, error: authError } = await supabaseClient.auth.signUp({
        email: contractorEmail,
        password: contractorPassword
      });

      if (authError) {
        console.error('Error creating authentication user:', authError);
        showMessage('Error creating contractor: ' + authError.message, 'error');
        return;
      }

      // Create user entry in UserTable
      const { data: user, error: userError } = await supabaseClient
        .from('UserTable')
        .insert([{
          UserFirstname: contractorUsername.split(' ')[0],
          UserLastname: contractorUsername.split(' ').slice(1).join(' ') || '',
          UserEmail: contractorEmail,
          UserPhonenumber: contractorPhone,
          UserUsername: contractorUsername,
          UserLocation: contractorLocation,
          Role: 'Contractor',
          CreatedAt: new Date().toISOString()
        }])
        .select();

      if (userError) {
        console.error('Error creating user:', userError);
        showMessage('Error creating contractor: ' + userError.message, 'error');
        return;
      }

      // Create contractor entry in ContractorTable
      const { data: contractor, error: contractorError } = await supabaseClient
        .from('ContractorTable')
        .insert([{
          ContractorName: contractorCompany,
          ContractorCategory: contractorCategory,
          UserID: user[0].UserID,
          CreatedAt: new Date().toISOString(),
          UpdatedAt: new Date().toISOString()
        }])
        .select();

      if (contractorError) {
        console.error('Error creating contractor:', contractorError);
        showMessage('Error creating contractor: ' + contractorError.message, 'error');
        return;
      }

      showMessage('Contractor added successfully! Please check your email to confirm registration.', 'success');
      addContractorForm.reset();
      
    } catch (error) {
      console.error('Error adding contractor:', error);
      showMessage('Error adding contractor: ' + error.message, 'error');
    }
  });

  // Show message utility function
  function showMessage(text, type) {
    messageContainer.textContent = text;
    messageContainer.className = 'message-container ' + type + '-message';
    messageContainer.style.display = 'block';
    
    setTimeout(() => {
      messageContainer.style.display = 'none';
    }, 5000);
  }

  // Section navigation
  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      sidebarLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      const section = link.dataset.section;
      const title = link.dataset.title;
      
      settingsTitle.textContent = title;
      
      // Hide all sections
      addContractorSection.style.display = 'none';
      comingSoonTemplate.style.display = 'none';
      
      // Show appropriate section
      if (section === 'add-contractor') {
        addContractorSection.style.display = 'block';
      } else {
        comingSoonTemplate.style.display = 'block';
      }
    });
  });

  // Initialize
  getUser();
});