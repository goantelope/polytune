// UI — solid target circles (blue) + live circles (yellow) with green overlap
window.TunerUI = (function () {
    'use strict';
    var T = Tunings;

    // Color palette
    var TARGET_COLOR = '#2563eb';       // blue target circles
    var TARGET_DIM = '#1e3a5f';         // dimmed when no signal
    var LIVE_COLOR = '#eab308';         // yellow live circles
    var OVERLAP_COLOR = '#22c55e';      // green when overlapping
    var TEXT_ON_TARGET = '#c7d2fe';     // light text on blue
    var TEXT_DIM = '#475569';
    var TEXT_BRIGHT = '#e2e8f0';

    function TunerUI(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;
        this.w = 0;
        this.h = 0;

        this.animY = [];          // current animated Y offset per string
        this.animStrength = [];   // current animated size per string

        this._resize();
        var self = this;
        window.addEventListener('resize', function () { self._resize(); });
    }

    TunerUI.prototype._resize = function () {
        var rect = this.canvas.parentElement.getBoundingClientRect();
        this.w = rect.width;
        this.h = rect.height;
        this.canvas.width = this.w * this.dpr;
        this.canvas.height = this.h * this.dpr;
        this.canvas.style.width = this.w + 'px';
        this.canvas.style.height = this.h + 'px';
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    };

    TunerUI.prototype.render = function (core) {
        var ctx = this.ctx;
        ctx.clearRect(0, 0, this.w, this.h);

        if (!core || core.stringStates.length === 0) {
            ctx.fillStyle = TEXT_DIM;
            ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Strum to begin', this.w / 2, this.h / 2);
            return;
        }

        var states = core.stringStates;
        var count = states.length;

        // Size animation arrays
        while (this.animY.length < count) { this.animY.push(0); this.animStrength.push(0); }

        // Layout
        var R = Math.min(30, (this.w - 50) / (count * 2.5));  // target circle radius
        var spacing = (this.w - 40) / count;
        var startX = 20 + spacing / 2;
        var cy = this.h / 2;
        var maxDrift = this.h * 0.25;

        var visCount = 0, tuneCount = 0;

        for (var i = 0; i < count; i++) {
            var s = states[i];
            var cx = startX + i * spacing;
            var vis = s.visible;
            if (vis) visCount++;

            // ─── Animate strength (live circle size) ───
            var targetStr = vis ? s.smoothedStrength : 0;
            this.animStrength[i] += (targetStr - this.animStrength[i]) * 0.1;
            var liveR = R * Math.max(0.15, this.animStrength[i]); // min 15% of target size

            // ─── Animate Y offset ───
            var targetOffY = vis ? -(s.smoothedCents / T.CENTS_MAX) * maxDrift : 0;
            this.animY[i] += (targetOffY - this.animY[i]) * 0.08;

            var absCents = vis ? Math.abs(s.smoothedCents) : 50;
            var inTune = vis && absCents <= T.CENTS_IN_TUNE;

            if (inTune) {
                this.animY[i] *= 0.85; // snap toward center
                tuneCount++;
            }

            var fy = cy + this.animY[i];

            // ─── Draw target circle (blue, always visible) ───
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, Math.PI * 2);
            ctx.fillStyle = vis ? TARGET_COLOR : TARGET_DIM;
            ctx.fill();

            // Note name inside target circle
            ctx.fillStyle = vis ? TEXT_ON_TARGET : TEXT_DIM;
            ctx.font = 'bold ' + Math.round(R * 0.8) + 'px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(s.displayName, cx, cy);

            // Octave below the target circle
            ctx.fillStyle = TEXT_DIM;
            ctx.font = Math.round(R * 0.4) + 'px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillText(s.octave, cx, cy + R + 12);

            // ─── Draw live circle (yellow, only if visible) ───
            if (this.animStrength[i] > 0.02) {
                // Calculate overlap between target circle at (cx, cy, R) and live circle at (cx, fy, liveR)
                var dist = Math.abs(fy - cy);
                var overlap = (R + liveR) - dist; // positive means overlapping

                if (overlap > 0 && dist < R + liveR) {
                    // Draw the green overlap region using compositing
                    // First draw live circle in yellow
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.beginPath();
                    ctx.arc(cx, fy, liveR, 0, Math.PI * 2);
                    ctx.fillStyle = LIVE_COLOR;
                    ctx.fill();

                    // Now draw the intersection in green by clipping
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, cy, R, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.beginPath();
                    ctx.arc(cx, fy, liveR, 0, Math.PI * 2);
                    ctx.fillStyle = OVERLAP_COLOR;
                    ctx.fill();
                    ctx.restore();

                    // If fully overlapping (in tune), add glow
                    if (inTune) {
                        ctx.beginPath();
                        ctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
                        var grad = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R + 12);
                        grad.addColorStop(0, 'rgba(34, 197, 94, 0.3)');
                        grad.addColorStop(1, 'rgba(34, 197, 94, 0)');
                        ctx.fillStyle = grad;
                        ctx.fill();
                    }
                } else {
                    // No overlap — just draw yellow circle
                    ctx.beginPath();
                    ctx.arc(cx, fy, liveR, 0, Math.PI * 2);
                    ctx.fillStyle = LIVE_COLOR;
                    ctx.fill();
                }
            }
        }

        // ─── Sharp / Flat guides ───
        ctx.fillStyle = TEXT_DIM;
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♯ Sharp', this.w / 2, cy - maxDrift - 8);
        ctx.fillText('♭ Flat', this.w / 2, cy + maxDrift + 14);

        // ─── Status text ───
        if (visCount > 1) {
            var text, tc;
            if (tuneCount === visCount) {
                text = 'All in tune'; tc = OVERLAP_COLOR;
            } else {
                var out = visCount - tuneCount;
                text = out + ' string' + (out > 1 ? 's' : '') + ' need tuning';
                tc = '#f59e0b';
            }
            ctx.fillStyle = tc;
            ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(text, this.w / 2, 16);
        } else if (visCount === 1) {
            for (var i = 0; i < count; i++) {
                if (states[i].visible) {
                    var inT = Math.abs(states[i].smoothedCents) <= T.CENTS_IN_TUNE;
                    ctx.fillStyle = inT ? OVERLAP_COLOR : TEXT_BRIGHT;
                    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(
                        inT ? 'In Tune' : 'Tuning ' + states[i].displayName + states[i].octave,
                        this.w / 2, 16
                    );
                    break;
                }
            }
        }
    };

    return TunerUI;
})();
