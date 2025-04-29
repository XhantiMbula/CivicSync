document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category') || 'all';
    filterService(category);
  });
  
  function filterService(category) {
    const items = document.querySelectorAll('.service-item');
    items.forEach(item => {
      if (category === 'all' || item.dataset.category === category) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });
  }
  
  function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  }