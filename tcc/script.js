
document.addEventListener("DOMContentLoaded", function () {
    const container = document.querySelector(".carrossel-container");
    const images = document.querySelectorAll(".carrossel-container img");
    
    
    let scrollAmount = 0;
    const scrollStep = 2; 
    const delay = 20;     

    
    
    images.forEach((img) => {
        const clone = img.cloneNode(true);
        container.appendChild(clone);
    });

    function startAutoScroll() {
        scrollAmount += scrollStep;
        if (scrollAmount >= container.scrollWidth / 2) {
            scrollAmount = 0;
        }

        container.style.transform = `translateX(-${scrollAmount}px)`;
    }

  
    let interval = setInterval(startAutoScroll, delay);

   
    container.addEventListener("mouseenter", () => {
        clearInterval(interval);
    });

    
    container.addEventListener("mouseleave", () => {
        interval = setInterval(startAutoScroll, delay);
    });
});