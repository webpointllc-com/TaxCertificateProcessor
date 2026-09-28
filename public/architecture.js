(function () {
  'use strict';

  var DESIGN_WIDTH = 1280;
  var DESIGN_HEIGHT = 800;

  function scaleToFit() {
    var outer = document.getElementById('scale-outer');
    var canvas = document.getElementById('design-canvas');
    var width = document.documentElement.clientWidth || window.innerWidth;
    var scale = Math.min(1, width / DESIGN_WIDTH);
    outer.style.height = (DESIGN_HEIGHT * scale) + 'px';
    canvas.style.transform = 'scale(' + scale + ')';
    canvas.style.left = Math.max(0, (width - DESIGN_WIDTH * scale) / 2) + 'px';
  }

  window.addEventListener('resize', scaleToFit);
  scaleToFit();
  if (window.ResizeObserver) {
    new ResizeObserver(scaleToFit).observe(document.documentElement);
  }

  document.querySelectorAll('.mod').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.mod').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
    });
  });
})();
