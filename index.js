
// Hamburger Menu Toggle
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.querySelector('.hamburger');
  const navbar = document.querySelector('.navbar');
  hamburger.addEventListener('click', () => {
    navbar.classList.toggle('active');
  });

  // Initialize Slideshow
  const slides = document.querySelectorAll('.slide');
  const dotsContainer = document.querySelector('.dots');
  let currentSlide = 0;

  // Create Dots
  slides.forEach((_, index) => {
    const dot = document.createElement('span');
    dot.classList.add('dot');
    dot.addEventListener('click', () => {
      currentSlide = index;
      showSlide(currentSlide);
    });
    dotsContainer.appendChild(dot);
  });

  const dots = document.querySelectorAll('.dot');

  function showSlide(index) {
    slides.forEach((slide, i) => {
      slide.classList.remove('active');
      dots[i].classList.remove('active');
      if (i === index) {
        slide.classList.add('active');
        dots[i].classList.add('active');
      }
    });
  }

  function nextSlide() {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
  }

  showSlide(currentSlide);
  setInterval(nextSlide, 4000);

  // Smooth Scrolling
  function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Service Filter (Existing Functionality)
  window.filterService = function(category) {
    const items = document.querySelectorAll('.service-item');
    items.forEach(item => {
      if (category === 'all' || item.getAttribute('data-category') === category) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  };

  // Google Maps (Existing Functionality)
  window.initMap = function() {
    const map = new google.maps.Map(document.getElementById("map"), {
      zoom: 6,
      center: { lat: -30.5595, lng: 22.9375 },
    });

    const locations = [
      { position: { lat: -33.876944, lng: 18.626389 }, title: "City of Cape Town Electricity Services Head Office", category: "electricity" },
      { position: { lat: -34.062801, lng: 18.764387 }, title: "Khayelitsha Fire and Rescue Station", category: "fire" },
      { position: { lat: -34.062801, lng: 18.764387 }, title: "Macassar Fire Station", category: "fire" },
      { position: { lat: -34.043446, lng: 18.593046 }, title: "Mitchell's Plain Fire Station", category: "fire" },
      { position: { lat: -34.087601, lng: 18.842699 }, title: "Helderberg Fire Watch", category: "fire" },
      { position: { lat: -34.002579, lng: 18.687668 }, title: "Mfuleni Youth Development Forum", category: "fire" },
      { position: { lat: -34.072319, lng: 18.832619 }, title: "Sir Lowry's Pass Fire Station", category: "fire" },
      { position: { lat: -33.951935, lng: 18.635471 }, title: "Belhar Fire Station", category: "fire" },
      { position: { lat: -34.070461, lng: 18.827198 }, title: "Fire Space", category: "fire" },
      { position: { lat: -33.933453, lng: 18.679382 }, title: "Kuils River Fire Station", category: "electricity" },
      { position: { lat: -33.878277, lng: 18.707438 }, title: "Brackenfell Fire Station", category: "fire" },
      { position: { lat: -34.102238, lng: 18.855230 }, title: "Re-Active Fire Equipment Specialist", category: "electricity" },
      { position: { lat: -34.136723, lng: 18.425726 }, title: "Fish Hoek Fire Station", category: "electricity" },
      { position: { lat: -34.021095, lng: 18.442411 }, title: "Constantia Fire Station", category: "electricity" },
      { position: { lat: -33.904930, lng: 18.632246 }, title: "Bellville Fire Station", category: "electricity" },
      { position: { lat: -33.918884, lng: 18.591177 }, title: "Boland Fire Services-Since 1978", category: "electricity" },
      { position: { lat: -34.085987, lng: 18.843439 }, title: "Somerset West Fire Station", category: "electricity" },
      { position: { lat: -33.927502, lng: 18.542801 }, title: "Epping Fire Department", category: "electricity" },
      { position: { lat: -34.001137, lng: 18.566042 }, title: "Gugulethu Fire Station", category: "electricity" },
    ];

    const icons = {
      fire: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
      police: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
      electricity: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
    };

    locations.forEach((loc) => {
      new google.maps.Marker({
        position: loc.position,
        map,
        title: loc.title,
        icon: icons[loc.category],
      });
    });
  };

  // Contact Form Submission (Placeholder)
  window.submitContactForm = function() {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const message = document.getElementById('message').value;
    if (name && email && message) {
      alert('Thank you for your message! We will get back to you soon.');
      document.getElementById('name').value = '';
      document.getElementById('email').value = '';
      document.getElementById('message').value = '';
    } else {
      alert('Please fill in all fields.');
    }
  };
});
