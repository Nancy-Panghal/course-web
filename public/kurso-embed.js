// public/kurso-embed.js
//
// Kurso embeddable enroll button.
// A creator adds data-kurso-course="<courseId>" to ANY existing button or
// link on their own page (any styling, they control it completely) and
// loads this script once. Clicking that element opens Kurso's checkout
// (/enroll/[courseId]) in a popup window — a normal top-level browsing
// context, so Google login and session storage behave identically to
// visiting the link directly. Nothing here calls Kurso's API, so there's
// no CORS surface and nothing here can leak a secret — it's just a click
// handler that opens a URL.
//
// Usage on the creator's page:
//   <button data-kurso-course="COURSE_ID">Enroll Now</button>
//   <script src="https://kurso.in/kurso-embed.js" defer></script>

(function () {
  var BASE_URL = 'https://kurso.in'

  function openCheckout(courseId) {
    var target = BASE_URL + '/enroll/' + courseId
    var w = 480, h = 720
    var left = window.screenX + (window.outerWidth - w) / 2
    var top = window.screenY + (window.outerHeight - h) / 2
    var popup = window.open(
      target,
      'kurso_checkout',
      'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top + ',resizable=yes,scrollbars=yes'
    )
    // Popup blocked (rare for a direct click, but some browser configs do
    // it anyway) — fall back to a normal same-tab navigation so the click
    // never just silently does nothing.
    if (!popup) window.location.href = target
  }

  function bind(el) {
    if (el.__kursoBound) return
    el.__kursoBound = true
    el.addEventListener('click', function (e) {
      e.preventDefault()
      openCheckout(el.getAttribute('data-kurso-course'))
    })
  }

  function init() {
    var els = document.querySelectorAll('[data-kurso-course]')
    for (var i = 0; i < els.length; i++) bind(els[i])
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  // Exposed for creators on JS-driven sites (React/Vue/Webflow interactions)
  // who inject the button after page load and need to re-scan manually.
  window.KursoEmbed = { init: init }
})()