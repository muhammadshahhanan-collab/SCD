// ✅ Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

// ✅ Reset scroll to top when page loads
window.onload = function () {
  // Check if URL has a hash (#about, #projects, etc.)
  if (!window.location.hash) {
    // No hash → means page loaded normally → scroll to top
    window.scrollTo(0, 0);
  }
  // If hash exists, let browser handle the scroll naturally
};

// ✅ Navbar background effect on scroll
window.addEventListener("scroll", function () {
  const navbar = document.querySelector(".navbar");
  if (window.scrollY > 50) {
    navbar.style.background =
      "linear-gradient(135deg, rgba(44, 82, 130, 0.95), rgba(56, 161, 105, 0.95))";
    navbar.style.backdropFilter = "blur(10px)";
  } else {
    //navbar.style.background = "transparent";
    navbar.style.backdropFilter = "none";
  }
});

fetch("footer.html")
  .then((response) => response.text())
  .then((data) => {
    document.getElementById("footer").innerHTML = data;
  });
