// Pharmacy Journey boot diagnostic (temporary).
// If the loader is still at 0% after 12 seconds, show which script files
// actually arrived and which are stuck, using the browser's own resource
// timings. This runs as a plain classic script, independent of the 3D
// module, so a hung script fetch shows up here without opening DevTools.
// It never touches the sim: if loading progresses past 0%, it does nothing.
(function () {
  var FILES = ['gsap.min.js', 'diag.js', 'main.js', 'three.module.min.js',
    'orbit.js', 'cast.js', 'journey.js', 'loader.js', 'GLTFLoader.js',
    'meshopt_decoder.module.js', 'RoomEnvironment.js',
    'BufferGeometryUtils.js', 'SkeletonUtils.js'];
  function render() {
    var loader = document.getElementById('loader');
    var pct = document.getElementById('loadpct');
    if (!loader || loader.classList.contains('done')) return;
    if (pct && pct.textContent !== '0%') return;
    var box = document.querySelector('.ld-box');
    if (!box) return;
    var entries = [];
    try { entries = performance.getEntriesByType('resource'); } catch (e) { entries = []; }
    function statusFor(base) {
      var hit = null;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].name.indexOf(base) !== -1) { hit = entries[i]; break; }
      }
      if (!hit) return 'not requested';
      if (!hit.responseEnd) return 'still waiting';
      return 'loaded in ' + Math.round(hit.responseEnd - hit.startTime) + ' ms';
    }
    var panel = document.createElement('div');
    panel.id = 'bootdiag';
    panel.style.cssText = 'margin:18px auto 0;text-align:left;background:#fff;border:1px solid #c8d6cc;border-radius:10px;padding:12px 14px;font-family:monospace;font-size:12px;line-height:1.7;color:#20302a;max-width:420px;max-height:46vh;overflow:auto;';
    var html = '<div style="font-family:system-ui;font-weight:700;font-size:13px;margin-bottom:6px;">Boot check: still at 0% after 12 seconds</div>';
    html += '<div style="font-family:system-ui;font-size:12px;color:#40534a;margin-bottom:8px;">Script files (same-origin only):</div>';
    html += '<div style="font-family:system-ui;font-size:12px;color:#40534a;margin-bottom:8px;">GSAP loaded: ' + (typeof window.gsap !== 'undefined' ? 'yes' : 'no') + '</div>';
    for (var j = 0; j < FILES.length; j++) {
      html += '<div>' + FILES[j] + ' : ' + statusFor(FILES[j]) + '</div>';
    }
    html += '<div style="font-family:system-ui;font-size:12px;color:#40534a;margin-top:8px;">If every file above says loaded, the stall is in the 3D model downloads, not the scripts. Please screenshot this box.</div>';
    panel.innerHTML = html;
    box.appendChild(panel);
  }
  setTimeout(render, 12000);
})();
