(function () {
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // Trailer dimuat hanya saat diklik, supaya halaman tetap ringan.
  document.querySelectorAll(".video[data-youtube-id]").forEach(function (box) {
    var button = box.querySelector(".video-play");

    button.addEventListener("click", function () {
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube-nocookie.com/embed/" + box.dataset.youtubeId + "?autoplay=1";
      iframe.title = "Trailer Di Antara Kita";
      iframe.allow = "accelerometer; encrypted-media; picture-in-picture";
      iframe.allowFullscreen = true;
      box.replaceChildren(iframe);
    });
  });
})();
