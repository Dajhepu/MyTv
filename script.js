const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabId = button.getAttribute('data-tab');
    showTab(tabId);
  });
});

function showTab(tabId) {
  tabButtons.forEach(button => {
    button.classList.remove('active');
  });
  tabContents.forEach(content => {
    content.classList.remove('show');
  });

  const selectedButton = document.querySelector(`[data-tab="${tabId}"]`);
  const selectedContent = document.querySelector(`#${tabId}`);

  selectedButton.classList.add('active');
  selectedContent.classList.add('show');
}

var sliderContainer = document.querySelector(".slider-container");

sliderContainer.addEventListener("scroll", function() {
    var slideWidth = sliderContainer.offsetWidth;
    var slideIndex = Math.round(sliderContainer.scrollLeft / slideWidth);
    sliderContainer.scrollLeft = slideIndex * slideWidth;
});

